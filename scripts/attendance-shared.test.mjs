import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sharedAttendance } from '../attendance-shared.mjs';

test('two devices see shared answers and stale forms never overwrite other edits', async () => {
  const rows = new Map();
  const listeners = [];
  function publish() {
    const docs = Array.from(rows, ([id, value]) => ({ id, data: () => value }));
    listeners.forEach(receive => receive({ docs, metadata: {} }));
  }
  const collection = {
    doc: id => id,
    onSnapshot(options, receive) {
      listeners.push(receive);
      publish();
    }
  };
  const db = {
    collection: () => collection,
    async runTransaction(run) {
      const writes = new Map();
      await run({
        get: async id => ({ data: () => rows.get(id) }),
        set: (id, data) => writes.set(id, data)
      });
      writes.forEach((data, id) => rows.set(id, data));
      publish();
    }
  };
  const first = sharedAttendance(db, () => 'server time');
  const second = sharedAttendance(db, () => 'server time');
  let firstRows, secondRows;
  first.listen(rows => { firstRows = rows; });
  second.listen(rows => { secondRows = rows; });
  const stale = secondRows;
  const group = 'players';
  const person = 'テスト団員';
  const id = first.key('match_a', group, person);
  await first.save(group, person, [{ id: 'match_a', value: 'attending', contact: { message: '現地集合' } }], undefined, firstRows);
  assert.equal(secondRows.get(id).value, 'attending');
  assert.equal(secondRows.get(id).contact.message, '現地集合');

  await assert.rejects(
    second.save(group, person, [{ id: 'match_a', value: 'absent' }, { id: 'match_b', value: 'maybe' }], undefined, stale),
    /shared-attendance-conflict/
  );
  assert.equal(secondRows.has(second.key('match_b', group, person)), false);
  await second.save(group, person, [
    { id: 'match_a', value: 'attending', contact: { message: '現地集合' } },
    { id: 'match_b', value: 'maybe' }
  ], '備考', secondRows);
  assert.equal(firstRows.get(first.key('match_b', group, person)).value, 'maybe');
  assert.equal(firstRows.get(first.key('', group, person)).note, '備考');
  assert.equal(firstRows.get(id).revision, 1);
  await second.save(group, person, [{ id: 'match_a', value: '', contact: null }], undefined, secondRows);
  assert.equal(firstRows.get(id).value, '');
  assert.deepEqual(firstRows.get(id).contact, {});
  assert.equal(firstRows.get(id).revision, 2);
});
