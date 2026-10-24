import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCampDirectory} from '../camp/directory.mjs';

function fakeSdk(){
 const accesses=[],applications=new Map(),apps=[{name:'[DEFAULT]'}];
 let signIns=0,persistence=null;
 const auth={
  currentUser:null,
  onAuthStateChanged(callback){queueMicrotask(()=>callback(this.currentUser));return ()=>{};},
  async setPersistence(value){persistence=value;},
  async signInAnonymously(){signIns++;this.currentUser={uid:'anonymous-device-123',isAnonymous:true};return {user:this.currentUser};}
 };
 const firestore={
  collection(name){
   accesses.push('collection:'+name);
   if(name==='campDirectoryRequests')return {doc(uid){return {
    async get(options){accesses.push('request-get:'+options.source);return {exists:applications.has(uid),data:()=>applications.get(uid)};},
    async set(value){if(applications.has(uid))throw Object.assign(new Error('already requested'),{code:'permission-denied'});applications.set(uid,value);}
   };}};
   return {orderBy(key,order){
    accesses.push('order:'+key+':'+order);
    return {limit(count){
     accesses.push('limit:'+count);
     return {async get(options){
      accesses.push('source:'+options.source);
      return {docs:[{id:'11111111-1111-4111-8111-111111111111',data:()=>({name:'春合宿',start:'2027-03-13'})}]};
     }};
    }};
   }};
  }
 };
 const sdk={apps,initializeApp(config,name){
  const app={name,auth:()=>auth,firestore:()=>firestore};apps.push(app);return app;
 }};
 sdk.auth={Auth:{Persistence:{LOCAL:'local'}}};
 sdk.firestore={FieldValue:{serverTimestamp:()=>'<serverTimestamp>'}};
 return {sdk,auth,accesses,applications,metrics:()=>({signIns,persistence})};
}
test('パスワードなしの匿名UIDがブラウザ内で永続化し既存の認証アプリと分離される',async()=>{
 const context=fakeSdk(),directory=createCampDirectory(context.sdk,{projectId:'demo'});
 assert.equal(context.sdk.apps[0].name,'[DEFAULT]');
 assert.equal(context.sdk.apps[1].name,'smc-camp-directory');
 assert.equal((await directory.ready()).uid,'anonymous-device-123');
 assert.equal(context.metrics().persistence,'local');
 assert.equal(context.metrics().signIns,1);
 await directory.ready();
 assert.equal(context.metrics().signIns,1);
 const camps=await directory.browse();
 assert.equal(camps[0].name,'春合宿');
 assert.deepEqual(context.accesses,['collection:campShared','order:start:desc','limit:100','source:server']);
});
test('利用申請は担当者名と端末UIDだけを一度登録し、再申請・空欄を拒否',async()=>{
 const ctx=fakeSdk(),directory=createCampDirectory(ctx.sdk,{projectId:'demo'});
 await directory.ready();
 assert.equal(await directory.application(),null);
 await assert.rejects(directory.requestApproval(''),/名前を40文字以内/);
 await directory.requestApproval('  担当コーチ  ');
 assert.deepEqual(await directory.application(),{label:'担当コーチ',createdAt:'<serverTimestamp>'});
 assert.equal(ctx.applications.size,1);
 await assert.rejects(directory.requestApproval('別名'),/already requested/);
});
test('全合宿一覧は承認端末限定、申請レコードは自分の端末からだけ作成可能',()=>{
 const rules=readFileSync(new URL('../firebase-free/firestore.rules',import.meta.url),'utf8');
 assert.match(rules,/match \/campDirectoryReaders\/\{uid\}/);
 assert.match(rules,/match \/campDirectoryRequests\/\{uid\}/);
 assert.match(rules,/request\.auth\.uid == uid/);
 assert.match(rules,/campDirectoryReaders\/\$\(request\.auth\.uid\)/);
 assert.match(rules,/\.data\.enabled == true/);
 assert.match(rules,/allow list: if directoryReader\(\)/);
 assert.match(rules,/request\.resource\.data\.createdAt == request\.time/);
 assert.doesNotMatch(rules,/allow list: if true/);
 assert.doesNotMatch(rules,/function directoryReader\(\).*email_verified/);
});
