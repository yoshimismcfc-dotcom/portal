// 無料版の金額計算。円の整数だけを扱い、参加費を会計へ二重入力しない。
export const entries = x => Object.entries(x || {});
export function check(ok, message) { if (!ok) throw new Error(message); }
export function amount(v) { const n=Number(v); check(Number.isSafeInteger(n)&&n>=0&&n<=100000000,'金額は0〜1億円の整数で入力してください'); return n; }
export function deadline(v=''){if(v==='')return '';check(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v),'支払期限の日付を確認してください');const d=new Date(v+'T00:00:00Z');check(Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v,'支払期限の日付を確認してください');return v;}
export function totals(ledger={}) {
  const charges=ledger.charges||{}, payments={}, active=entries(ledger.entries).map(([,x])=>x).filter(x=>!x.void);
  for(const x of active.filter(x=>['payment','refund'].includes(x.kind))) payments[x.participantId]=(payments[x.participantId]||0)+(x.kind==='refund'?-x.amount:x.amount);
  const balances=Object.fromEntries(entries(charges).map(([id,x])=>[id,{billed:x.amount,received:payments[id]||0,due:Math.max(0,x.amount-(payments[id]||0)),credit:Math.max(0,(payments[id]||0)-x.amount)}]));
  const sum=(xs,key)=>xs.reduce((n,x)=>n+(x[key]||0),0), bs=Object.values(balances);
  const received=Object.values(payments).reduce((a,b)=>a+b,0), billed=sum(bs,'billed');
  const income=received+sum(active.filter(x=>x.kind==='income'),'amount'), expense=sum(active.filter(x=>x.kind==='expense'),'amount');
  return {billed,received,due:sum(bs,'due'),credit:sum(bs,'credit'),rate:billed?received/billed:null,income,expense,balance:income-expense,advances:sum(active.filter(x=>x.kind==='expense'&&x.payer&&!x.settled),'amount'),balances};
}
export function applyLedger(current, op, actor, at) {
  const ledger=structuredClone(current||{revision:0,charges:{},entries:{},history:{}});
  const signature=JSON.stringify(op);
  if(ledger.history?.[op.id]) { check(ledger.history[op.id].signature===signature,'同じ操作番号の内容が異なります'); return ledger; }
  check(ledger.revision===op.revision,'別の担当者が更新しました。最新情報を取得してから入力し直してください');
  ledger.charges ||= {}; ledger.entries ||= {}; ledger.history ||= {};
  if(op.budgetId)check(typeof op.budgetId==='string'&&/^(line_|legacy_)[^/]{1,150}$/.test(op.budgetId),'予算項目の識別子を確認してください');
  const chargeChanges=[];
  const setCharge=c=>{
    check(typeof c.participantId==='string'&&c.participantId,'参加者を選択してください');
    const old=ledger.charges[c.participantId]||null;
    check(!old?.budgetId||!c.budgetId||old.budgetId===c.budgetId,'この請求は別の予算項目に紐づいています');
    check(c.amount!==null&&c.amount!==undefined&&(typeof c.amount!=='string'||c.amount.trim()!==''),'参加費を入力してください（無料の場合は0）。');
    const next={amount:amount(c.amount),name:c.name,household:c.household||c.participantId,due:deadline(c.due||''),...((c.budgetId||old?.budgetId)?{budgetId:c.budgetId||old.budgetId}:{})};
    const note=c.note??old?.note;if(note!==undefined){check(typeof note==='string'&&note.length<=1000,'変更理由は1000文字以内で入力してください');next.note=note;}
    ledger.charges[c.participantId]=next;chargeChanges.push({participantId:c.participantId,before:old,after:next});
  };
  if(op.type==='charges') {
    check(Array.isArray(op.changes)&&op.changes.length>0&&op.changes.length<=100,'一括設定は1〜100人を選んでください');
    check(new Set(op.changes.map(c=>c.participantId)).size===op.changes.length,'同じ参加者を重複して設定できません');
    for(const c of op.changes)setCharge(c);
  } else if(op.type==='charge') {
    setCharge(op);
  } else if(op.type==='entry') {
    check(['payment','refund','income','expense'].includes(op.kind),'取引区分が不正です');
    const n=amount(op.amount);check(n>0,'取引金額は1円以上で入力してください');
    check(!['income','expense'].includes(op.kind)||op.category!=='参加費','参加費は入金から自動集計します');
    if(['payment','refund'].includes(op.kind))check(ledger.charges[op.participantId],'請求を先に登録してください');
    check(!entries(ledger.entries).some(([,x])=>!x.void&&x.reference===op.reference),'同じ入金・取引識別番号が登録済みです');
    check(typeof op.reference==='string'&&op.reference.trim(),'取引識別番号を入力してください');
    ledger.entries[op.id]={kind:op.kind,amount:n,participantId:op.participantId||'',category:op.category||'',date:op.date,reference:op.reference,note:op.note||'',payer:op.payer||'',settled:op.settled===true,void:false,actor,at,...(op.budgetId?{budgetId:op.budgetId}:{})};
  } else if(op.type==='linkBudget'){
    const x=ledger.entries[op.entryId];check(x&&!x.void&&['income','expense'].includes(x.kind),'対象の入出金記録がありません');check(op.budgetId&&!x.budgetId,'既に紐づけ済み、または予算項目が未指定です');x.budgetId=op.budgetId;
  } else {
    check(['void','settle'].includes(op.type)&&ledger.entries[op.entryId],'対象の取引がありません');
    if(op.type==='void')ledger.entries[op.entryId].void=true;
    else {check(ledger.entries[op.entryId].kind==='expense','支出だけ精算できます');ledger.entries[op.entryId].settled=true;}
  }
  const t=totals(ledger);check(Object.values(t.balances).every(x=>x.received>=0),'返金が入金額を超えています。返金または取消の順序を確認してください');
  ledger.revision++;ledger.history[op.id]={actor,at,signature,...(chargeChanges.length?{changes:chargeChanges}:{})};
  check(JSON.stringify(ledger).length<500000,'台帳の上限に近づきました。新しい合宿として分けてください');
  return ledger;
}
export function publicReport(ledger) {
  const t=totals(ledger), families=new Map();
  for(const [id,c] of entries(ledger.charges)) {const k=c.household||id, f=families.get(k)||{names:[],due:0};f.names.push(c.name);f.due+=t.balances[id].due;families.set(k,f);}
  const categories={};
  for(const [,x] of entries(ledger.entries).filter(([,x])=>!x.void&&['expense','income'].includes(x.kind))) {const k=x.kind+':'+x.category;categories[k]=(categories[k]||0)+x.amount;}
  const {balances,...summary}=t;
  return {...summary,revision:ledger.revision,unpaid:[...families.values()].filter(f=>f.due>0),categories};
}
export function estimate(rows, participantCount, fee) {
  const total=rows.reduce((s,x)=>s+amount(x.unit)*amount(x.quantity),0);
  check(Number.isSafeInteger(total),'予算総額が大きすぎます');
  return {expense:total,income:participantCount*amount(fee),balance:participantCount*amount(fee)-total,perPerson:participantCount?Math.ceil(total/participantCount):null};
}
export function mapURL(address) { return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address); }
