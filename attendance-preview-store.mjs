import { previewRecruitment } from "./attendance-preview-recruitment.mjs?v=20261122-6";

export function sharedAttendance(db, serverTimestamp, keyPrefix) {
  const collection = db.collection('attendancePreviewSessions').doc(keyPrefix).collection('answers');
  const key = (eventId, group, personId) =>
    [group, eventId, personId].map(encodeURIComponent).join(':');

  return {
    key,
    listen(receive, unavailable) {
      return collection.onSnapshot({ includeMetadataChanges: true }, snapshot => {
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
          unavailable('クラウドの最新の出欠を確認中です。');
          return;
        }
        receive(new Map(snapshot.docs.map(doc => [doc.id, doc.data()])));
      }, () => unavailable('クラウド出欠を読み込めません。共有設定と通信状態をご確認ください。'));
    },
    async save(group, personId, updates, note, baseline) {
      const changes = updates.map(update => {
        const id = key(update.id, group, personId);
        const original = baseline.get(id);
        const contact = update.contact === undefined ? original?.contact || {} : update.contact || {};
        return { id, original, data: { eventId: update.id, value: update.value, contact, note: '' } };
      });
      if (note !== undefined) {
        const id = key('', group, personId);
        changes.push({ id, original: baseline.get(id), data: { eventId: '', value: '', contact: {}, note } });
      }
      const changed = changes.filter(({ original, data }) =>
        (original?.value || '') !== data.value ||
        (original?.note || '') !== data.note ||
        JSON.stringify(Object.entries(original?.contact || {}).sort()) !== JSON.stringify(Object.entries(data.contact).sort()));
      if (!changed.length) return;
      await db.runTransaction(async transaction => {
        const refs = changed.map(change => collection.doc(change.id));
        const current = await Promise.all(refs.map(ref => transaction.get(ref)));
        current.forEach((doc, index) => {
          if ((doc.data()?.revision || 0) !== (changed[index].original?.revision || 0)) {
            throw new Error('shared-attendance-conflict');
          }
        });
        changed.forEach(({ original, data }, index) => {
          transaction.set(refs[index], {
            ...data, group, personId,
            revision: (original?.revision || 0) + 1,
            updatedAt: serverTimestamp()
          });
        });
      });
    }
  };
}

export async function loadSharedAttendance(keyPrefix) {
  await new Promise(resolve => window.onFirebaseReady(resolve));
  if (!window.firebase.firestore) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }
  const db = window.firebase.firestore();
  const timestamp = window.firebase.firestore.FieldValue.serverTimestamp;
  return {
    ...sharedAttendance(db, timestamp, keyPrefix),
    recruitment: previewRecruitment(db, window.FIREBASE_AUTH, timestamp, keyPrefix)
  };
}
