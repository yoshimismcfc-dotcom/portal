// Public camp index: reads only the root metadata documents on first listing.
// This mode requires Firebase Firestore rules to explicitly allow root listing.
// The app never requests device credentials or writes device approvals.
export function createCampDirectory(db){
 return {
  async browse(){
   const snap=await db.collection('campShared').orderBy('start','desc').limit(100).get({source:'server'});
   return snap.docs.map(doc=>({id:doc.id,...doc.data()}));
  }
 };
}
