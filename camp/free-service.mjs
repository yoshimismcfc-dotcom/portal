import {applyLedger, publicReport} from './free-model.mjs';
export function createService(db,uid,isAdmin) {
 const root=db.collection('campShared'), stamp=()=>firebase.firestore.FieldValue.serverTimestamp();
 const read=async ref=>{const s=await ref.get({source:'server'});return s.exists?{id:s.id,...s.data()}:null;};
 const rows=async ref=>(await ref.get({source:'server'})).docs.map(s=>({id:s.id,...s.data()}));
 const ref=id=>root.doc(id);
 return {
  async list(ids=[]){return (await Promise.all(ids.slice(0,50).map(id=>read(ref(id))))).filter(Boolean);},
  async load(id){const camp=await read(ref(id));if(!camp)throw new Error('合宿がありません');const role='leader';
   const [participants,routes,budgets,report,ledger]=await Promise.all([rows(ref(id).collection('participants')),rows(ref(id).collection('routes')),rows(ref(id).collection('budgets')),read(ref(id).collection('public').doc('finance')),read(ref(id).collection('private').doc('ledger'))]);
   const link=null;
   return {...camp,role,participants,routes,budgets,report,link,ledger:ledger||{revision:0,charges:{},entries:{},history:{}}};
  },
  async create(data,id){await db.runTransaction(async tx=>{const r=ref(id),s=await tx.get(r);if(s.exists)return;tx.set(r,{...data,revision:0,updatedAt:stamp()});});return id;},
  async meta(id,data,revision){await db.runTransaction(async tx=>{const r=ref(id),s=await tx.get(r);if(s.data().revision!==revision)throw new Error('別の担当者が更新しました。最新情報を取得してください');tx.update(r,{...data,revision:revision+1,updatedAt:stamp()});});},
  async save(id,collection,data){const r=ref(id).collection(collection).doc(data.id),{id:recordId,...body}=data;
   await db.runTransaction(async tx=>{const s=await tx.get(r),revision=s.exists?s.data().revision:0;if(revision!==(body.revision||0))throw new Error('別の担当者が更新しました。最新情報を取得してください');tx.set(r,{...body,revision:revision+1,updatedAt:stamp()});});
  },
  async respond(id,p,response,overnight){await db.runTransaction(async tx=>{const r=ref(id).collection('participants').doc(p.id),s=await tx.get(r);if(!s.exists||s.data().revision!==p.revision)throw new Error('参加情報が更新されました。最新情報を取得してください');tx.update(r,{response,overnight,revision:p.revision+1,updatedAt:stamp()});});},
  async finance(id,op){await db.runTransaction(async tx=>{const r=ref(id).collection('private').doc('ledger'),s=await tx.get(r);const old=s.exists?s.data():null;
   const next=applyLedger(old,op,uid,new Date().toISOString());if(old?.history?.[op.id])return;
   tx.set(r,{...next,updatedAt:stamp()});tx.set(ref(id).collection('public').doc('finance'),{...publicReport(next),updatedAt:stamp()});
  });},
 };
}
