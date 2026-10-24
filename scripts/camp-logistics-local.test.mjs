import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyOperations,verifyOperations,changeOperations,usedSeats,usedBeds,readOperations,writeOperations,localOperationsKey} from '../camp/logistics-local-model.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const people=[
 {id:id(1),name:'選手A',kind:'player',response:'yes',overnight:true},
 {id:id(2),name:'選手B',kind:'player',response:'yes',overnight:true},
 {id:id(3),name:'コーチ',kind:'coach',response:'yes',overnight:true},
 {id:id(4),name:'保護者',kind:'parent',response:'yes',overnight:false},
 {id:id(5),name:'不参加',kind:'player',response:'no',overnight:true}
];
function seed(){
 let s=emptyOperations();
 s=changeOperations(s,{kind:'vehicle',item:{id:id(30),label:'1号車',capacity:3,driver:id(3),active:true}},people);
 s=changeOperations(s,{kind:'room',item:{id:id(31),label:'A室',capacity:2,active:true}},people);
 return s;
}
test('初期状態と端末内保存・再読込',()=>{
 const store=new Map(),api={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const state=seed();writeOperations(api,id(99),state,people);
 assert.deepEqual(readOperations(api,id(99),people),state);
 assert.ok(localOperationsKey(id(99)).endsWith(id(99)));
 assert.deepEqual(readOperations(api,id(98),people),emptyOperations());
 assert.equal(JSON.stringify(state).includes('選手A'),false);
});
test('乗車定員に運転者を含める・同じ人を二重計上しない',()=>{
 let s=seed();
 assert.equal(usedSeats(s,people,s.vehicles[0]),1);
 s=changeOperations(s,{kind:'assign',id:id(1),vehicle:id(30),room:id(31)},people);
 s=changeOperations(s,{kind:'assign',id:id(2),vehicle:id(30),room:id(31)},people);
 assert.equal(usedSeats(s,people,s.vehicles[0]),3);
 assert.equal(usedBeds(s,people,s.rooms[0]),2);
 assert.throws(()=>changeOperations(s,{kind:'assign',id:id(4),vehicle:id(30)},people),/乗車定員/);
 assert.throws(()=>changeOperations(s,{kind:'assign',id:id(3),room:id(31)},people),/宿泊定員/);
 const plus=changeOperations(s,{kind:'assign',id:id(3),vehicle:id(30)},people);
 assert.equal(usedSeats(plus,people,plus.vehicles[0]),3);
});
test('非宿泊者は部屋割当を持たない',()=>{
 const s=changeOperations(seed(),{kind:'assign',id:id(4),room:id(31)},people);
 assert.equal(s.allocation[id(4)],undefined);
});
test('不参加者は割り当てと点呼の対象外',()=>{
 assert.throws(()=>changeOperations(seed(),{kind:'assign',id:id(5),vehicle:id(30)},people),/参加確定/);
 assert.throws(()=>changeOperations(seed(),{kind:'rollcall',id:id(5),field:'depart',value:true},people),/参加確定/);
});
test('出発と到着の点呼を独立して記録・解除',()=>{
 let s=changeOperations(seed(),{kind:'rollcall',id:id(1),field:'depart',value:true},people);
 assert.deepEqual(s.rollcall[id(1)],{depart:true,arrive:false});
 s=changeOperations(s,{kind:'rollcall',id:id(1),field:'arrive',value:true},people);
 assert.deepEqual(s.rollcall[id(1)],{depart:true,arrive:true});
 s=changeOperations(s,{kind:'clear-rollcall'},people);
 assert.deepEqual(s.rollcall,{});
});
test('不参加への変更時も勝手に削除せず明示的に整理する',()=>{
 let s=changeOperations(seed(),{kind:'assign',id:id(1),vehicle:id(30),room:id(31)},people);
 s=changeOperations(s,{kind:'rollcall',id:id(1),field:'depart',value:true},people);
 const changed=people.map(p=>p.id===id(1)?{...p,response:'no'}:p);
 assert.ok(verifyOperations(s,changed).allocation[id(1)]);
 s=changeOperations(s,{kind:'clean'},changed);
 assert.equal(s.allocation[id(1)],undefined);
 assert.equal(s.rollcall[id(1)],undefined);
});
test('不正値・過大定員・存在しない車両・未成年運転者は拒否',()=>{
 assert.throws(()=>changeOperations(seed(),{kind:'vehicle',item:{id:id(50),label:'',capacity:4,driver:'',active:true}},people),/名前・定員/);
 assert.throws(()=>changeOperations(seed(),{kind:'vehicle',item:{id:id(50),label:'新車',capacity:21,driver:'',active:true}},people),/名前・定員/);
 assert.throws(()=>changeOperations(seed(),{kind:'vehicle',item:{id:id(50),label:'新車',capacity:4,driver:id(1),active:true}},people),/運転者/);
 assert.throws(()=>changeOperations(seed(),{kind:'assign',id:id(1),vehicle:id(55)},people),/使用中の車両/);
});
test('端末保存に失敗しても成功を装わない',()=>{
 const store={setItem:()=>{throw new Error('quota');}};
 assert.throws(()=>writeOperations(store,id(99),seed(),people),/quota/);
});
