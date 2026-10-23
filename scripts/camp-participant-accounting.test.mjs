import test from 'node:test';import assert from 'node:assert/strict';
import {participantAccount} from '../camp/participant-accounting.mjs';import {applyLedger} from '../camp/free-model.mjs';
test('missing fee differs from explicitly free; installments, fee changes and refund use existing ledger',()=>{
 let l={revision:0,charges:{},entries:{},history:{}},n=0;const op=x=>{l=applyLedger(l,{id:'op'+ ++n,revision:l.revision,...x},'fixture','now');};
 assert.equal(participantAccount(l,'a').status,'参加費未設定');op({type:'charge',participantId:'a',name:'同姓同名',amount:0});assert.equal(participantAccount(l,'a').status,'参加費0円');assert.equal(participantAccount(l,'b').configured,false);
 op({type:'charge',participantId:'a',name:'同姓同名',amount:7000});op({type:'entry',kind:'payment',participantId:'a',amount:3000,reference:'p1'});assert.equal(participantAccount(l,'a').status,'一部入金');assert.equal(participantAccount(l,'a').due,4000);
 op({type:'entry',kind:'payment',participantId:'a',amount:4000,reference:'p2'});assert.equal(participantAccount(l,'a').status,'徴収済み');op({type:'charge',participantId:'a',name:'同姓同名',amount:6000});assert.equal(participantAccount(l,'a').credit,1000);op({type:'entry',kind:'refund',participantId:'a',amount:1000,reference:'r1'});assert.equal(participantAccount(l,'a').credit,0);assert.equal(participantAccount(l,'a').received,6000);
 assert.equal(Object.keys(l.entries).length,3);assert.equal(Object.keys(l.history).length,6);assert.equal(participantAccount(l,'b').received,0);
});
