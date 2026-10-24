import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCampDirectory} from '../camp/directory.mjs';

function fakeSdk(){
 const accesses=[];
 const auth={
  currentUser:null,
  onAuthStateChanged(callback){queueMicrotask(()=>callback(this.currentUser));return ()=>{};},
  async signInWithPopup(provider){this.currentUser={uid:'approved-coach',email:'coach@example.jp'};return {user:this.currentUser,provider};},
  async signOut(){this.currentUser=null;}
 };
 const firestore={
  collection(name){
   accesses.push('collection:'+name);
   return {
    orderBy(key,direction){
     accesses.push('order:'+key+':'+direction);
     return {
      limit(count){
       accesses.push('limit:'+count);
       return {
        async get(options){
         accesses.push('source:'+options.source);
         return {docs:[{id:'11111111-1111-4111-8111-111111111111',data:()=>({name:'春合宿',start:'2027-03-13'})}]};
        }
       };
      }
     };
    }
   };
  }
 };
 const apps=[{name:'[DEFAULT]'}];
 const sdk={
  apps,
  initializeApp(config,name){
   const app={name,auth:()=>auth,firestore:()=>firestore};
   apps.push(app);
   return app;
  }
 };
 sdk.auth={GoogleAuthProvider:class GoogleAuthProvider{}};
 return {sdk,auth,accesses};
}

test('別名Firebaseアプリで既存認証を変更せずクラウド一覧を読める',async()=>{
 const {sdk,auth,accesses}=fakeSdk();
 const directory=createCampDirectory(sdk,{projectId:'test'});
 assert.equal(sdk.apps[0].name,'[DEFAULT]');
 assert.equal(sdk.apps[1].name,'smc-camp-directory');
 await directory.ready();
 await assert.rejects(directory.browse(),/Googleログインが必要/);
 assert.deepEqual(accesses,[]);
 await directory.signIn();
 const all=await directory.browse();
 assert.equal(all[0].name,'春合宿');
 assert.equal(all[0].id,'11111111-1111-4111-8111-111111111111');
 assert.deepEqual(accesses,['collection:campShared','order:start:desc','limit:100','source:server']);
 await directory.signOut();
 assert.equal(auth.currentUser,null);
});

test('FirestoreはUID許可済み・確認済みの認証利用者だけに合宿一覧を公開する',()=>{
 const rules=readFileSync(new URL('../firebase-free/firestore.rules',import.meta.url),'utf8');
 assert.match(rules,/match \/campDirectoryReaders\/\{uid\}/);
 assert.match(rules,/request\.auth\.uid == uid/);
 assert.match(rules,/request\.auth\.token\.email_verified == true/);
 assert.match(rules,/campDirectoryReaders\/\$\(request\.auth\.uid\)/);
 assert.match(rules,/\.data\.enabled == true/);
 assert.match(rules,/allow list: if directoryReader\(\)/);
 assert.match(rules,/allow get: if validId\(c\)/);
 assert.doesNotMatch(rules,/allow list: if true/);
});
