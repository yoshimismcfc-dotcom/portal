import {createSpecialService} from './special-service.mjs?v=20261023-10';
import {snapshot, sourceKey, validateLine, feeTargets, matchesFee} from './budget-model.mjs';
import {applyLedger, publicReport} from './free-model.mjs?v=20261024-2';
export function createService(db,uid,isAdmin) {
 const root=db.collection('campShared'), stamp=()=>firebase.firestore.FieldValue.serverTimestamp();
 const read=async ref=>{const s=await ref.get({source:'server'});return s.exists?{id:s.id,...s.data()}:null;};
 const rows=async ref=>(await ref.get({source:'server'})).docs.map(s=>({id:s.id,...s.data()}));
 const ref=id=>root.doc(id);
 return {
  async list(ids=[]){return (await Promise.all(ids.slice(0,50).map(id=>read(ref(id))))).filter(Boolean);},
  async load(id){const camp=await read(ref(id));if(!camp)throw new Error('合宿がありません');const role='leader';
   const [participants,routes,budgets,report,ledger]=await Promise.all([rows(ref(id).collection('participants')),rows(ref(id).collection('routes')),rows(ref(id).collection('budgets')),read(ref(id).collection('public').doc('finance')),read(ref(id).collection('private').doc('ledger'))]);
   const [budgetBook,specialBook]=await Promise.all([this.loadBudget(id),createSpecialService(db,uid).load(id)]);
   const link=null;
   return {...camp,role,participants,routes,budgets,report,link,budgetBook,specialBook,ledger:ledger||{revision:0,charges:{},entries:{},history:{}}};
  },
  async loadBudget(id){
   try{const settings=await read(ref(id).collection('private').doc('budgetSettings'));
    const [lines,drafts]=await Promise.all([rows(ref(id).collection('budgetLines')),rows(ref(id).collection('settlementDrafts'))]);
    let ratesAvailable=false;
    try{await read(ref(id).collection('private').doc('budgetRates'));ratesAvailable=true;}catch(e){if(e.code!=='permission-denied')throw e;}
    return {available:true,ratesAvailable,settings:settings||{revision:0,rounding:100},lines,drafts};
   }catch(e){if(e.code==='permission-denied')return {available:false,lines:[],drafts:[],settings:{revision:0,rounding:100}};throw e;}
  },
  async saveBudget(id,data){const clean=validateLine(data);await this.save(id,'budgetLines',{...clean,id:data.id,revision:data.revision||0});},
  async saveBudgetSettings(id,rounding,revision){if(![1,10,100,500,1000].includes(rounding))throw new Error('端数単位を確認してください');await this.save(id,'private',{id:'budgetSettings',rounding,revision});},
  async copyBudget(id,selected){
   if(new Set(selected.map(x=>sourceKey(x.row))).size!==selected.length)throw new Error('同じ予算項目を重複して選択しています');
   if(!selected.length||selected.length>100)throw new Error('コピーする項目を1〜100件選んでください');
   await db.runTransaction(async tx=>{
    const refs=selected.map(({row})=>({source:ref(id).collection(row.source==='budgets'?'budgets':'budgetLines').doc(row.id),draft:ref(id).collection('settlementDrafts').doc(sourceKey(row))}));
    const current=await Promise.all(refs.map(async r=>({source:await tx.get(r.source),draft:await tx.get(r.draft)})));
    for(let i=0;i<selected.length;i++){
     const {row,old}=selected[i],actual=current[i],src=actual.source.data(),previous=actual.draft.exists?actual.draft.data():null;
     if(!src||src.archived||src.revision!==row.revision)throw new Error('予算が更新されました。最新情報を取得して確認し直してください');
     const snap=snapshot(row);
     if(previous?.sourceRevision===row.revision)continue;
     if((previous?.revision||0)!==(old?.revision||0))throw new Error('決算下書きが別の端末で更新されました。確認し直してください');
     if(previous&&previous.kind!==snap.kind)throw new Error('決算下書き作成後は収支区分を変更できません。別の予算項目として追加してください');
     tx.set(refs[i].draft,{...snap,zeroConfirmed:previous?.zeroConfirmed||false,confirmedLedgerRevision:previous?.confirmedLedgerRevision??-1,revision:(previous?.revision||0)+1,updatedAt:stamp()});
    }
   });
  },
  async confirmBudgetActual(id,draft){await db.runTransaction(async tx=>{const r=ref(id).collection('settlementDrafts').doc(draft.id),s=await tx.get(r),ledger=await tx.get(ref(id).collection('private').doc('ledger'));if(!s.exists||s.data().revision!==draft.revision)throw new Error('決算下書きが更新されました。最新情報を確認してください');tx.update(r,{confirmedLedgerRevision:ledger.exists?ledger.data().revision:0,revision:draft.revision+1,updatedAt:stamp()});});},
  async confirmBudgetZero(id,draft,value){await db.runTransaction(async tx=>{const r=ref(id).collection('settlementDrafts').doc(draft.id),s=await tx.get(r);if(!s.exists||s.data().revision!==draft.revision)throw new Error('決算下書きが更新されました。最新情報を確認してください');tx.update(r,{zeroConfirmed:value,revision:draft.revision+1,updatedAt:stamp()});});},
  async create(data,id){await db.runTransaction(async tx=>{const r=ref(id),s=await tx.get(r);if(s.exists)return;tx.set(r,{...data,revision:0,updatedAt:stamp()});});return id;},
  async meta(id,data,revision){await db.runTransaction(async tx=>{const r=ref(id),s=await tx.get(r);if(s.data().revision!==revision)throw new Error('別の担当者が更新しました。最新情報を取得してください');tx.update(r,{...data,revision:revision+1,updatedAt:stamp()});});},
  async save(id,collection,data){const r=ref(id).collection(collection).doc(data.id),{id:recordId,...body}=data;
   await db.runTransaction(async tx=>{const s=await tx.get(r),revision=s.exists?s.data().revision:0;if(revision!==(body.revision||0))throw new Error('別の担当者が更新しました。最新情報を取得してください');tx.set(r,{...body,revision:revision+1,updatedAt:stamp()});});
  },
  async respond(id,p,response,overnight){await db.runTransaction(async tx=>{const r=ref(id).collection('participants').doc(p.id),s=await tx.get(r);if(!s.exists||s.data().revision!==p.revision)throw new Error('参加情報が更新されました。最新情報を取得してください');tx.update(r,{response,overnight,revision:p.revision+1,updatedAt:stamp()});});},
  async finance(id,op){await db.runTransaction(async tx=>{const r=ref(id).collection('private').doc('ledger'),s=await tx.get(r);const old=s.exists?s.data():null;if(old?.history?.[op.id]){applyLedger(old,op,uid,new Date().toISOString());return;}
   // Read every confirmed participant in the same transaction before any writes.
   const people=op.type==='charges'?op.changes:op.type==='charge'&&op.participantRevision!==undefined?[op]:[];
   if(!Array.isArray(people)||people.length>100)throw new Error('一括設定は100人までです。保存していません。');
   for(const person of people){const p=await tx.get(ref(id).collection('participants').doc(person.participantId));if(!p.exists||p.data().revision!==person.participantRevision)throw new Error('参加者の情報が更新されました。最新情報で確認し直してください');}
   if(op.budgetId){const d=await tx.get(ref(id).collection('settlementDrafts').doc(op.budgetId));
    if(!d.exists)throw new Error('決算下書きがありません。予算からコピーしてください');const draft=d.data();
    const kind=op.type==='linkBudget'?old?.entries?.[op.entryId]?.kind:op.kind;
    if(op.type==='charge'?!Object.hasOwn(feeTargets,draft.kind):draft.kind!==kind)throw new Error('予算と実績の収支区分が一致しません');
    if(op.type==='charge'){const person=await tx.get(ref(id).collection('participants').doc(op.participantId));if(!person.exists||person.data().response!=='yes'||!matchesFee(person.data(),draft.kind))throw new Error('参加費の対象者・参加区分が変更されました。最新情報を確認してください');}
   }
   const next=applyLedger(old,op,uid,new Date().toISOString());if(old?.history?.[op.id])return;
   tx.set(r,{...next,updatedAt:stamp()});tx.set(ref(id).collection('public').doc('finance'),{...publicReport(next),updatedAt:stamp()});
  });},
 };
}
