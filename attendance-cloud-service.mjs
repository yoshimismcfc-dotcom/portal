export const answers = [
  { value: 'attending', label: '○ 参加' },
  { value: 'maybe', label: '△ 未定' },
  { value: 'absent', label: '× 不参加' },
  { value: '', label: '未回答' }
];
const trips = ['行きのみ', '帰りのみ', '往復'];
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2,'0')).join('');

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
    async publicNotices() {
      const snapshot = await db.collection('attendancePublicNotices').orderBy('date','desc').get(server);
      return snapshot.docs.map(doc => ({...doc.data(), id:doc.id}));
    },
    async publicCoordination() {
      const snapshot = await db.collection('attendancePublicCoordination').orderBy('date','desc').get(server);
      return snapshot.docs.map(doc => doc.data());
    },
    async publishNotice(event, message) {
      return db.collection('attendancePublicNotices').doc(event.id).set({
        title:event.title, date:event.date, message, updatedAt:serverTimestamp()
      });
    },
    watchGuestLinks(id, next, error) {
      return event(id).collection('guestLinks').onSnapshot({includeMetadataChanges:true}, snapshot => {
        if (!snapshot.metadata.fromCache) next(snapshot.docs.map(doc => ({...doc.data(), key:doc.id})));
      }, error);
    },
    async createGuestLink(item, person) {
      const key = randomId();
      const expiresAt = new Date(Date.parse(item.date+'T23:59:59+09:00') + 86400000);
      const grant = {
        personId:person.id, personName:person.name, title:item.title, date:item.date, kind:item.kind,
        localEventId:item.localEventId || '', active:true, expiresAt
      };
      const batch = db.batch();
      if (item.kind === 'match') {
        grant.coordinationId = randomId();
        batch.set(db.collection('attendanceCoordinationWriters').doc(grant.coordinationId),{eventId:item.id,key});
      }
      batch.set(event(item.id).collection('guestLinks').doc(key),grant);
      await batch.commit();
      return key;
    },
    async revokeGuestLink(id, key, coordinationId) {
      const batch = db.batch();
      batch.update(event(id).collection('guestLinks').doc(key),{active:false});
      if (coordinationId) batch.delete(db.collection('attendancePublicCoordination').doc(coordinationId));
      await batch.commit();
    },
    watchAnswers(id, next, error) {
      return event(id).collection('playerAnswers').onSnapshot({ includeMetadataChanges: true }, snapshot => {
        if (!snapshot.metadata.fromCache) next(new Map(snapshot.docs.map(doc => [doc.id, doc.data()])));
      }, error);
    }
  };
}

export function guestCredentials(hash) {
  const values = new URLSearchParams(hash.replace(/^#/, ''));
  const event = values.get('event') || '';
  const key = values.get('key') || '';
  return /^[A-Za-z0-9_-]{1,150}$/.test(event) && /^[a-f0-9]{64}$/.test(key) ? { event, key } : null;
}

export function guestAttendanceStore(db, serverTimestamp, {event, key}) {
  const ref = db.collection('attendanceCloudEvents').doc(event).collection('guestLinks').doc(key);
  const empty = () => ({value:'', contact:{}, revision:0});
  async function read() {
    const grant = (await ref.get({source:'server'})).data();
    if (grant?.active !== true) throw Error('invalid-guest-link');
    return grant;
  }
  return {
    async prepare() {
      const grant = await read();
      if (grant.kind !== 'match' || grant.coordinationId) return grant;
      return db.runTransaction(async transaction => {
        const current = (await transaction.get(ref)).data();
        if (current?.active !== true) throw Error('invalid-guest-link');
        if (current.coordinationId) return current;
        const coordinationId = randomId();
        transaction.update(ref,{coordinationId});
        transaction.set(db.collection('attendanceCoordinationWriters').doc(coordinationId),{eventId:event,key});
        return { ...current, coordinationId };
      });
    },
    async get() { return (await read()).answer || empty(); },
    async save(id, person, draft, baseRevision) {
      return db.runTransaction(async transaction => {
        const grant = (await transaction.get(ref)).data();
        if (grant?.active !== true || grant.personId !== person.id || id !== event) throw Error('invalid-guest-link');
        const revision = (grant.answer?.revision ?? 0) + 1;
        if (revision !== baseRevision + 1) throw Error('revision-conflict');
        const { publicName = '', contact } = draft;
        transaction.update(ref, {answer:{...draft,revision,updatedAt:serverTimestamp()}});
        if (grant.coordinationId && (publicName || grant.answer?.publicName)) {
          const projection = db.collection('attendancePublicCoordination').doc(grant.coordinationId);
          if (publicName) {
            transaction.set(projection, {
              eventId:event, title:grant.title, date:grant.date, name:publicName,
              ride:contact.ride ?? false, rideTrip:contact.rideTrip ?? '',
              early:contact.early ?? false, earlyTime:contact.earlyTime ?? '',
              late:contact.late ?? false, lateTime:contact.lateTime ?? '', updatedAt:serverTimestamp()
            });
          } else transaction.delete(projection);
        }
        return revision;
      });
    }
  };
}

export function latestAttendance(accountReplies, guestLinks) {
  const latest = new Map(accountReplies);
  for (const {personId, answer} of guestLinks) {
    if (answer && (!latest.has(personId) || answer.updatedAt.toMillis() > latest.get(personId).updatedAt.toMillis())) {
      latest.set(personId,answer);
    }
  }
  return latest;
}
