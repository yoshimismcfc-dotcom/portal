import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCampDirectory} from '../camp/directory.mjs';

function fakeFirestore(){
 const calls=[];
 const db={
  collection(name){
   calls.push('collection:'+name);
   return {
    orderBy(column,direction){
     calls.push('order:'+column+':'+direction);
     return {
      limit(count){
       calls.push('limit:'+count);
       return {
        async get(options){
         calls.push('source:'+options.source);
         return {docs:[{id:'11111111-1111-4111-8111-111111111111',data:()=>({name:'春合宿',start:'2027-03-13'})}]};
        }
       };
      }
     };
    }
   };
  }
 };
 return {db,calls};
}
test('合宿一覧はログイン・合言葉・端末IDなしでクラウドから読み込む',async()=>{
 const {db,calls}=fakeFirestore();
 const directory=createCampDirectory(db);
 const items=await directory.browse();
 assert.equal(items[0].name,'春合宿');
 assert.equal(items[0].id,'11111111-1111-4111-8111-111111111111');
 assert.deepEqual(calls,['collection:campShared','order:start:desc','limit:100','source:server']);
});
test('全合宿一覧は件数上限ありで公開、旧端末承認や別領域は公開しない',()=>{
 const rules=readFileSync(new URL('../firebase-free/firestore.rules',import.meta.url),'utf8');
 assert.match(rules,/match \/campShared\/\{c\}/);
 assert.match(rules,/allow list: if request\.query\.limit != null && request\.query\.limit <= 100/);
 assert.match(rules,/allow get: if validId\(c\)/);
 assert.match(rules,/allow create: if validId\(c\) && meta\(\)/);
 assert.match(rules,/allow delete: if false/);
 assert.match(rules,/match \/campDirectoryReaders\/\{uid\}/);
 assert.match(rules,/allow list, create, update, delete: if false/);
 assert.doesNotMatch(rules,/allow list: if true/);
});
test('合宿画面は承認申請とログインなしで一覧を開く',()=>{
 const app=readFileSync(new URL('../camp/free-app.mjs',import.meta.url),'utf8');
 assert.match(app,/createCampDirectory\(firebase\.firestore\(\)\)/);
 assert.doesNotMatch(app,/requestApproval|signInAnonymously|この端末の利用を申請する|Googleでログインして一覧を表示/);
 assert.doesNotMatch(app,/公開設定のため、サイトにアクセスした誰でも/);
 assert.doesNotMatch(app,/公開型の合宿です。誰でも氏名/);
 assert.doesNotMatch(app,/共有リンクがなくても誰でも参加者・金額/);
 assert.match(app,/クラウド一覧を表示するためのFirestore公開設定が未反映/);
 const page=readFileSync(new URL('../camps.html',import.meta.url),'utf8');
 assert.doesNotMatch(page,/参加者の出欠・参加費・入金履歴も公開されるため/);
 assert.match(page,/無料版の使い方/);
});
