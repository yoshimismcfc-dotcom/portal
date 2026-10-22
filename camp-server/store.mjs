import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';

export class Problem extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const fail = (condition, message, status = 422) => { if (!condition) throw new Problem(status, message); };
const clone = x => JSON.parse(JSON.stringify(x));
const fingerprint = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const values = x => Object.values(x || {});
const roles = ['leader', 'accountant', 'staff', 'parent'];
const entities = ['participants', 'schedule', 'vehicles', 'rides', 'checks', 'rooms', 'roomAssignments', 'charges', 'payments', 'transactions', 'announcements', 'checklists', 'emergency'];
const financial = ['charges', 'payments', 'transactions'];
const key = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v) && !Object.hasOwn(Object.prototype,v) && v!=='prototype';
const text = (v, n = 500) => typeof v === 'string' && v.length <= n;
const day = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
const money = v => Number.isSafeInteger(v) && v >= 0 && v <= 100000000;
const safeURL = v => { try { return new URL(v).protocol === 'https:'; } catch { return false; } };
export function totals(c) {
  const bills = values(c.charges).reduce((a, x) => { a[x.participantId] = (a[x.participantId] || 0) + x.amount; return a; }, {});
  const paid = {};
  values(c.payments).filter(x => !x.void).forEach(x => { paid[x.participantId] = (paid[x.participantId] || 0) + x.amount * (x.kind === 'refund' ? -1 : 1); });
  const billed = Object.values(bills).reduce((a,b)=>a+b,0);
  const received = Object.values(paid).reduce((a,b)=>a+b,0);
  const ids = new Set([...Object.keys(bills), ...Object.keys(paid)]);
  const outstanding = [...ids].reduce((a,id)=>a+Math.max(0,(bills[id]||0)-(paid[id]||0)),0);
  const credit = [...ids].reduce((a,id)=>a+Math.max(0,(paid[id]||0)-(bills[id]||0)),0);
  const tx = values(c.transactions).filter(x=>!x.void);
  const income = received + tx.filter(x=>x.kind==='income').reduce((a,x)=>a+x.amount,0);
  const expense = tx.filter(x=>x.kind==='expense').reduce((a,x)=>a+x.amount,0);
  return {billed,received,outstanding,credit,rate:billed ? received/billed : null,
    paidCount:[...ids].filter(id=>(bills[id]||0)>0 && (paid[id]||0)>=(bills[id]||0)).length,
    unpaidCount:[...ids].filter(id=>(bills[id]||0)>(paid[id]||0)).length,
    income,expense,balance:income-expense,
    advances:tx.filter(x=>x.kind==='expense'&&x.payer&&!x.settled).reduce((a,x)=>a+x.amount,0),
    balances:Object.fromEntries([...ids].map(id=>[id,{billed:bills[id]||0,received:paid[id]||0,due:Math.max(0,(bills[id]||0)-(paid[id]||0))}]))};
}
export function createStore(filename, admins = []) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;
    CREATE TABLE IF NOT EXISTS camps(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,camp TEXT NOT NULL,actor TEXT NOT NULL,at TEXT NOT NULL,action TEXT NOT NULL,entity TEXT,record TEXT,before_json TEXT,after_json TEXT);
    CREATE TABLE IF NOT EXISTS requests(actor TEXT NOT NULL,id TEXT NOT NULL,result TEXT NOT NULL,signature TEXT NOT NULL,PRIMARY KEY(actor,id));
    ATTACH DATABASE ':memory:' AS transient;
    CREATE TABLE transient.locations(camp TEXT NOT NULL,vehicle TEXT NOT NULL,body TEXT NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(camp,vehicle));
    CREATE TABLE transient.location_sessions(camp TEXT NOT NULL,vehicle TEXT NOT NULL,token TEXT NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(camp,vehicle));`);
  const isAdmin = uid => admins.includes(uid);
  const get = id => { const row=db.prepare('SELECT * FROM camps WHERE id=?').get(id); fail(row,'合宿が見つかりません',404); return {...JSON.parse(row.body), revision:row.revision}; };
  const role = (c,uid) => isAdmin(uid) ? 'admin' : c.permissions[uid]?.role;
  const manager = r => ['admin','leader'].includes(r);
  function project(c,uid) {
    const r=role(c,uid); fail(r,'この合宿を閲覧する権限がありません',403);
    const out=clone(c); out.role=r;
    const own = p => p.familyUid===uid;
    for(const p of values(out.participants)) { delete p.emergencyContact; delete p.care; delete p.consent; }
    if(['admin','leader','accountant','parent'].includes(r)) {
      const balances=totals(c).balances, groups=new Map();
      for(const p of values(c.participants)) {
        const k=p.familyUid?'family:'+p.familyUid:'person:'+p.id;
        const group=groups.get(k)||{names:[],amount:0};
        group.names.push(p.name); group.amount+=balances[p.id]?.due||0; groups.set(k,group);
      }
      out.sharedOutstanding=[...groups.values()].filter(x=>x.amount>0);
    }
    if (!manager(r)) {
      delete out.permissions;
      for(const p of values(out.participants)) {
        if(r!=='parent'||!own(p)) { delete p.emergencyContact; delete p.care; delete p.consent; }
      }
      delete out.emergency;
    }
    if(r==='parent') {
      const ownIds=new Set(values(c.participants).filter(own).map(p=>p.id));
      out.participants=Object.fromEntries(Object.entries(out.participants).filter(([id])=>ownIds.has(id)));
      for(const e of ['charges','payments','rides','roomAssignments']) out[e]=Object.fromEntries(Object.entries(out[e]).filter(([,x])=>ownIds.has(x.participantId)));
      out.transactions={}; out.checks={}; out.vehicles={}; out.rooms={};
      out.announcements=Object.fromEntries(Object.entries(out.announcements).filter(([,x])=>x.audience==='all'));
      out.checklists=Object.fromEntries(Object.entries(out.checklists).filter(([,x])=>x.audience==='all'||x.assignee===uid));
      for(const x of values(out.announcements)) x.readBy = x.readBy?.[uid] ? {[uid]:x.readBy[uid]} : {};
    }
    if(r==='staff') for(const e of financial) out[e]={};
    if(r==='accountant') {
      out.participants=Object.fromEntries(values(out.participants).map(p=>[p.id,{id:p.id,name:p.name,kind:p.kind,familyUid:p.familyUid,response:p.response}]));
      out.checks={}; out.rides={}; out.vehicles={}; out.rooms={}; out.roomAssignments={};
      out.announcements=Object.fromEntries(Object.entries(out.announcements).filter(([,x])=>x.audience==='all'));
    }
    out.totals=totals(out);
    return out;
  }
  function validate(c,e,x,uid) {
    fail(key(x.id),'IDが不正です');
    const participant = id => fail(key(id)&&Object.hasOwn(c.participants,id),'参加者が見つかりません');
    if(e==='participants') {
      fail(text(x.name,100)&&x.name.trim(),'氏名を入力してください');
      fail(['player','coach','parent','other'].includes(x.kind),'参加区分が不正です');
      fail(['yes','no','pending'].includes(x.response),'出欠が不正です');
      if(x.memberId) {fail(key(x.memberId),'名簿IDが不正です');fail(!values(c.participants).some(p=>p.id!==x.id&&p.memberId===x.memberId),'名簿から登録済みの参加者です');}
      fail(!x.familyUid||key(x.familyUid),'家族UIDが不正です');
    }
    if(e==='schedule') {
      fail(day(x.date)&&x.date>=c.start&&x.date<=c.end,'行程の日付は合宿期間内にしてください');
      fail(/^([01]\d|2[0-3]):[0-5]\d$/.test(x.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x.end)&&x.start<x.end,'開始・終了時間を確認してください');
      fail(text(x.title,150)&&x.title.trim(),'行程名を入力してください');
      fail(!x.mapUrl||safeURL(x.mapUrl),'地図リンクはHTTPSにしてください');
    }
    if(['vehicles','rooms'].includes(e)) {
      fail(text(x.name,100)&&x.name.trim()&&Number.isInteger(x.capacity)&&x.capacity>0&&x.capacity<=100,'名称と1〜100人の定員を入力してください');
      if(e==='vehicles') {
        fail(['outbound','return'].includes(x.direction),'往路・復路を選択してください');
        fail(!x.status||['waiting','moving','resting','arrived'].includes(x.status),'車両の移動状況が不正です');
        fail(!x.driverUid||key(x.driverUid),'担当成人UIDが不正です');
        fail(!x.shareUrl||safeURL(x.shareUrl),'共有リンクはHTTPSにしてください');
      }
    }
    if(e==='rides'||e==='roomAssignments') {
      participant(x.participantId); fail(c.participants[x.participantId].response==='yes','参加予定者のみ割り当てできます');
      const target=e==='rides'?c.vehicles[x.vehicleId]:c.rooms[x.roomId]; fail(target,'割当先がありません');
      if(e==='roomAssignments') fail(c.participants[x.participantId].overnight,'宿泊する参加者のみ割り当てできます');
      const other=values(c[e]).filter(y=>y.id!==x.id);
      fail(!other.some(y=>y.participantId===x.participantId&&(e!=='rides'||c.vehicles[y.vehicleId].direction===target.direction)),'同じ行程で二重に割り当てできません');
      fail(other.filter(y=>e==='rides'?y.vehicleId===x.vehicleId:y.roomId===x.roomId).length<target.capacity,'定員超過です。割り当てを見直してください');
    }
    if(e==='checks') {
      participant(x.participantId);
      fail(text(x.checkpoint,100)&&x.checkpoint.trim(),'点呼の名称を入力してください');
      fail(['confirmed','missing','absent'].includes(x.status),'点呼状態が不正です');
      fail(!values(c.checks).some(y=>y.id!==x.id&&y.participantId===x.participantId&&y.checkpoint===x.checkpoint),'同じ点呼結果が存在します。既存の記録を更新してください');
    }
    if(financial.includes(e)) {
      fail(money(x.amount),'金額は0〜1億円の整数で入力してください');
      if(e!=='transactions') participant(x.participantId);
      if(e==='charges') fail(day(x.due),'支払期限を入力してください');
      if(e==='payments') {
        fail(['payment','refund'].includes(x.kind)&&day(x.date),'入金区分・日付が不正です');
        fail(['cash','transfer','other'].includes(x.method),'支払方法が不正です');
        fail(!values(c.payments).some(y=>y.id!==x.id&&!y.void&&!x.void&&y.reference===x.reference)&&text(x.reference,150)&&x.reference.trim(),'入金識別番号が重複しているか未入力です');
      }
      if(e==='transactions') {
        fail(['income','expense'].includes(x.kind)&&day(x.date),'取引区分・日付が不正です');
        fail(text(x.category,100)&&x.category.trim()&&x.category!=='参加費','参加費は入金台帳から自動集計します。その他の科目を指定してください');
        fail(money(x.budget||0),'予算額が不正です');
      }
    }
    if(e==='announcements') fail(text(x.title,150)&&x.title.trim()&&text(x.body,5000)&&['all','staff'].includes(x.audience),'お知らせの入力を確認してください');
    if(e==='checklists') fail(text(x.title,150)&&x.title.trim()&&['all','staff'].includes(x.audience),'準備項目を確認してください');
    if(e==='emergency') fail(text(x.title,150)&&x.title.trim()&&text(x.body,5000),'緊急連絡情報を確認してください');
  }
  function audit(c,uid,action,entity,record,before,after) {
    const redact=x=>{if(!x)return null;const y=clone(x);delete y.care;delete y.emergencyContact;delete y.consent;return y;};
    db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),c,uid,new Date().toISOString(),action,entity||'',record||'',JSON.stringify(redact(before)),JSON.stringify(redact(after)));
  }
  function mutate(uid,body) {
    fail(key(body.requestId),'操作IDが不正です');
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing=db.prepare('SELECT result,signature FROM requests WHERE actor=? AND id=?').get(uid,body.requestId);
      if(existing) { fail(existing.signature===fingerprint(body),'操作IDが別の内容で使われています。最新情報を取得してください',409);db.exec('COMMIT'); return JSON.parse(existing.result); }
      let c, before=null, after=null;
      if(body.action==='create') {
        fail(isAdmin(uid),'新規作成はシステム管理者が行ってください',403);
        c={id:randomUUID(),revision:0,permissions:{[uid]:{role:'leader'}},...Object.fromEntries(entities.map(e=>[e,{}]))};
        Object.assign(c,pickMeta(body.data)); validateMeta(c);
        fail(!db.prepare('SELECT body FROM camps').all().some(row=>{const old=JSON.parse(row.body);return old.name===c.name&&old.start===c.start;}),'同じ名前・開始日の合宿が既にあります');
        db.prepare('INSERT INTO camps VALUES(?,?,?)').run(c.id,0,JSON.stringify(c));
      } else {
        c=get(body.campId); const r=role(c,uid);
        fail(r,'この合宿を変更する権限がありません',403);
        fail(body.revision===c.revision,'別の担当者が更新しました。最新情報を読み直してから保存してください',409);
        if(body.action==='meta') {
          fail(manager(r),'設定変更の権限がありません',403); before=pickMeta(c);
          Object.assign(c,pickMeta(body.data)); validateMeta(c); after=pickMeta(c);
          for(const x of values(c.schedule))validate(c,'schedule',x,uid);
          if(c.archived||c.status!=='実施中'){
            db.prepare('DELETE FROM locations WHERE camp=?').run(c.id);
            db.prepare('DELETE FROM location_sessions WHERE camp=?').run(c.id);
          }
        } else if(body.action==='eraseSensitive') {
          fail(manager(r),'個人情報削除の権限がありません',403);
          for(const p of values(c.participants)){delete p.care;delete p.emergencyContact;delete p.consent;}
          c.emergency={};
          db.prepare('DELETE FROM locations WHERE camp=?').run(c.id);
          db.prepare('DELETE FROM location_sessions WHERE camp=?').run(c.id);
          db.prepare("DELETE FROM audit WHERE camp=? AND entity='emergency'").run(c.id);
        } else if(body.action==='permission') {
          fail(isAdmin(uid),'権限の割当はシステム管理者のみ行えます',403);
          fail(key(body.data.uid)&&(roles.includes(body.data.role)||body.data.role==='revoke'),'権限設定が不正です');
          before=c.permissions[body.data.uid];
          if(body.data.role==='revoke'){
            delete c.permissions[body.data.uid];
            for(const v of values(c.vehicles).filter(v=>v.driverUid===body.data.uid)){
              db.prepare('DELETE FROM locations WHERE camp=? AND vehicle=?').run(c.id,v.id);
              db.prepare('DELETE FROM location_sessions WHERE camp=? AND vehicle=?').run(c.id,v.id);
            }
          }
          else c.permissions[body.data.uid]={role:body.data.role};
          after=c.permissions[body.data.uid];
        } else if(body.action==='duplicate') {
          fail(manager(r),'複製の権限がありません',403);
          const source=c;
          c={...pickMeta(source),...pickMeta(body.data),id:randomUUID(),revision:0,status:'準備中',archived:false,permissions:{[uid]:{role:'leader'}},...Object.fromEntries(entities.map(e=>[e,{}]))};
          validateMeta(c);
          const delta=Date.parse(c.start)-Date.parse(source.start);
          for(const e of ['schedule','checklists','rooms']) for(const old of values(source[e])) {
            const x={...old,id:randomUUID()};
            if(e==='schedule') x.date=new Date(Date.parse(old.date)+delta).toISOString().slice(0,10);
            if(e==='checklists'){x.done=false; x.assignee='';x.due='';}
            c[e][x.id]=x; validate(c,e,x,uid);
          }
          db.prepare('INSERT INTO camps VALUES(?,?,?)').run(c.id,0,JSON.stringify(c));
        } else if(body.action==='vehicleStatus') {
          const v=c.vehicles[body.data?.id];fail(v&&Object.hasOwn(c.vehicles,body.data.id),'車両が見つかりません',404);
          fail(manager(r)||v.driverUid===uid,'この車両を報告する権限がありません',403);
          fail(['moving','resting','arrived'].includes(body.data.status),'移動状況が不正です');
          before=clone(v);v.status=body.data.status;
          if(v.status==='moving')v.actualDeparture=new Date().toISOString();
          if(v.status==='arrived'){
            v.actualArrival=new Date().toISOString();
            db.prepare('DELETE FROM locations WHERE camp=? AND vehicle=?').run(c.id,v.id);
            db.prepare('DELETE FROM location_sessions WHERE camp=? AND vehicle=?').run(c.id,v.id);
          }
          after=v;
        } else if(body.action==='read') {
          const x=c.announcements[body.data.id]; fail(x&&(x.audience==='all'||manager(r)||r==='staff'),'お知らせが見つかりません',404);
          x.readBy={...x.readBy,[uid]:new Date().toISOString()};
        } else {
          const e=body.entity; fail(entities.includes(e),'項目が不正です');
          const allowed=manager(r)||(r==='accountant'&&financial.includes(e))||(r==='staff'&&['checks','announcements','checklists'].includes(e));
          const x=clone(body.data||{}); if(e==='participants') fail(!['care','emergencyContact','consent'].some(k=>Object.hasOwn(x,k)),'緊急連絡先・健康情報は登録できません'); fail(key(x.id),'IDが不正です'); before=c[e][x.id]||null;
          if(r==='parent'&&e==='participants'&&body.action==='save') {
            fail(before?.familyUid===uid,'他の家庭の参加情報は変更できません',403);
            const response=x.response, overnight=x.overnight;
            for(const k of Object.keys(x))delete x[k];
            Object.assign(x,before,{response,overnight});
          } else fail(allowed,'この項目を編集する権限がありません',403);
          if(body.action==='delete') {
            fail(before,'対象がありません',404);
            fail(!financial.includes(e),'会計記録は削除せず取消・返金で訂正してください');
            if(e==='participants') fail(!['rides','roomAssignments','checks',...financial].some(t=>values(c[t]).some(y=>y.participantId===x.id)),'関連する配車・点呼・会計記録があります。削除せず不参加に変更してください');
            if(e==='vehicles') fail(!values(c.rides).some(y=>y.vehicleId===x.id),'乗車割当を先に解除してください');
            if(e==='rooms') fail(!values(c.roomAssignments).some(y=>y.roomId===x.id),'部屋割当を先に解除してください');
            delete c[e][x.id];
            if(e==='vehicles'){
              db.prepare('DELETE FROM locations WHERE camp=? AND vehicle=?').run(c.id,x.id);
              db.prepare('DELETE FROM location_sessions WHERE camp=? AND vehicle=?').run(c.id,x.id);
            }
          } else {
            fail(body.action==='save','操作が不正です');
            const clean=pickEntity(e,x);
            validate(c,e,clean,uid);
            if(e==='checks'){clean.checkedBy=uid;clean.checkedAt=new Date().toISOString();}
            if(e==='announcements') clean.readBy=before&&['title','body','audience'].every(k=>before[k]===clean[k])?(before.readBy||{}):{};
            if(e==='participants') {
              if(before?.memberId) clean.memberId=before.memberId;
              if(clean.response!=='yes') for(const t of ['rides','roomAssignments']) for(const [id,y] of Object.entries(c[t])) if(y.participantId===x.id) delete c[t][id];
              if(!clean.overnight) for(const [id,y] of Object.entries(c.roomAssignments)) if(y.participantId===x.id) delete c.roomAssignments[id];
            }
            c[e][x.id]=clean; after=clean;
            if(['vehicles','rooms'].includes(e)) {
              const count=values(e==='vehicles'?c.rides:c.roomAssignments).filter(y=>e==='vehicles'?y.vehicleId===x.id:y.roomId===x.id).length;
              fail(count<=clean.capacity,'現在の割当人数より定員を少なくできません');
              if(e==='vehicles'&&before?.direction!==clean.direction) fail(count===0,'往復の変更前に乗車割当を解除してください');
              if(e==='vehicles'&&(clean.status==='arrived'||['driverUid','sharingStart','sharingEnd'].some(k=>before?.[k]!==clean[k]))){
                db.prepare('DELETE FROM locations WHERE camp=? AND vehicle=?').run(c.id,x.id);
                db.prepare('DELETE FROM location_sessions WHERE camp=? AND vehicle=?').run(c.id,x.id);
              }
            }
          }
        }
      }
      const t=totals(c);
      fail(Object.values(t.balances).every(x=>x.received>=0),'返金額が入金済額を超えています');
      c.revision++;
      db.prepare('UPDATE camps SET revision=?,body=? WHERE id=?').run(c.revision,JSON.stringify(c),c.id);
      audit(c.id,uid,body.action,body.entity,body.data?.id,before,after);
      const result={id:c.id,revision:c.revision};
      db.prepare('INSERT INTO requests VALUES(?,?,?,?)').run(uid,body.requestId,JSON.stringify(result),fingerprint(body));
      db.exec('COMMIT');return result;
    } catch(e){db.exec('ROLLBACK');throw e;}
  }
  function location(uid,id,vehicleId,input) {
    const c=get(id),v=c.vehicles[vehicleId]; fail(v,'車両が見つかりません',404);
    fail(role(c,uid)&&v.driverUid===uid,'位置報告は登録された担当成人のみ可能です',403);
    if(input.stop) {db.prepare('DELETE FROM location_sessions WHERE camp=? AND vehicle=?').run(id,vehicleId);db.prepare('DELETE FROM locations WHERE camp=? AND vehicle=?').run(id,vehicleId);return {stopped:true};}
    const now=Date.now(),parseTime=t=>Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t||'')?t+':00+09:00':t);
    const start=parseTime(v.sharingStart),end=parseTime(v.sharingEnd);
    fail(Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&now<=end&&end-start<=12*3600000,'設定された移動時間（最大12時間）外です');
    const japanDay=at=>new Date(at).toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
    fail(japanDay(start)>=c.start&&japanDay(end)<=c.end&&!c.archived&&c.status==='実施中'&&v.status!=='arrived','実施中の合宿期間内・到着前の車両だけ位置共有できます');
    if(input.start) {
      fail(input.consent===true&&input.adult===true,'担当成人の同意が必要です');
      const token=randomUUID();
      db.prepare('INSERT OR REPLACE INTO location_sessions VALUES(?,?,?,?)').run(id,vehicleId,token,end);
      db.prepare('DELETE FROM locations WHERE camp=? AND vehicle=?').run(id,vehicleId);
      return {token,expires:end};
    }
    const session=db.prepare('SELECT token FROM location_sessions WHERE camp=? AND vehicle=? AND expires>?').get(id,vehicleId,now);
    fail(session&&session.token===input.token,'位置共有が停止されています。再度同意して開始してください',403);
    fail(Number.isFinite(input.lat)&&Math.abs(input.lat)<=90&&Number.isFinite(input.lng)&&Math.abs(input.lng)<=180&&Number.isFinite(input.accuracy)&&input.accuracy>=0,'位置情報が不正です');
    const loc={lat:input.lat,lng:input.lng,accuracy:input.accuracy,at:new Date(now).toISOString(),expires:Math.min(end,now+30*60000)};
    db.prepare('INSERT OR REPLACE INTO locations VALUES(?,?,?,?)').run(id,vehicleId,JSON.stringify(loc),Math.min(end,now+30*60000));
    return loc;
  }
  return {db,isAdmin,get,role,project,mutate,location,
    purge:()=>{db.prepare('DELETE FROM location_sessions WHERE expires<=?').run(Date.now());return db.prepare('DELETE FROM locations WHERE expires<=?').run(Date.now());},
    list:uid=>db.prepare('SELECT body FROM camps').all().map(x=>JSON.parse(x.body)).filter(c=>role(c,uid)).map(c=>({id:c.id,name:c.name,start:c.start,end:c.end,place:c.place,status:c.status,archived:c.archived})),
    locations:(uid,id)=>{fail(manager(role(get(id),uid)),'現在地閲覧の権限がありません',403);return db.prepare('SELECT vehicle,body FROM locations WHERE camp=? AND expires>?').all(id,Date.now()).map(x=>({vehicleId:x.vehicle,...JSON.parse(x.body)}));},
    history:(uid,id)=>{fail(manager(role(get(id),uid)),'履歴閲覧の権限がありません',403);return db.prepare('SELECT id,actor,at,action,entity,record FROM audit WHERE camp=? ORDER BY at DESC LIMIT 100').all(id);},
    close:()=>db.close()};
}
const fields={
  participants:'id name grade kind response overnight familyUid memberId guardian dates',
  schedule:'id date start end title detail place address mapUrl owner notes belongings order',
  vehicles:'id name driver phone capacity direction departure arrival actualDeparture actualArrival status driverUid sharingStart sharingEnd shareUrl notes',
  rides:'id participantId vehicleId boarded',
  checks:'id participantId checkpoint status place',
  rooms:'id name type capacity owner notes',
  roomAssignments:'id participantId roomId',
  charges:'id participantId amount due notes',
  payments:'id participantId amount kind date method reference familyReference notes void',
  transactions:'id kind category amount budget date payer settled notes void',
  announcements:'id title body audience pinned',
  checklists:'id title audience assignee due done',
  emergency:'id title body phone'
};
function pickEntity(e,x) {
  const result={};
  for(const f of fields[e].split(' ')) if(x[f]!==undefined) {
    fail(['string','number','boolean'].includes(typeof x[f]),'入力形式が不正です');
    fail(typeof x[f]!=='string'||x[f].length<=5000,'入力が長すぎます');result[f]=x[f];
  }
  return result;
}
const metaFields='name start end place hotel hotelAddress meeting departure dismissal dismissalTime owner grades capacity deadline fee paymentDeadline guide status archived'.split(' ');
function pickMeta(x={}) {return Object.fromEntries(metaFields.filter(k=>x[k]!==undefined).map(k=>[k,x[k]]));}
function validateMeta(c) {
  fail(text(c.name,150)&&c.name.trim()&&day(c.start)&&day(c.end)&&c.start<=c.end,'合宿名と開始日・終了日を確認してください');
  fail(Date.parse(c.end)-Date.parse(c.start)<=31*86400000,'合宿期間は32日以内にしてください');
  fail(['準備中','募集中','実施中','終了','精算完了'].includes(c.status),'実施状況が不正です');
  for(const f of metaFields) if(c[f]!==undefined) fail(['string','number','boolean'].includes(typeof c[f])&&(typeof c[f]!=='string'||c[f].length<=5000),'合宿情報の入力形式が不正です');
}
