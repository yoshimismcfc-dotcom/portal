import {amount,check,totals,deadline} from './free-model.mjs?v=20261024-2';
export const feeRoles={player:'選手',coach:'コーチ',parent:'保護者',other:'その他'};
export const validDeadline=deadline;
export function planFees(camp,input){
 const mode=input.mode||'both',policy=input.duePolicy||'keep';check(['both','amount','due'].includes(mode)&&['keep','set','clear'].includes(policy),'設定方法を確認してください');check(mode!=='due'||policy!=='keep','期限だけ変更する場合は、日付指定または期限を未設定に戻す操作を選んでください');
 const ledger=camp.ledger||{revision:0,charges:{},entries:{},history:{}},changes=[],balances=totals(ledger).balances,groups={};
 for(const p of camp.participants){
  if(p.response!=='yes'&&!(p.response==='pending'&&input.includePending)&&!(p.response==='no'&&input.includeNo))continue;
  check(Object.hasOwn(feeRoles,p.kind),'参加区分を確認してください');const before=ledger.charges?.[p.id]||null;
  if(mode==='due'?!before:before&&!input.overwrite)continue;
  let value=before?.amount;
  if(mode!=='due'){const raw=input['fee_'+p.kind];if(raw===null||raw===undefined||raw==='')continue;value=amount(raw);}
  let due=before?.due||'';
  if(mode!=='amount'&&policy!=='keep'){
   if(policy==='clear')due='';else{due=input[input.byKind?'due_'+p.kind:'commonDue'];check(due,'支払期限を入力してください。期限なしにする場合は「未設定に戻す」を選んでください');validDeadline(due);}
  }
  if(before&&before.amount===value&&(before.due||'')===due)continue;
  const received=balances[p.id]?.received||0;
  changes.push({participantId:p.id,participantRevision:p.revision,name:p.name,household:p.familyUid||p.id,amount:value,due});
  const g=groups[p.kind]||={count:0,total:0};g.count++;g.total+=value;
 }
 check(changes.length>0,'変更する対象者がいません。区分の金額・出欠・設定済みの人を含めるかを確認してください');check(changes.length<=100,'一度に設定できるのは100人までです。今回は保存していません。');
 const beforeTotal=totals(ledger).billed,oldTotal=changes.reduce((n,c)=>n+(ledger.charges?.[c.participantId]?.amount||0),0),changedTotal=changes.reduce((n,c)=>n+c.amount,0);
 return {changes,groups,changedTotal,total:beforeTotal-oldTotal+changedTotal,newCount:changes.filter(c=>!Object.hasOwn(ledger.charges||{},c.participantId)).length,updatedCount:changes.filter(c=>Object.hasOwn(ledger.charges||{},c.participantId)).length,skipped:camp.participants.length-changes.length,revision:ledger.revision};
}
export function budgetFeeInputs(lines=[]){const map={player:'feeChild',coach:'feeCoach',parent:'feeParent',other:'feeOther'},values={},ambiguous=[];for(const [role,kind]of Object.entries(map)){const rows=lines.filter(x=>!x.archived&&x.kind===kind);if(rows.length===1&&rows[0].unit!==null&&rows[0].unit!==undefined&&(rows[0].basis||'person')==='person'&&(rows[0].multiplier||1)===1)values['fee_'+role]=amount(rows[0].unit);else if(rows.length>1)ambiguous.push(feeRoles[role]);}return{values,ambiguous};}
