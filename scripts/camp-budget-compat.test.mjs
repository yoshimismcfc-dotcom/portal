// 追加ルール未反映でも旧予算・台帳を利用できることをエミュレーターで検証。
import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import {createService} from '../camp/free-service.mjs';
const require=createRequire(process.env.CAMP_QA_PACKAGE||new URL('../../qa/package.json',import.meta.url));
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing'),firebase=require('firebase/compat/app');require('firebase/compat/firestore');globalThis.firebase=firebase;
const current=readFileSync(new URL('../firebase-free/firestore.rules',import.meta.url),'utf8'),start=current.indexOf('   // 旧budgets'),end=current.indexOf('   match /private/ledger');assert.ok(start>0&&end>start);const old=current.slice(0,start)+current.slice(end);
let env;const config=rules=>({projectId:'demo-smc-camp',firestore:{host:'127.0.0.1',port:8085,rules}});
try{
 const partial=current.replace(/   \/\/ 読み取り可否だけで料金拡張ルールを検知する予約領域。書込みは許可しない。[\s\S]*?   match \/private\/budgetSettings/, '   match /private/budgetSettings');
 assert.notEqual(partial,current);env=await initializeTestEnvironment(config(partial));let compat=createService(env.unauthenticatedContext().firestore(),'partial-device',true),partialId='44444444-4444-4444-8444-444444444444';
 await compat.create({name:'段階公開検証',start:'2027-03-13',end:'2027-03-14',place:'会場',meeting:'',fee:0,status:'準備中',notes:'',archived:false},partialId);
 await compat.saveBudget(partialId,{id:'v1',title:'従来の予算書',kind:'expense',category:'hotel',target:'all',quantityMode:'manual',unit:1000,quantity:1,notes:'',archived:false,revision:0});let partialCamp=await compat.load(partialId);assert.equal(partialCamp.budgetBook.available,true);assert.equal(partialCamp.budgetBook.ratesAvailable,false);assert.equal(partialCamp.budgetBook.lines[0].unit,1000);console.log('PASS 料金拡張ルール未反映でも従来の予算書を保存・読込できる');await env.cleanup();
 env=await initializeTestEnvironment(config(old));const db=env.unauthenticatedContext().firestore(),s=createService(db,'compat-device',true),id='33333333-3333-4333-8333-333333333333';await s.create({name:'互換検証',start:'2027-03-13',end:'2027-03-14',place:'会場',meeting:'',fee:0,status:'準備中',notes:'',archived:false},id);
 await s.save(id,'budgets',{id:'legacy',title:'旧予算',unit:1000,quantity:2,notes:'',archived:false,revision:0});let c=await s.load(id);assert.equal(c.budgetBook.available,false);assert.equal(c.budgets.length,1);assert.equal(c.budgetBook.lines.length,0);
 await s.finance(id,{id:'expense',type:'entry',kind:'expense',amount:500,reference:'compat-expense',revision:0,date:'2027-03-13',category:'宿泊費'});c=await s.load(id);assert.equal(c.report.expense,500);assert.equal(c.budgetBook.available,false);console.log('PASS 追加ルール未反映では新機能を無効にし、旧予算・実績台帳を保護');
}finally{if(env)await env.cleanup();const restored=await initializeTestEnvironment(config(current));await restored.cleanup();}
