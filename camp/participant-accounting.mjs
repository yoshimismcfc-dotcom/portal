import {totals} from './free-model.mjs?v=20261024-2';
// Existence of a charge, rather than its amount, distinguishes unset from free.
export function participantAccount(ledger={},id,today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})){
 const configured=Object.hasOwn(ledger.charges||{},id),b=totals(ledger).balances[id]||{billed:0,received:0,due:0,credit:0};
 const status=!configured?'参加費未設定':b.credit>0?'過入金・返金確認':b.due===0?(b.billed===0?'参加費0円':'徴収済み'):b.received>0?'一部入金':'未徴収';
 const due=ledger.charges?.[id]?.due||'',overdue=configured&&b.due>0&&!!due&&due<today;return {...b,configured,status,overdue};
}
