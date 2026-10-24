// Cloud camp discovery is opt-in and staff-only. A separate Firebase app prevents
// Google login for the directory from changing the legacy portal's auth session.
export function createCampDirectory(sdk,config){
 const name='smc-camp-directory';
 const app=sdk.apps.find(a=>a.name===name)||sdk.initializeApp(config,name);
 const auth=app.auth(),db=app.firestore();
 return {
  currentUser:()=>auth.currentUser,
  ready:()=>new Promise((resolve,reject)=>{
   let done=false,unsubscribe=()=>{};
   unsubscribe=auth.onAuthStateChanged(user=>{
    if(done)return;done=true;unsubscribe();resolve(user);
   },reject);
  }),
  async browse(){
   if(!auth.currentUser)throw new Error('コーチのGoogleログインが必要です。');
   // Security is enforced by Firestore rules. Never fall back to unrestricted
   // collection reads if the authenticated query is rejected.
   const snap=await db.collection('campShared').orderBy('start','desc').limit(100).get({source:'server'});
   return snap.docs.map(s=>({id:s.id,...s.data()}));
  },
  signIn:()=>auth.signInWithPopup(new sdk.auth.GoogleAuthProvider()),
  signOut:()=>auth.signOut()
 };
}
