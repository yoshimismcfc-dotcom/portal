import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createService} from '../camp/free-service.mjs';

globalThis.firebase = {firestore:{FieldValue:{serverTimestamp:()=> 'SERVER_TIMESTAMP'}}};

function fakeFirestore(){
 const data=new Map(),serverReads=[];
 const snapshot=path=>({exists:data.has(path),id:path.split('/').at(-1),data:()=>data.get(path)});
 function ref(path){
  return {path,doc:id=>ref(path+'/'+id),collection:name=>collection(path+'/'+name),
   get:async options=>{serverReads.push({path,source:options?.source});return snapshot(path);}};
 }
 function collection(path){
  return {doc:id=>ref(path+'/'+id)};
 }
 const db={
  collection,
  async runTransaction(callback){
   const writes=[];
   const tx={
    get:async r=>snapshot(r.path),
    set:(r,value)=>writes.push({path:r.path,mode:'set',value}),
    update:(r,value)=>writes.push({path:r.path,mode:'update',value})
   };
   const answer=await callback(tx);
   for(const write of writes) data.set(write.path,write.mode==='update'?{...data.get(write.path),...write.value}:write.value);
   return answer;
  }
 };
 return {db,data,serverReads};
}

test('合宿はクラウドのcampSharedに作成され、サーバーから読み直される',async()=>{
 const {db,data,serverReads}=fakeFirestore(),service=createService(db,'test-actor',true),id='camp-one';
 await service.create({name:'春合宿',start:'2027-03-13',end:'2027-03-14'},id);
 assert.equal(data.get('campShared/'+id).name,'春合宿');
 const list=await service.list([id]);
 assert.equal(list[0].id,id);
 assert.equal(list[0].name,'春合宿');
 assert.deepEqual(serverReads,[{path:'campShared/'+id,source:'server'}]);
});

test('参加者・行程はFirestoreトランザクションで保存、競合時に拒否',async()=>{
 const {db,data}=fakeFirestore(),service=createService(db,'test-actor',true),id='camp-two';
 await service.create({name:'テスト合宿'},id);
 await service.save(id,'participants',{id:'member-one',name:'参加者',revision:0});
 await service.save(id,'routes',{id:'route-one',title:'集合',revision:0});
 assert.equal(data.get('campShared/camp-two/participants/member-one').name,'参加者');
 assert.equal(data.get('campShared/camp-two/routes/route-one').title,'集合');
 assert.equal(data.get('campShared/camp-two/participants/member-one').revision,1);
 await assert.rejects(service.save(id,'participants',{id:'member-one',name:'古い入力',revision:0}),/別の担当者が更新/);
 assert.equal(data.get('campShared/camp-two/participants/member-one').name,'参加者');
});

test('合宿画面には削除済みの配車・部屋割り・点呼処理を含まない',()=>{
 const app=readFileSync(new URL('../camp/free-app.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../camps.html',import.meta.url),'utf8');
 assert.doesNotMatch(app,/logistics-local|operations:'配車・点呼'|localOnly/);
 assert.match(app,/クラウドに保存しました/);
 assert.match(html,/Cloud Firestore/);
});
