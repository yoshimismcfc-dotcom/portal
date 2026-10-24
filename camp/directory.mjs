// 合宿一覧の端末自動識別。ログイン画面・合言葉は不要。
// 通常ポータルの認証を変更しないよう別名Firebaseアプリを使用する。
// 匿名認証のUIDは本人証明ではないため、Firebase管理者が端末ごとに承認する。
export function createCampDirectory(sdk,config){
 const name='smc-camp-directory';
 const app=sdk.apps.find(a=>a.name===name)||sdk.initializeApp(config,name);
 const auth=app.auth(),db=app.firestore();
 return {
  currentUser:()=>auth.currentUser,
  async ready(){
   const current=await new Promise((resolve,reject)=>{
    let done=false,stop=()=>{};
    stop=auth.onAuthStateChanged(user=>{if(done)return;done=true;stop();resolve(user);},reject);
   });
   if(current)return current;
   // LOCALで永続化し、同じブラウザで次回以降の再操作をなくす。
   await auth.setPersistence(sdk.auth.Auth.Persistence.LOCAL);
   const result=await auth.signInAnonymously();
   return result.user;
  },
  async browse(){
   if(!auth.currentUser)throw new Error('この端末を識別できません。接続を確認してください。');
   // Firestoreルールが承認済みの匿名UIDだけに全件一覧を返す。
   // 権限がなければ無条件の一覧取得へフォールバックしない。
   const snap=await db.collection('campShared').orderBy('start','desc').limit(100).get({source:'server'});
   return snap.docs.map(s=>({id:s.id,...s.data()}));
  },
  async requestApproval(label){
   const user=auth.currentUser;
   if(!user||!user.isAnonymous)throw new Error('端末識別の設定を確認してください。');
   const name=String(label||'').trim();
   if(!name||name.length>40)throw new Error('コーチ・担当者の名前を40文字以内で入力してください。');
   await db.collection('campDirectoryRequests').doc(user.uid).set({
    label:name,createdAt:sdk.firestore.FieldValue.serverTimestamp()
   });
  },
  async application(){
   const user=auth.currentUser;
   if(!user)return null;
   const doc=await db.collection('campDirectoryRequests').doc(user.uid).get({source:'server'});
   return doc.exists?doc.data():null;
  }
 };
}
