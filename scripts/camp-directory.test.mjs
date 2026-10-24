import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCampDirectory} from '../camp/directory.mjs';

function fakeSdk(){
 const accesses=[],auth={
  currentUser:null,
  onAuthStateChanged(cb){queueMicrotask(()=>cb(this.currentUser));return ()=>{};},
  async signInWithPopup(provider){auth.currentUser={uid:'approved-coach',email:'coach@example.jp'};return {user:auth.currentUser,provider};},
  async signOut(){auth.currentUser=null;}
 };
 const firestore={collection(name){
  accesses.push('collection:'+name);
  return {orderBy(k,dir){accesses.push('order:'+k+':'+dir);return {limit(n){accesses.push('limit:'+n);return {async get(o){accesses.push('source:'+o.source);return {docs:[{id:'11111111-1111-4111-8111-111111111111',data:()=>({name:'春合宿',start:'2027-03-13'})}]};}};}};};
 }};
 const apps=[{name:'[DEFAULT]'}],sdk={apps,initializeApp(config,name){const app={name,auth:()=>auth,firestore:()=>firestore};apps.push(app);return app;}};
 sdk.auth={GoogleAuthProvider:class GoogleAuthProvider{}};
 return {sdk,auth,accesses};
}
test('別名Firebaseアプリが既存の認証セッションを変更せず、一覧を読める',async()=>{
 const {sdk,auth,accesses}=fakeSdk(),directory=createCampDirectory(sdk,{projectId:'test'});
 assert.equal(sdk.apps[0].name,'[DEFAULT]');
 assert.equal(sdk.apps[1].name,'smc-camp-directory');
 await directory.ready();
 await assert.rejects(directory.browse(),/Googleログインが必要/);
 assert.deepEqual(accesses,[]);
 await directory.signIn();
 const all=await directory.browse();
 assert.equal(all[0].name,'春合宿');assert.equal(all[0].id,'11111111-1111-4111-8111-111111111111');
 assert.deepEqual(accesses,['collection:campShared','order:start:desc','limit:100','source:server']);
 await directory.signOut();assert.equal(auth.currentUser,null);
});
test('FirestoreはUID許可済みの認証利用者だけに一覧を公開するルール',()=>{
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
