import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createStore,totals} from './store.mjs';
import {createAPI} from './http.mjs';

function setup(t,filename=':memory:') {
  const s=createStore(filename,['admin']);t.after(()=>s.close());
  const meta={name:'テスト合宿',start:'2027-03-13',end:'2027-03-14',status:'準備中'};
  const c=s.mutate('admin',{action:'create',requestId:randomUUID(),data:meta}).id;
  const cmd=(action,data={},entity,uid='admin',cid=c,extra={})=>s.mutate(uid,{action,data,entity,campId:cid,revision:s.get(cid).revision,requestId:randomUUID(),...extra});
  const save=(entity,data,uid='admin')=>cmd('save',data,entity,uid);
  const person=(id,extra={})=>save('participants',{id,name:'試験 '+id,kind:'player',grade:'4年',response:'yes',overnight:true,...extra});
  return {s,c,cmd,save,person,meta};
}
test('新規作成・一覧・編集・アーカイブ・参加人数・削除',t=>{
  const {s,c,cmd,person}=setup(t);assert.equal(s.list('admin').length,1);person('p1');person('p2');
  assert.equal(Object.keys(s.get(c).participants).length,2);
  cmd('delete',{id:'p2'},'participants');assert.equal(Object.keys(s.get(c).participants).length,1);
  cmd('meta',{name:'更新合宿',archived:true});assert.equal(s.list('admin')[0].archived,true);
});
test('ディスクへの永続保存と再起動後の復元',t=>{
  const dir=mkdtempSync(join(tmpdir(),'smc-camp-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'camp.sqlite');let s=createStore(path,['admin']);
  const result=s.mutate('admin',{action:'create',requestId:'create-persist',data:{name:'永続確認',start:'2027-03-13',end:'2027-03-14',status:'準備中'}});s.close();
  s=createStore(path,['admin']);assert.equal(s.get(result.id).name,'永続確認');s.close();
});
test('往路・復路の独立割当、定員超過・二重乗車・減員を拒否',t=>{
  const {s,c,save,person}=setup(t);person('p1');person('p2');
  save('vehicles',{id:'v1',name:'往路1号',capacity:1,direction:'outbound'});
  save('vehicles',{id:'v2',name:'復路1号',capacity:1,direction:'return'});
  save('rides',{id:'r1',participantId:'p1',vehicleId:'v1'});
  save('rides',{id:'r2',participantId:'p1',vehicleId:'v2'});
  assert.equal(Object.keys(s.get(c).rides).length,2);
  assert.throws(()=>save('rides',{id:'r3',participantId:'p2',vehicleId:'v1'}),/定員超過/);
  assert.throws(()=>save('rides',{id:'r4',participantId:'p1',vehicleId:'v1'}),/二重/);
  assert.throws(()=>save('vehicles',{id:'v1',name:'往路1号',capacity:0,direction:'outbound'}));
  assert.throws(()=>save('vehicles',{id:'v1',name:'往路1号',capacity:2,direction:'return'}),/解除/);
  person('p1',{response:'no'});assert.equal(Object.keys(s.get(c).rides).length,0);
});
test('部屋定員・宿泊有無・未割当を正しく扱う',t=>{
  const {s,c,save,person}=setup(t);person('p1');person('p2',{overnight:false});
  save('rooms',{id:'room',name:'101',capacity:1});save('roomAssignments',{id:'a',participantId:'p1',roomId:'room'});
  assert.throws(()=>save('roomAssignments',{id:'b',participantId:'p2',roomId:'room'}),/宿泊/);
  person('p2');assert.throws(()=>save('roomAssignments',{id:'b',participantId:'p2',roomId:'room'}),/定員/);
  person('p1',{overnight:false});assert.equal(Object.keys(s.get(c).roomAssignments).length,0);
});
test('点呼は担当とサーバー時刻を記録し、同一点呼の重複を拒否',t=>{
  const {s,c,save,person}=setup(t);person('p1');person('p2');
  save('checks',{id:'ck',participantId:'p1',checkpoint:'到着',status:'confirmed',place:'ホテル',checkedAt:'偽造',checkedBy:'偽造'});
  const check=s.get(c).checks.ck;assert.equal(check.checkedBy,'admin');assert.ok(Date.parse(check.checkedAt));
  const pending=Object.values(s.get(c).participants).filter(p=>!Object.values(s.get(c).checks).some(x=>x.participantId===p.id&&x.status==='confirmed'));
  assert.equal(pending.length,1);assert.throws(()=>save('checks',{id:'other',participantId:'p1',checkpoint:'到着',status:'confirmed'}),/既存/);
});
test('一部入金・追加請求・返金・取消・立替・二重計上防止',t=>{
  const {s,c,save,person}=setup(t);person('p1');person('p2');
  save('charges',{id:'c1',participantId:'p1',amount:10000,due:'2027-03-01'});
  save('charges',{id:'c2',participantId:'p1',amount:2000,due:'2027-03-01'});
  const payment={id:'pay',participantId:'p1',amount:8000,date:'2027-03-01',kind:'payment',method:'cash',reference:'receipt1'};
  save('payments',payment);save('payments',{...payment,id:'refund',kind:'refund',amount:1000,reference:'refund1'});
  let result=totals(s.get(c));assert.equal(result.outstanding,5000);assert.equal(result.received,7000);
  assert.throws(()=>save('payments',{...payment,id:'duplicate'}),/重複/);
  assert.throws(()=>save('payments',{...payment,id:'too-much',kind:'refund',amount:9000,reference:'refund2'}),/返金/);
  save('transactions',{id:'expense',kind:'expense',category:'宿泊費',date:'2027-03-13',amount:3000,budget:4000,payer:'コーチ',settled:false});
  save('transactions',{id:'subsidy',kind:'income',category:'団からの補助',date:'2027-03-13',amount:2000});
  result=totals(s.get(c));assert.equal(result.balance,6000);assert.equal(result.advances,3000);
  assert.throws(()=>save('transactions',{id:'bad',kind:'income',category:'参加費',date:'2027-03-13',amount:1000}),/自動集計/);
  assert.throws(()=>save('payments',{...payment,void:true}),/返金/);
  save('payments',{...s.get(c).payments.refund,void:true});save('payments',{...payment,void:true});assert.equal(totals(s.get(c)).received,0);
  assert.throws(()=>save('charges',{id:'invalid',participantId:'p1',amount:1.5,due:'2027-03-01'}),/整数/);
});
test('請求ゼロ・過入金を家庭間で相殺しない',t=>{
  const {s,c,save,person}=setup(t);assert.equal(totals(s.get(c)).rate,null);person('p1');person('p2');
  for(const p of ['p1','p2'])save('charges',{id:p,participantId:p,amount:1000,due:'2027-03-01'});
  save('payments',{id:'paid',participantId:'p1',amount:2000,date:'2027-03-01',kind:'payment',method:'transfer',reference:'x'});
  const total=totals(s.get(c));assert.equal(total.outstanding,1000);assert.equal(total.credit,1000);assert.equal(total.paidCount,1);assert.equal(total.unpaidCount,1);
});
test('保護者の他家族閲覧・書込・健康情報の追加・権限昇格を防止',t=>{
  const {s,c,cmd,save,person}=setup(t);
  cmd('permission',{uid:'parentA',role:'parent'});person('p1',{familyUid:'parentA'});person('p2',{familyUid:'parentB'});
  save('charges',{id:'charge',participantId:'p2',amount:10000,due:'2027-03-01'});
  const out=s.project(s.get(c),'parentA');assert.deepEqual(Object.keys(out.participants),['p1']);assert.deepEqual(out.charges,{});assert.deepEqual(out.sharedOutstanding,[{names:['試験 p2'],amount:10000}]);assert.equal(out.permissions,undefined);assert.ok(!JSON.stringify(out).includes('秘匿情報'));
  save('participants',{id:'p1',response:'no',overnight:false,name:'改ざん',familyUid:'parentB'},'parentA');
  const p=s.get(c).participants.p1;assert.equal(p.name,'試験 p1');assert.equal(p.familyUid,'parentA');assert.equal(p.care,undefined);assert.equal(p.response,'no');
  assert.throws(()=>save('participants',{id:'p2',response:'no'},'parentA'),/他の家庭/);
  assert.throws(()=>cmd('permission',{uid:'parentA',role:'leader'},undefined,'parentA'),/管理者/);
  assert.throws(()=>s.project(s.get(c),'stranger'),/権限/);
  person('p3',{familyUid:'parentB'});save('charges',{id:'sibling',participantId:'p3',amount:2000,due:'2027-03-01'});
  assert.deepEqual(s.project(s.get(c),'parentA').sharedOutstanding,[{names:['試験 p2','試験 p3'],amount:12000}]);
  assert.throws(()=>save('participants',{id:'p1',care:'追加攻撃'},'parentA'),/登録できません/);
  cmd('permission',{uid:'parentA',role:'revoke'});assert.throws(()=>s.project(s.get(c),'parentA'),/権限/);
});
test('会計担当・スタッフの権限と非公開お知らせ',t=>{
  const {s,c,cmd,save,person}=setup(t);cmd('permission',{uid:'staff',role:'staff'});cmd('permission',{uid:'accountant',role:'accountant'});cmd('permission',{uid:'parent',role:'parent'});
  person('p1',{familyUid:'parent'});save('announcements',{id:'internal',title:'内部',body:'運営情報',audience:'staff'});
  assert.equal(s.project(s.get(c),'staff').participants.p1.care,undefined);assert.deepEqual(s.project(s.get(c),'accountant').announcements,{});assert.deepEqual(s.project(s.get(c),'parent').announcements,{});
  assert.throws(()=>save('charges',{id:'x',participantId:'p1',amount:100,due:'2027-03-01'},'staff'),/権限/);
  assert.throws(()=>save('checks',{id:'x',participantId:'p1',checkpoint:'朝',status:'confirmed'},'accountant'),/権限/);
  assert.throws(()=>cmd('read',{id:'internal'},undefined,'parent'),/見つかりません/);
});
test('再試行の二重登録防止と同時更新の競合検知',t=>{
  const {s,c,cmd}=setup(t);const revision=s.get(c).revision;
  const body={action:'meta',data:{name:'変更'},campId:c,revision,requestId:'retry'};
  const first=s.mutate('admin',body);const again=s.mutate('admin',body);assert.deepEqual(first,again);assert.equal(s.get(c).revision,revision+1);
  assert.throws(()=>s.mutate('admin',{...body,data:{name:'異なる操作'}}),e=>e.status===409);
  assert.throws(()=>cmd('meta',{name:'古い更新'},undefined,'admin',c,{revision}),e=>e.status===409);
});
test('合宿間分離、名簿重複、複製時の機密情報除外と日付移動',t=>{
  const {s,c,cmd,save,person}=setup(t);person('p1',{memberId:'smc1'});assert.throws(()=>person('p2',{memberId:'smc1'}),/登録済み/);
  save('schedule',{id:'s1',date:'2027-03-13',start:'09:00',end:'10:00',title:'集合'});
  const copy=cmd('duplicate',{name:'次回',start:'2028-03-11',end:'2028-03-12'}).id;
  assert.equal(Object.keys(s.get(copy).participants).length,0);assert.equal(Object.values(s.get(copy).schedule)[0].date,'2028-03-11');
  assert.throws(()=>cmd('save',{id:'charge',participantId:'p1',amount:100,due:'2028-03-01'},'charges','admin',copy),/参加者/);
  assert.equal(s.get(c).participants.p1.memberId,'smc1');
});
test('位置共有の同意・担当成人・期限・停止・最終更新、GPSと点呼を分離',t=>{
  const {s,c,cmd,save}=setup(t);cmd('permission',{uid:'driver',role:'staff'});
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});cmd('meta',{start:today,end:today,status:'実施中'});
  save('vehicles',{id:'v',name:'車',capacity:5,direction:'outbound',driverUid:'driver',sharingStart:new Date(Date.now()-60000).toISOString(),sharingEnd:new Date(Date.now()+60000).toISOString()});
  const input={lat:36,lng:139,accuracy:10,consent:true,adult:true};
  assert.throws(()=>s.location('driver',c,'v',{start:true,...input,consent:false}),/同意/);
  assert.throws(()=>s.location('admin',c,'v',input),/担当成人/);
  const session=s.location('driver',c,'v',{start:true,consent:true,adult:true});input.token=session.token;
  s.location('driver',c,'v',input);assert.ok(Date.parse(s.locations('admin',c)[0].at));assert.equal(Object.keys(s.get(c).checks).length,0);
  assert.throws(()=>s.locations('driver',c),/権限/);
  s.location('driver',c,'v',{stop:true});assert.equal(s.locations('admin',c).length,0);
  assert.throws(()=>s.location('driver',c,'v',input),/停止/);
  save('vehicles',{...s.get(c).vehicles.v,sharingEnd:new Date(Date.now()-1).toISOString()});assert.throws(()=>s.location('driver',c,'v',input),/時間/);
});
test('健康情報の登録・不正日付・時刻・IDを拒否、監査に健康情報を残さない',t=>{
  const {s,c,save,person}=setup(t);assert.throws(()=>person('p1',{care:'情報'}),/登録できません/);
  assert.throws(()=>person('p1',{care:'健康秘密',consent:true}),/登録できません/);assert.throws(()=>person('p1',{emergencyContact:'番号'}),/登録できません/);
  assert.ok(!JSON.stringify(s.db.prepare('SELECT * FROM audit').all()).includes('健康秘密'));
  assert.ok(!JSON.stringify(s.db.prepare('SELECT * FROM requests').all()).includes('健康秘密'));
  assert.throws(()=>person('__proto__'),/ID/);
  assert.throws(()=>save('schedule',{id:'s',date:'2027-03-13',start:'29:00',end:'30:00',title:'不正'}),/時間/);
  assert.throws(()=>save('schedule',{id:'s',date:'2027-02-30',start:'09:00',end:'10:00',title:'不正'}),/日付/);
});
test('担当成人の出発・到着報告を許可し、別車両の報告を拒否',t=>{
  const {s,c,cmd,save}=setup(t);cmd('permission',{uid:'driver',role:'staff'});
  save('vehicles',{id:'v1',name:'担当車',capacity:4,direction:'outbound',driverUid:'driver'});
  save('vehicles',{id:'v2',name:'他の車',capacity:4,direction:'outbound',driverUid:'other'});
  cmd('vehicleStatus',{id:'v1',status:'moving'},'vehicles','driver');assert.ok(Date.parse(s.get(c).vehicles.v1.actualDeparture));
  cmd('vehicleStatus',{id:'v1',status:'arrived'},'vehicles','driver');assert.ok(Date.parse(s.get(c).vehicles.v1.actualArrival));
  assert.throws(()=>cmd('vehicleStatus',{id:'v2',status:'arrived'},'vehicles','driver'),/権限/);
});
test('機密情報の消去と位置情報の非永続化',t=>{
  const {s,c,cmd,person,save}=setup(t);person('p1');const legacy=s.get(c);Object.assign(legacy.participants.p1,{care:'消去対象',emergencyContact:'非公開番号',consent:true});s.db.prepare('UPDATE camps SET body=? WHERE id=?').run(JSON.stringify(legacy),c);assert.equal(s.project(s.get(c),'admin').participants.p1.care,undefined);
  save('emergency',{id:'e1',title:'連絡先',body:'削除する連絡事項'});
  assert.equal(s.db.prepare("SELECT count(*) AS n FROM main.sqlite_master WHERE name IN ('locations','location_sessions')").get().n,0);
  cmd('eraseSensitive');assert.equal(s.get(c).participants.p1.care,undefined);assert.equal(s.get(c).participants.p1.emergencyContact,undefined);assert.deepEqual(s.get(c).emergency,{});
  assert.ok(!JSON.stringify(s.db.prepare('SELECT * FROM audit').all()).includes('削除する連絡事項'));
});
test('バックアップの作成・整合性検査・再読込',t=>{
  const dir=mkdtempSync(join(tmpdir(),'smc-backup-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const source=join(dir,'source.sqlite'),dest=join(dir,'backup.sqlite');const s=createStore(source,['admin']);
  const c=s.mutate('admin',{action:'create',requestId:'backup',data:{name:'復旧確認',start:'2027-03-13',end:'2027-03-14',status:'準備中'}}).id;s.close();
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./backup.mjs',import.meta.url)),source,dest],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);const restored=createStore(dest,['admin']);assert.equal(restored.get(c).name,'復旧確認');restored.close();
  const duplicate=spawnSync(process.execPath,[fileURLToPath(new URL('./backup.mjs',import.meta.url)),source,dest],{encoding:'utf8'});assert.notEqual(duplicate.status,0);
});
test('HTTP経由の保存・取得・認証拒否・他合宿ID・CORS制限',async t=>{
  const {s,c}=setup(t);
  const server=createAPI(s,{origin:'https://portal.example',verifyToken:async token=>{if(token==='invalid')throw Error();return {uid:token,email_verified:true,firebase:{sign_in_provider:'password'}};},readMembers:async()=>({member1:{name:'試験選手',grade:'4年',private:'非公開'}})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const get=(path,token='admin',origin='https://portal.example')=>fetch(base+path,{headers:{Authorization:'Bearer '+token,Origin:origin}});
  assert.equal((await get('/api/camps','invalid')).status,401);assert.equal((await get('/api/camps','admin','https://evil.example')).status,403);
  assert.equal((await get('/api/camps/'+c,'stranger')).status,403);
  assert.equal((await get('/api/camps')).headers.get('cache-control'),'no-store');
  const members=await(await get('/api/camps/'+c+'/members')).json();assert.equal(members[0].private,undefined);
  const response=await fetch(base+'/api/command',{method:'POST',headers:{Authorization:'Bearer admin','Content-Type':'application/json'},body:JSON.stringify({action:'meta',campId:c,revision:s.get(c).revision,requestId:randomUUID(),data:{name:'HTTP更新'}})});
  assert.equal(response.status,200);assert.equal((await(await get('/api/camps/'+c)).json()).name,'HTTP更新');
});
