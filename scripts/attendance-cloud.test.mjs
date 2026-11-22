import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOpenAttendance } from '../attendance-open-store.mjs';
import { attendanceStore, availableEvents, contactFromForm, contactLabel, reviewRows } from '../attendance-cloud-service.mjs';

test('試合の対象者だけ練習を省き、年長を含める', () => {
  const date = '2026-12-12';
  const events = [
    { id: 'practice', date, kind: 'practice', open: true, practiceExcludedGrades: ['1年', '年長'] },
    { id: 'match', date, kind: 'match', open: true, targetGrades: ['1年', '年長'] }
  ];
  const ids = grade => availableEvents(events, {}, {kind: 'player', grade}).map(event => event.id);
  assert.deepEqual(ids('年長'), ['match']);
  assert.deepEqual(ids('1年'), ['match']);
  assert.deepEqual(ids('6年'), ['practice']);
  assert.deepEqual(availableEvents(events, {coachEvents: {match: true}}, {kind: 'coach'}).map(event => event.id), ['match']);
});

test('送迎と早退の入力を取り違えずに一覧に表示する', () => {
  const ride = contactFromForm(new Map([['ride','on'], ['rideTrip','帰りのみ'], ['earlyTime','14:30']]));
  const early = contactFromForm(new Map([['early','on'], ['earlyTime','14:30']]));
  const event = {targetGrades: ['年長']};
  const roster = [{id:'one', name:'テスト団員', grade:'年長'}, {id:'two', name:'対象外', grade:'6年'}];
  const row = contact => reviewRows(event, roster, new Map([['one', { value:'attending', contact }]]))[0];
  assert.deepEqual(ride, {ride:true, rideTrip:'帰りのみ'});
  assert.equal(contactLabel(row(ride).contact), '送迎希望（帰りのみ）');
  assert.equal(contactLabel(row(early).contact), '早退（14:30）');
});

test('出欠と連絡を予定ごとに一度の書き込みで保存し、古い版を拒否する', async () => {
  const records = new Map();
  const ref = prefix => ({
    doc(id) { return ref(prefix + '/' + id); },
    collection(name) { return ref(prefix + '/' + name); },
    get() { return Promise.resolve({data: () => records.get(prefix)}); },
    path: prefix
  });
  const db = {
    collection: ref,
    runTransaction: callback => callback({
      get: target => target.get(),
      set: (target, value) => records.set(target.path, value)
    })
  };
  const person = {id:'one',kind:'player'};
  const store = attendanceStore(db, () => 'server-time');
  const responseA = {value:'attending',contact:{ride:true,rideTrip:'帰りのみ'}};
  const responseB = {value:'maybe',contact:{early:true,earlyTime:'14:30'}};
  await store.save('match-a', person, responseA, 0);
  await store.save('match-b', person, responseB, 0);
  await assert.rejects(store.save('match-a', person, responseB, 0), /revision-conflict/);
  const coachDevice = attendanceStore(db, () => 'server-time');
  assert.deepEqual((await coachDevice.get('match-a', person)).contact, responseA.contact);
  assert.deepEqual((await coachDevice.get('match-b', person)).contact, responseB.contact);
  assert.equal(records.size, 2);
});

test('公開版は一部保存の再試行と同時編集を処理する', async () => {
  const records = new Map();
  const failing = new Set();
  const ref = path => ({
    child(id) {
      assert.doesNotMatch(id, /[.#$\[\]/]/);
      return ref(id);
    },
    transaction(update, complete) {
      const current = records.get(path) || null;
      const next = update(current);
      if (failing.delete(path)) {
        complete(new Error('network error'), false);
        return;
      }
      if (next !== undefined) records.set(path, next);
      complete(null, next !== undefined, { val: () => records.get(path) || null });
    }
  });
  globalThis.window = { onFirebaseReady: ready => ready({ ref }) };
  try {
    const firstDevice = await loadOpenAttendance();
    const secondDevice = await loadOpenAttendance();
    const group = 'players', person = 'player.a';
    const match = 'calendar_game%40example.com', practice = 'day_2026-12-09';
    const matchKey = firstDevice.key(match, group, person);
    const practiceKey = firstDevice.key(practice, group, person);
    assert.equal(firstDevice.key(practice, group, 'player-a'), 'players:day_2026-12-09:player-a');
    const updates = [
      { id: match, value: 'attending', contact: { message: '途中から参加', late: true, lateTime: '12:00' } },
      { id: practice, value: 'maybe' }
    ];
    const emptyBaseline = new Map();
    failing.add(practiceKey);
    await assert.rejects(firstDevice.save(group, person, updates, undefined, emptyBaseline), /network error/);
    assert.equal(records.get(matchKey).revision, 1);
    assert.equal((await firstDevice.save(group, person, updates, undefined, emptyBaseline)).size, 0);
    assert.equal(records.get(matchKey).revision, 1);
    assert.equal(records.get(practiceKey).value, 'maybe');

    const baseline = new Map(records);
    await secondDevice.save(group, person, [{ id: match, value: 'absent' }], undefined, baseline);
    const reordered = { late: true, lateTime: '12:00', message: '途中から参加' };
    assert.equal((await firstDevice.save(group, person, [{ id: match, value: 'attending', contact: reordered }],
      undefined, baseline)).size, 0);
    assert.equal(records.get(matchKey).value, 'absent');
    assert.equal((await firstDevice.save(group, person, [{ id: match, value: 'attending', contact: null }],
      undefined, baseline)).size, 0);
    assert.equal(records.get(matchKey).value, 'absent');
    assert.deepEqual(records.get(matchKey).contact, {});

    const draft = [{ id: match, value: 'maybe' }, { id: practice, value: 'attending' }];
    const conflicts = await firstDevice.save(group, person, draft, undefined, baseline);
    assert.deepEqual(conflicts.get(matchKey), { value: 'absent' });
    assert.equal(records.get(practiceKey).value, 'attending');
    assert.equal(records.get(matchKey).value, 'absent');
    await secondDevice.save(group, person, [{ id: match, value: '' }], undefined, new Map(records));
    const updatedConflicts = await firstDevice.save(group, person, draft, undefined, baseline, conflicts);
    assert.deepEqual(updatedConflicts.get(matchKey), { value: '' });
    assert.equal(records.get(matchKey).value, '');
    assert.equal((await firstDevice.save(group, person, draft, undefined, baseline, updatedConflicts)).size, 0);
    assert.equal(records.get(matchKey).value, 'maybe');
    assert.deepEqual(records.get(matchKey).contact, {});
  } finally {
    delete globalThis.window;
  }
});
