import {validateSpecial,validateDetails,plannedAmount,specialPlan,validateAllocation,budgetAnchor,springDefaults} from './special-model.mjs';
import {applyLedger,publicReport,check} from './free-model.mjs';
export function createSpecialService(db,actor){
 const shared=id=>db.doc('campShared/'+id+'/specialBook/current'),privateRoot=id=>db.collection('campSpecialPrivate').doc(id),stamp=()=>firebase.firestore.FieldValue.serverTimestamp();
 const read=async ref=>{const s=await ref.get({source:'server'});return s.exists?{id:s.id,...s.data()}:null;};
 const api={
  async load(id){try{return {available:true,...(await read(shared(id))||{revision:0,items:{},allocation:{members:0,team:0,leisure:0,reserve:0,confirmed:false}})};}catch(e){if(e.code==='permission-denied')return {available:false,items:{},revision:0};throw e;}},
  async canManage(id){if(!actor)return false;try{const s=await read(db.doc('campSpecialAdmins/'+actor));return s?.enabled===true&&s.camps?.[id]===true;}catch(e){if(e.code==='permission-denied')return false;throw e;}},
  async details(id){return (await privateRoot(id).collection('items').get({source:'server'})).docs.map(s=>({id:s.id,...s.data()}));},
  async history(id){return (await privateRoot(id).collection('history').orderBy('updatedAt','desc').limit(100).get({source:'server'})).docs.map(s=>({id:s.id,...s.data()}));},
  async mutate(id,itemId,revision,operation,change){
   check(/^[\w-]{1,80}$/.test(itemId),'明細の識別子を確認してください');
   const signature=JSON.stringify(operation);
   await db.runTransaction(async tx=>{
    const itemRef=privateRoot(id).collection('items').doc(itemId),itemSnap=await tx.get(itemRef),summarySnap=await tx.get(shared(id));const old=itemSnap.exists?itemSnap.data():null,book=summarySnap.exists?summarySnap.data():{revision:0,items:{},allocation:{members:0,team:0,leisure:0,reserve:0,confirmed:false}};
    if(old?.lastOperation===operation.id){check(old.signature===signature,'再試行時の内容が異なります');return;}
    check((old?.revision||0)===revision,'別の担当者が明細を変更しました。最新情報を取得してください');
    const next=await change({tx,old,book}),clean=validateSpecial(next.public),version=revision+1;check(!old||old.public.kind===clean.kind,'登録後の収支区分は変更できません');
    const pub={...clean,id:itemId,revision:version};const body={public:pub,details:validateDetails(next.details),revision:version,actor,lastOperation:operation.id,signature,updatedAt:stamp()};
    const items={...book.items,[itemId]:pub};check(Object.keys(items).length<=100,'特別明細は100件以内にしてください');
    tx.set(itemRef,body);tx.set(privateRoot(id).collection('history').doc(itemId+'__'+version),{itemId,before:old,after:body,actor,updatedAt:stamp()});
    tx.set(shared(id),{items,allocation:{...book.allocation,confirmed:false},revision:book.revision+1,lastItemId:itemId,historyId:itemId+'__'+version,updatedAt:stamp()});
   });
  },
  async save(id,itemId,revision,data,details,anchor,operationId){const clean=validateSpecial(data);return this.mutate(id,itemId,revision,{id:operationId,type:'save',clean,details,anchor:anchor||null},async({tx,old,book})=>{
   // 実績の参照・適用額は編集フォームでは変更しない。
   clean.entryIds=old?.public.entryIds||[];clean.discountActual=old?.public.discountActual||null;
   if(clean.flow==='discount'&&clean.includeBudget&&clean.status!=='cancelled'){
    check(anchor,'値引きを対応づける宿泊費を選択してください');const snap=await tx.get(db.doc('campShared/'+id+'/'+anchor.source+'/'+anchor.id));check(snap.exists,'対応する宿泊費がありません');const current={...snap.data(),id:anchor.id,source:anchor.source};check(!current.archived&&(anchor.source==='budgets'||current.category==='hotel'),'有効な宿泊費を選択してください');check(current.revision===anchor.revision,'宿泊費が更新されました。最新情報を確認してください');clean.budgetAnchor=budgetAnchor(current,anchor.basis);check(Object.values(book.items).filter(r=>r.id!==itemId&&r.status!=='cancelled'&&r.includeBudget&&r.budgetAnchor?.id===anchor.id&&r.budgetAnchor?.source===anchor.source).every(r=>r.budgetAnchor.basis===anchor.basis),'同じ宿泊費で値引き前／値引き後の指定が混在しています');
   }else clean.budgetAnchor=null;
   if(clean.status==='settled')check(clean.entryIds.length||clean.discountActual,'実際の入出金・値引きを記録してから適用済みにしてください');
   if(old?.public.entryIds.length||old?.public.discountActual)check(clean.owner===old.public.owner&&clean.flow===old.public.flow&&clean.consentVerified===old.public.consentVerified,'実績登録後は帰属・受取方法・了承を変更できません。実績を確認してください');
   return {public:clean,details};
  });},
  async linkCash(id,row,entryId,operationId){return this.mutate(id,row.id,row.revision,{id:operationId,type:'link',entryId},async({tx,old,book})=>{
   const p=old.public;check(p.status!=='cancelled'&&p.flow==='cash'&&p.owner!=='unknown'&&p.ownershipVerified&&p.eligibilityVerified&&(p.owner!=='personal'||p.kind==='aid'&&p.consentVerified)&&(p.kind!=='expense'||p.funding!=='unknown'),'資格・帰属・了承を確認してください');
   const snap=await tx.get(db.doc('campShared/'+id+'/private/ledger')),entry=snap.data()?.entries?.[entryId];check(entry&&!entry.void&&entry.kind===(p.kind==='expense'?'expense':'income'),'対応する入出金記録を選択してください');
   check(!Object.values(book.items).some(x=>x.entryIds.includes(entryId)),'この入出金は既に特別収支へ対応づけられています');
   return {public:{...p,entryIds:[...p.entryIds,entryId],status:'settled'},details:old.details};
  });},
  async recordCash(id,row,amount,date,operationId){return this.mutate(id,row.id,row.revision,{id:operationId,type:'cash',amount,date},async({tx,old})=>{
   const p=old.public;check(p.status!=='cancelled'&&p.flow==='cash'&&p.owner!=='unknown'&&p.ownershipVerified&&p.eligibilityVerified&&(p.owner!=='personal'||p.kind==='aid'&&p.consentVerified)&&(p.kind!=='expense'||p.funding!=='unknown'),'資格・団体会計への帰属・了承を確認してください');
   check(Number.isSafeInteger(amount)&&amount>0&&amount<=100000000,'実績金額は1円〜1億円で入力してください');check(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date,'実際の日付を入力してください');
   const ledgerRef=db.doc('campShared/'+id+'/private/ledger'),s=await tx.get(ledgerRef),ledger=s.exists?s.data():null;
   const op={id:operationId,type:'entry',revision:ledger?.revision||0,kind:p.kind==='expense'?'expense':'income',amount,date,category:p.kind==='expense'?'特別支出':'特別補助',reference:operationId,note:'特別収支から記録',payer:p.kind==='expense'&&p.funding==='individual'?'個人立替（詳細は管理者記録）':'',settled:false};
   const next=applyLedger(ledger,op,'special-admin',new Date().toISOString());
   // すべての読み取りを終えてから書く。
   tx.set(ledgerRef,{...next,updatedAt:stamp()});tx.set(db.doc('campShared/'+id+'/public/finance'),{...publicReport(next),updatedAt:stamp()});
   return {public:{...p,entryIds:[...p.entryIds,operationId],status:'settled'},details:old.details};
  });},
  async recordDiscount(id,row,data,operationId){const reference=String(data.reference||'').trim();check(reference&&reference.length<=150,'値引きの適用識別番号を入力してください');const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(reference.normalize('NFKC').toLowerCase()));const referenceKey=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');return this.mutate(id,row.id,row.revision,{id:operationId,type:'discount',data},async({tx,old,book})=>{
   const p=old.public;check(p.kind==='aid'&&p.flow==='discount'&&p.owner==='camp'&&p.ownershipVerified&&p.eligibilityVerified&&p.status!=='cancelled','資格・団体への帰属を確認し、宿泊費値引きを選択してください');
   check(Number.isSafeInteger(data.amount)&&data.amount>=0&&data.amount<=100000000&&['gross','net'].includes(data.basis),'適用額と宿泊費の記録方法を確認してください');
   const s=await tx.get(db.doc('campShared/'+id+'/private/ledger')),entry=s.data()?.entries?.[data.entryId];check(entry&&!entry.void&&entry.kind==='expense','宿泊費の支払記録を選択してください');
   check(!Object.values(book.items).some(r=>r.id!==row.id&&r.discountActual?.referenceKey===referenceKey),'この値引きの適用識別番号は登録済みです。重複適用しません');const others=Object.values(book.items).filter(r=>r.id!==row.id&&r.discountActual?.entryId===data.entryId).map(r=>r.discountActual);
   check(others.every(a=>a.basis===data.basis),'同じ支払記録で値引き前／値引き後が混在しています');
   if(data.basis==='gross')check(others.reduce((n,a)=>n+a.amount,0)+data.amount<=entry.amount,'値引き額が支払記録の金額を超えています');
   return {public:{...p,discountActual:{amount:data.amount,entryId:data.entryId,entryAmount:entry.amount,basis:data.basis,referenceKey},status:'settled'},details:{...old.details,verification:data.evidence||old.details.verification,discountReference:reference}};
  });},
  async clearDiscount(id,row,evidence,operationId){check(typeof evidence==='string'&&evidence.trim(),'値引き実績を取り消す理由を入力してください');return this.mutate(id,row.id,row.revision,{id:operationId,type:'clearDiscount',evidence},async({old})=>{check(old.public.discountActual,'値引き実績がありません');return {public:{...old.public,discountActual:null,status:old.public.status==='cancelled'?'cancelled':'confirmed'},details:{...old.details,verification:'値引き実績取消：'+evidence}};});},
  async seedSpring(id,camp){const actual=await read(db.doc('campShared/'+id));check(actual&&actual.name===camp.name&&actual.start===camp.start&&actual.end===camp.end,'合宿の基本情報が更新されています。最新情報を取得してください');check(camp.start==='2027-03-13'&&camp.end==='2027-03-14'&&camp.name.includes('春'),'春合宿の日程・名称を確認してください');
   for(const r of springDefaults){const existing=await read(privateRoot(id).collection('items').doc(r.id));if(existing)continue;await this.save(id,r.id,0,r,{verification:'初期試算。資格・帰属・支払者・受給者は要確認。'},null,'seed-'+r.id);}
  },
  async allocate(id,data,base,operationId){await db.runTransaction(async tx=>{const ref=shared(id),s=await tx.get(ref);check(s.exists,'特別明細を先に登録してください');const book=s.data(),net=specialPlan(book,base).net,allocation=validateAllocation(data,net);check(data.basisRevision===book.revision,'特別収支が更新されました。配分を確認し直してください');const history=privateRoot(id).collection('history').doc('allocation__'+operationId),previous=await tx.get(history);if(previous.exists)return;tx.set(history,{itemId:'allocation',before:book.allocation,after:allocation,actor,updatedAt:stamp()});tx.set(ref,{...book,allocation,revision:book.revision+1,lastItemId:'',historyId:'allocation__'+operationId,updatedAt:stamp()});});}
 };return api;
}
