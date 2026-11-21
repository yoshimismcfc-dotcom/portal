import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.env.CAMP_QA_PACKAGE || new URL('../../qa/package.json', import.meta.url));
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch, serverTimestamp } = require('firebase/firestore');
const env = await initializeTestEnvironment({
  projectId: 'demo-smc-attendance',
  firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync(new URL('../firebase-free/firestore.rules', import.meta.url), 'utf8') }
});
try {
  const event = id => 'attendanceCloudEvents/' + id;
  const reply = (id, person) => event(id) + '/playerAnswers/' + person;
  const db = (uid, verified = true) => env.authenticatedContext(uid, { email_verified: verified }).firestore();
  await env.withSecurityRulesDisabled(async context => {
    const admin = context.firestore();
    await setDoc(doc(admin, 'attendanceConfig/v1'), { enabled: true });
    for (const [uid, players] of [['parent-a', { a: {name:'テストA',grade:'1年'} }], ['parent-b', { b: {name:'テストB',grade:'1年'} }]]) {
      await setDoc(doc(admin, 'attendanceAccounts', uid), { active:true, players, coachEvents:{} });
    }
    await setDoc(doc(admin, 'attendanceAccounts/coach'), {active:true, players:{}, coachId:'c1', coachEvents:{'match-a':true,'match-b':true}});
    await setDoc(doc(admin, 'attendanceAccounts/other-coach'), {active:true, players:{}, coachId:'c2', coachEvents:{}});
    for (const id of ['match-a', 'match-b', 'practice']) {
      await setDoc(doc(admin, event(id)), {date:'2026-12-12',title:'テスト試合',open:true,kind:id === 'practice' ? 'practice' : 'match',targetGrades:['1年','年長'],practiceExcludedGrades:['1年']});
      for (const idOfChild of ['a', 'b']) await setDoc(doc(admin, event(id) + '/roster/' + idOfChild), { name:'テスト団員', grade:'1年' });
    }
  });
  const parent = db('parent-a');
  const coach = db('coach');
  const write = (value, contact, revision = 1) => ({ value, contact, revision, updatedAt: serverTimestamp() });
  await assertSucceeds(getDoc(doc(parent, reply('match-a', 'a'))));
  await assertSucceeds(setDoc(doc(parent, reply('match-a', 'a')), write('attending', {ride:true,rideTrip:'帰りのみ'})));
  await assertSucceeds(setDoc(doc(parent, reply('match-b', 'a')), write('maybe', {early:true,earlyTime:'14:30'})));
  await assertFails(setDoc(doc(parent, reply('practice', 'a')), write('attending', {})));
  await assertFails(setDoc(doc(parent, reply('match-a', 'b')), write('attending', {})));
  await assertFails(setDoc(doc(parent, reply('match-a', 'a')), write('absent', {}, 1)));
  await assertFails(setDoc(doc(parent, reply('match-a', 'a')), write('absent', {bad:'x'}, 2)));
  await assertFails(setDoc(doc(parent, reply('match-a', 'a')), write('absent', {early:true,earlyTime:'29:30'}, 2)));
  await assertFails(setDoc(doc(parent, 'attendanceAccounts/parent-a'), {active:true, coachEvents:{'match-a':true}}));
  await assertFails(getDoc(doc(db('parent-b'), reply('match-a', 'a'))));
  await assertFails(getDoc(doc(db('parent-a', false), reply('match-a', 'a'))));
  await assertFails(getDoc(doc(db('other-coach'), reply('match-a', 'a'))));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), reply('match-a', 'a'))));
  await assertFails(getDocs(collection(parent, event('match-a') + '/playerAnswers')));
  await assertSucceeds(getDocs(collection(coach, event('match-a') + '/roster')));
  const viewA = await assertSucceeds(getDocs(collection(coach, event('match-a') + '/playerAnswers')));
  const viewB = await assertSucceeds(getDocs(collection(coach, event('match-b') + '/playerAnswers')));
  assert.equal(viewA.docs[0].data().contact.rideTrip, '帰りのみ');
  assert.equal(viewB.docs[0].data().contact.earlyTime, '14:30');
  await assertSucceeds(setDoc(doc(coach, event('match-a') + '/coachAnswers/c1'), write('attending', {})));
  const visitor = env.unauthenticatedContext().firestore();
  const key = 'a'.repeat(64);
  const door = event('match-a') + '/guestLinks/' + key;
  const publicNote = 'attendancePublicNotices/match-a';
  const grant = {personId:'a',personName:'テスト団員',title:'テスト試合',date:'2026-12-12',kind:'match',localEventId:'',active:true,expiresAt:new Date(Date.now()+86400000)};
  await assertFails(setDoc(doc(visitor,door),grant));
  await assertSucceeds(setDoc(doc(coach,door),grant));
  await assertSucceeds(getDoc(doc(visitor,door)));
  await assertFails(getDoc(doc(visitor,event('match-a')+'/guestLinks/'+'b'.repeat(64))));
  await assertFails(getDocs(collection(visitor,event('match-a')+'/guestLinks')));
  await assertSucceeds(updateDoc(doc(visitor,door),{answer:write('attending',{ride:true,rideTrip:'帰りのみ'})}));
  await assertFails(updateDoc(doc(visitor,door),{personId:'b'}));
  await assertFails(updateDoc(doc(visitor,door),{answer:write('absent',{})}));
  await assertSucceeds(getDocs(collection(coach,event('match-a')+'/guestLinks')));
  await assertFails(getDocs(collection(db('other-coach'),event('match-a')+'/guestLinks')));
  const notice = {title:'テスト試合',date:'2026-12-12',message:'集合は8時です。',updatedAt:serverTimestamp()};
  await assertFails(setDoc(doc(visitor,publicNote),notice));
  await assertSucceeds(setDoc(doc(coach,publicNote),notice));
  assert.equal((await assertSucceeds(getDoc(doc(visitor,publicNote)))).data().message,'集合は8時です。');
  await assertSucceeds(getDocs(collection(visitor,'attendancePublicNotices')));
  await assertFails(getDoc(doc(visitor,reply('match-a','a'))));
  const publicId = 'c'.repeat(64);
  const writer = 'attendanceCoordinationWriters/' + publicId;
  const projection = 'attendancePublicCoordination/' + publicId;
  const pairing = writeBatch(visitor);
  pairing.update(doc(visitor,door), {coordinationId:publicId});
  pairing.set(doc(visitor,writer), {eventId:'match-a',key});
  await assertSucceeds(pairing.commit());
  await assertFails(getDoc(doc(visitor,writer)));
  const sharedAnswer = {...write('attending',{ride:true,rideTrip:'帰りのみ',message:'本人だけの補足'},2),publicName:'テスト保護者'};
  const publicData = {eventId:'match-a',title:'テスト試合',date:'2026-12-12',name:'テスト保護者',value:'attending',ride:true,rideTrip:'帰りのみ',
    early:false,earlyTime:'',late:false,lateTime:'',updatedAt:serverTimestamp()};
  await assertFails(setDoc(doc(visitor,projection),publicData));
  await assertFails(updateDoc(doc(visitor,door),{answer:sharedAnswer}));
  const publish = writeBatch(visitor);
  publish.update(doc(visitor,door),{answer:sharedAnswer});
  publish.set(doc(visitor,projection),publicData);
  await assertSucceeds(publish.commit());
  const published = (await assertSucceeds(getDocs(collection(visitor,'attendancePublicCoordination')))).docs[0].data();
  assert.equal(published.rideTrip,'帰りのみ');
  assert.equal(published.name,'テスト保護者');
  assert.equal(published.value,'attending');
  assert.equal(published.message,undefined);
  await assertFails(updateDoc(doc(visitor,door),{answer:write('absent',{},3)}));
  const clear = writeBatch(visitor);
  clear.update(doc(visitor,door),{answer:{...write('absent',{},3),publicName:''}});
  clear.delete(doc(visitor,projection));
  await assertSucceeds(clear.commit());
  assert.equal((await assertSucceeds(getDoc(doc(visitor,projection)))).exists(),false);
  await assertSucceeds(updateDoc(doc(coach,door),{active:false}));
  await assertFails(getDoc(doc(visitor,door)));
  await assertFails(updateDoc(doc(visitor,door),{answer:write('absent',{},2)}));
  console.log('Attendance rules: separated events, owner, assigned coach, denied peer and anonymous access OK');
} finally {
  await env.cleanup();
}
