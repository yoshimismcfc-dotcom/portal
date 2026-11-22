export function previewRecruitment(db, auth, timestamp, sessionId) {
  const session = db.collection('attendancePreviewSessions').doc(sessionId);
  const recruitment = session.collection('recruitment');

  return {
    listen(receive, unavailable) {
      return recruitment.onSnapshot({ includeMetadataChanges: true }, snapshot => {
        if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
          receive(new Map(snapshot.docs.map(doc => [doc.id, doc.data()])));
        }
      }, unavailable);
    },

    watchCoach(receive) {
      if (!auth) {
        receive(false, false);
        return;
      }
      let unwatch;
      auth.onAuthStateChanged(user => {
        unwatch?.();
        receive(Boolean(user), false);
        if (!user?.emailVerified) return;
        unwatch = session.collection('coachGrants').doc(user.uid).onSnapshot({ includeMetadataChanges: true },
          snapshot => receive(true, !snapshot.metadata.fromCache && snapshot.data()?.active === true),
          () => receive(true, false));
      }, () => receive(false, false));
    },

    signIn(email, password) {
      return auth.signInWithEmailAndPassword(email, password);
    },

    signOut() {
      return auth.signOut();
    },

    async save(eventId, changes, baselineRevision) {
      const ref = recruitment.doc(eventId);
      return db.runTransaction(async transaction => {
        const existing = (await transaction.get(ref)).data();
        if ((existing?.revision || 0) !== baselineRevision) {
          throw new Error('recruitment-conflict');
        }
        const rules = new Map(Object.entries(existing?.decisions || {}));
        for (const [personId, decision] of changes) {
          if (decision === 'default') rules.delete(personId);
          else rules.set(personId, decision);
        }
        const updated = { decisions: Object.fromEntries(rules), revision: baselineRevision + 1, updatedAt: timestamp() };
        transaction.set(ref, updated);
        return updated;
      });
    }
  };
}
