// 架空データ・テスト専用認証。実際のFirebaseへ接続しないブラウザ統合検査。
import {createRequire} from 'node:module';
import http from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStore} from '../camp-server/store.mjs';
import {createAPI} from '../camp-server/http.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(process.env.CAMP_QA_OUTPUT||'work/camp-qa');mkdirSync(out,{recursive:true});
const store=createStore(':memory:',['test-admin']);
const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
const cid=store.mutate('test-admin',{action:'create',requestId:randomUUID(),data:{name:'検証用・春合宿（架空データ）',start:today,end:today,status:'実施中',place:'検証用会場',hotel:'検証用ホテル'}}).id;
const command=(entity,data,action='save')=>store.mutate('test-admin',{action,entity,data,campId:cid,revision:store.get(cid).revision,requestId:randomUUID()});
command('participants',{id:'p1',name:'テスト選手あお',kind:'player',grade:'4年',response:'yes',overnight:true,familyUid:'test-parent'});
command('participants',{id:'p2',name:'テスト選手そら',kind:'player',grade:'5年',response:'pending',familyUid:'other-parent'});
command('vehicles',{id:'v1',name:'テスト1号車',driver:'テスト成人',capacity:4,direction:'outbound',status:'waiting',driverUid:'test-admin',sharingStart:new Date(Date.now()-60000).toISOString(),sharingEnd:new Date(Date.now()+3600000).toISOString()});
command('rooms',{id:'room1',name:'検証用101号室',capacity:4,owner:'テストコーチ'});
command('schedule',{id:'s1',title:'集合・出発前の点呼',date:today,start:'08:00',end:'08:30',place:'集合広場'});
command('charges',{id:'bill1',participantId:'p1',amount:10000,due:today});
command('payments',{id:'pay1',participantId:'p1',amount:5000,date:today,method:'cash',kind:'payment',reference:'QA-001'});
command('announcements',{id:'n1',title:'検証用の重要連絡',body:'これは動作確認専用の架空データです。',audience:'all',pinned:true});
command('checklists',{id:'todo',title:'持ち物の確認',audience:'all',done:false});
command(undefined,{uid:'test-parent',role:'parent'},'permission');
const api=createAPI(store,{origin:'https://portal.test',verifyToken:async uid=>({uid,email_verified:true,firebase:{sign_in_provider:'password'}}),readMembers:async()=>({m3:{name:'名簿テスト選手',grade:'3年'}})});
const staticServer=http.createServer((req,res)=>{
  const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!path.startsWith(root+'\\')&&!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  try{const content=readFileSync(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpeg':'image/jpeg','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(content);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>api.listen(0,'127.0.0.1',r));await new Promise(r=>staticServer.listen(0,'127.0.0.1',r));
const apiBase='http://127.0.0.1:'+api.address().port,base='http://127.0.0.1:'+staticServer.address().port;
const passed=[],errors=[];let browser;
try {
  browser=await chromium.launch({channel:'chrome',headless:true,downloadsPath:out});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',locale:'ja-JP',timezoneId:'Asia/Tokyo'});
  let uid='test-admin',networkFailure=false,lostResponse=false;
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.protocol==='blob:')return route.continue();
    if(url.hostname==='camp-api.test') {
      if(networkFailure)return route.abort();
      const response=await fetch(apiBase+url.pathname,{method:route.request().method(),headers:{Authorization:'Bearer '+uid,...(route.request().postData()?{'Content-Type':'application/json'}:{})},body:route.request().postData()||undefined});
      if(lostResponse&&url.pathname==='/api/command'){lostResponse=false;return route.abort();}
      return route.fulfill({status:response.status,body:await response.text(),contentType:'application/json'});
    }
    if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'text/javascript',body:`window.firebase={auth:{Auth:{Persistence:{SESSION:'session'}}}};window.FIREBASE_AUTH={setPersistence:async()=>{},onAuthStateChanged:fn=>fn({uid:'${uid}',getIdToken:async()=>'test-token'}),signOut:async()=>{}};window.onFirebaseReady=fn=>fn();`});
    if(url.pathname==='/camp/config.js')return route.fulfill({contentType:'text/javascript',body:'window.SMC_CAMP_CONFIG={apiBase:"https://camp-api.test"};'});
    if(url.hostname!=='127.0.0.1')return route.abort();
    return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/camps-api.html');await page.getByRole('button',{name:'合宿を開く',exact:true}).click();
  await page.getByRole('heading',{name:'検証用・春合宿（架空データ）'}).waitFor();
  const pass=title=>{passed.push(title);console.log('PASS '+title);};
  const tab=title=>page.locator('.tabs').getByRole('button',{name:title,exact:true}).click();
  const save=async()=>{await page.locator('#camp-submit').click();await page.waitForFunction(()=>!document.querySelector('#camp-dialog').open);};
  for(const width of [320,375,390,768,1440]){
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px 横あふれ');
  }pass('320〜1440pxでダッシュボードに横あふれなし');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(out,'mobile-dashboard.png'),fullPage:true});
  await tab('参加者');await page.getByRole('button',{name:'SMC名簿から選択'}).click();await page.locator('[name=memberId]').selectOption('m3');await page.locator('#camp-submit').click();
  await page.locator('#camp-dialog-title').filter({hasText:'新しく登録'}).waitFor();await save();assert.equal(Object.values(store.get(cid).participants).filter(p=>p.memberId==='m3').length,1);pass('既存名簿から氏名・学年を参照して保存');
  await page.getByRole('button',{name:'＋ 参加者を追加'}).click();assert.equal(await page.locator('#camp-form [name=care], #camp-form [name=emergencyContact], #camp-form [name=consent]').count(),0);await page.locator('#camp-form [name=name]').fill('画面追加テスト');await page.locator('#camp-form [name=response]').selectOption('yes');
  lostResponse=true;await page.locator('#camp-submit').click();await page.locator('#camp-form-error').filter({hasText:/./}).waitFor();await save();
  assert.equal(Object.values(store.get(cid).participants).filter(p=>p.name==='画面追加テスト').length,1);pass('保存後の応答喪失・再試行で二重登録なし');
  await tab('配車・現在地');await page.getByRole('button',{name:'乗車を割り当て',exact:true}).click();await page.locator('[name=participantId]').selectOption('p1');await page.locator('[name=vehicleId]').selectOption('v1');await save();assert.equal(Object.keys(store.get(cid).rides).length,1);pass('画面から乗車割当を保存');
  await tab('点呼');await page.getByRole('article').filter({has:page.getByRole('heading',{name:'テスト選手あお',exact:true})}).getByRole('button',{name:'確認済み',exact:true}).click();await page.locator('[name=place]').fill('集合広場');await save();assert.equal(Object.values(store.get(cid).checks)[0].checkedBy,'test-admin');pass('画面から点呼を保存し担当者・時刻を記録');
  await tab('部屋割り');await page.getByRole('button',{name:'宿泊者を割り当て'}).click();await page.locator('[name=participantId]').selectOption('p1');await page.locator('[name=roomId]').selectOption('room1');await save();pass('画面から部屋割当を保存');
  await tab('集金');assert.ok((await page.locator('#camp-content').innerText()).includes('5,000'));await page.getByRole('button',{name:'入金・返金を登録'}).click();await page.locator('[name=participantId]').selectOption('p1');await page.locator('[name=amount]').fill('2000');await page.locator('[name=reference]').fill('QA-002');await save();assert.equal(store.project(store.get(cid),'test-admin').totals.outstanding,3000);pass('画面から一部入金を登録し集計更新');
  await tab('会計');await page.getByRole('button',{name:'＋ 取引を追加'}).click();await page.locator('[name=category]').selectOption('宿泊費');await page.locator('[name=amount]').fill('3000');await page.locator('[name=payer]').fill('検証コーチ');await save();
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('main').evaluate(e=>getComputedStyle(e).display),'block');await page.pdf({path:resolve(out,'accounting-a4.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});await page.emulateMedia({media:'screen'});pass('日本語会計報告のA4 PDF生成（目視検証は別途）');
  await tab('配車・現在地');page.on('dialog',d=>d.accept());
  await page.evaluate(()=>{Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(_ok,err)=>err({code:1}),watchPosition:(_ok,err)=>{setTimeout(()=>err({code:1}),0);return 1;},clearWatch:()=>{}}});});
  await page.getByRole('button',{name:'現在地を1回報告'}).click();await page.locator('#camp-message').filter({hasText:'位置を取得できませんでした'}).waitFor();assert.equal(store.locations('test-admin',cid).length,0);pass('GPS権限拒否後も画面と手動報告を維持');
  await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=ok=>ok({coords:{latitude:36,longitude:139,accuracy:12}});});
  await page.getByRole('button',{name:'現在地を1回報告'}).click();await page.locator('#camp-message').filter({hasText:'位置を報告しました'}).waitFor();assert.equal(store.locations('test-admin',cid).length,1);
  await page.getByRole('button',{name:'現在地を更新',exact:true}).click();await page.getByText(/最終更新 0分前/).waitFor();await page.getByRole('button',{name:'共有停止・位置削除'}).click();await page.locator('#camp-message').filter({hasText:'削除しました'}).waitFor();assert.equal(store.locations('test-admin',cid).length,0);pass('位置報告・最終更新表示・停止と削除（GPSスタブ）');
  for(const title of ['概要','行程','参加者','配車・現在地','点呼','部屋割り','集金','会計','お知らせ','持ち物・準備','緊急連絡','設定・履歴']) {
    await tab(title);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),title+' モバイル横あふれ');
  }pass('全12タブを390pxで表示');
  await page.locator('.theme-toggle').click();await tab('概要');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(out,'mobile-light.png'),fullPage:true});
  assert.equal(await page.locator('body').getAttribute('data-theme'),'light');
  assert.ok(await page.locator('.camp-shell button:visible').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44)));
  pass('ライトモードと主要ボタン44px以上');await page.locator('.theme-toggle').click();
  await tab('集金');await page.evaluate(()=>{const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.campExportText=blob.text();return create(blob);};});
  await page.getByRole('button',{name:'入金履歴CSV',exact:true}).click();const csv=await page.evaluate(()=>window.campExportText);writeFileSync(resolve(out,'payments.csv'),csv);
  assert.ok(csv.includes('テスト選手あお'));assert.ok(csv.includes('入金識別番号'));assert.ok(!csv.includes('検証用配慮事項'));pass('日本語CSV生成と機密情報の除外（OSへのダウンロードは未確認）');
  await tab('行程');await page.getByRole('button',{name:'＋ 行程を追加'}).click();await page.locator('[name=start]').fill('10:00');await page.locator('[name=end]').fill('11:00');await page.locator('[name=title]').fill('オフライン再試行');
  networkFailure=true;await page.locator('#camp-submit').click();await page.locator('#camp-form-error').filter({hasText:/./}).waitFor();assert.equal(await page.locator('[name=title]').inputValue(),'オフライン再試行');networkFailure=false;await save();pass('通信切断時の入力保持と復旧後保存');
  await page.setViewportSize({width:1440,height:1000});await tab('概要');await page.screenshot({path:resolve(out,'desktop-dashboard.png'),fullPage:true});
  await page.getByRole('button',{name:'合宿一覧',exact:true}).click();await page.getByRole('button',{name:'＋ 合宿を作成'}).click();await page.locator('[name=name]').fill('画面から新規作成した合宿');await page.locator('[name=start]').fill('2027-03-13');await page.locator('[name=end]').fill('2027-03-14');await save();
  await page.getByRole('heading',{name:'画面から新規作成した合宿',exact:true}).waitFor();await page.getByRole('button',{name:'合宿一覧',exact:true}).click();await page.getByRole('heading',{name:'画面から新規作成した合宿',exact:true}).waitFor();pass('新規作成が一覧と詳細へ反映');
  uid='test-parent';await page.reload();await page.getByRole('button',{name:'合宿を開く',exact:true}).click();await tab('参加者');
  assert.ok(!(await page.locator('#camp-content').innerText()).includes('テスト選手そら'));assert.equal(await page.locator('.tabs').getByRole('button',{name:'会計',exact:true}).count(),0);pass('保護者画面で他家庭の情報・運営タブを非表示');
  await page.getByRole('button',{name:'出欠を回答'}).click();await page.locator('[name=response]').selectOption('no');await save();assert.equal(store.get(cid).participants.p1.response,'no');pass('保護者が自分の家族の出欠を保存');
  command('charges',{id:'other-charge',participantId:'p2',amount:6000,due:today});
  await page.reload();await page.getByRole('button',{name:'合宿を開く',exact:true}).click();await tab('集金');
  assert.ok((await page.locator('#camp-content').innerText()).includes('テスト選手そら'));assert.ok((await page.locator('#camp-content').innerText()).includes('6,000'));
  assert.equal(store.project(store.get(cid),'test-parent').charges['other-charge'],undefined);pass('他家庭の未納額を共有し請求明細は非公開');
  assert.deepEqual(errors,[]);pass('ブラウザJavaScript例外なし');
  writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({passed,errors,realFirebaseTested:false,realGPSTested:false,nativeDownloadTested:false},null,2));
}finally{await browser?.close();await new Promise(r=>staticServer.close(r));await new Promise(r=>api.close(r));store.close();}
