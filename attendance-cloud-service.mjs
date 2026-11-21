export const answers = [
  { value: 'attending', label: '○ 参加' },
  { value: 'maybe', label: '△ 未定' },
  { value: 'absent', label: '× 不参加' },
  { value: '', label: '未回答' }
];
const trips = ['行きのみ', '帰りのみ', '往復'];
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function contactFromForm(form) {
  const contact = {};
  for (const name of ['ride', 'early', 'late', 'other']) {
    if (form.has(name)) contact[name] = true;
  }
  const trip = form.get('rideTrip');
  if (contact.ride && trips.includes(trip)) contact.rideTrip = trip;
  for (const name of ['early', 'late']) {
    const time = form.get(name + 'Time');
    if (contact[name] && timePattern.test(time)) contact[name + 'Time'] = time;
  }
  const message = String(form.get('message') || '').trim().slice(0, 160);
  if (message) contact.message = message;
  return contact;
}

export function contactLabel(contact = {}) {
  return [
    contact.ride && ('送迎希望' + (contact.rideTrip ? '（' + contact.rideTrip + '）' : '')),
    contact.early && ('早退' + (contact.earlyTime ? '（' + contact.earlyTime + '）' : '')),
    contact.late && ('遅刻・途中参加' + (contact.lateTime ? '（' + contact.lateTime + '）' : '')),
    contact.other && 'その他',
    contact.message
  ].filter(Boolean).join('・');
}

export function availableEvents(events, account, person) {
  if (person.kind === 'coach') return events.filter(event => account.coachEvents?.[event.id] === true);
  const eligibleMatches = events.filter(event => event.kind === 'match' && event.open &&
    event.targetGrades?.includes(person.grade));
  const priorityDates = new Set(eligibleMatches.map(event => event.date));
  return events.filter(event => event.kind === 'match'
    ? event.targetGrades?.includes(person.grade)
    : !priorityDates.has(event.date) && !event.practiceExcludedGrades?.includes(person.grade));
}

export function reviewRows(event, roster, replies) {
  return roster.filter(person => event.targetGrades?.includes(person.grade))
    .map(person => ({
      ...person, value: replies.get(person.id)?.value ?? '', contact: replies.get(person.id)?.contact ?? {}
    }))
    .sort((a, b) => b.grade.localeCompare(a.grade, 'ja', { numeric: true }) || a.name.localeCompare(b.name, 'ja'));
}

export function attendanceStore(db, serverTimestamp) {
  const events = db.collection('attendanceCloudEvents');
  const event = id => events.doc(id);
  const response = (id, person) => event(id)
    .collection(person.kind === 'coach' ? 'coachAnswers' : 'playerAnswers').doc(person.id);
  const server = { source: 'server' };
  return {
    async account(uid) {
      const flag = await db.collection('attendanceConfig').doc('v1').get(server);
      if (flag.data()?.enabled !== true) throw Error('cloud-disabled');
      const grant = await db.collection('attendanceAccounts').doc(uid).get(server);
      if (grant.data()?.active !== true) throw Error('account-inactive');
      return grant.data();
    },
    async events() {
      const snapshot = await events.orderBy('date').get(server);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    },
    async get(id, person) {
      const snapshot = await response(id, person).get(server);
      return snapshot.data() || { value: '', contact: {}, revision: 0 };
    },
    async save(id, person, draft, baseRevision) {
      const ref = response(id, person);
      return db.runTransaction(async transaction => {
        const old = (await transaction.get(ref)).data();
        const currentRevision = old?.revision ?? 0;
        if (currentRevision !== baseRevision) throw Error('revision-conflict');
        const revision = currentRevision + 1;
        transaction.set(ref, { ...draft, revision, updatedAt: serverTimestamp() });
        return revision;
      });
    },
    watchRoster(id, next, error) {
      return event(id).collection('roster').onSnapshot({ includeMetadataChanges: true }, snapshot => {
        if (!snapshot.metadata.fromCache) next(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      }, error);
    },
    watchAnswers(id, next, error) {
      return event(id).collection('playerAnswers').onSnapshot({ includeMetadataChanges: true }, snapshot => {
        if (!snapshot.metadata.fromCache) next(new Map(snapshot.docs.map(doc => [doc.id, doc.data()])));
      }, error);
    }
  };
}
