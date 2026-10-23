import {totals} from './free-model.mjs';
// Existence of a charge, rather than its amount, distinguishes unset from free.
export function participantAccount(ledger={},id){
 const configured=Object.hasOwn(ledger.charges||{},id),b=totals(ledger).balances[id]||{billed:0,received:0,due:0,credit:0};
 const status=!configured?'参加費未設定':b.credit>0?'過入金・返金確認':b.due===0?(b.billed===0?'参加費0円':'徴収済み'):b.received>0?'一部入金':'未徴収';
 return {...b,configured,status};
}
