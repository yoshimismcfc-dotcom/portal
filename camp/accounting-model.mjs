import {validateLine,lineTotal} from './budget-model.mjs';
// Total entry is represented by the existing unit × quantity structure, without a schema change.
export function budgetInput(initial,input){const d={...initial,...input};if(input.amountMode==='total'){
 if(d.kind.startsWith('fee'))throw Error('参加費は1人あたりの金額と人数で入力してください');
 d.unit=input.totalAmount;d.quantity=1;d.quantityMode='manual';if(Object.hasOwn(initial,'basis')){d.basis='fixed';d.multiplier=1;}
 }return validateLine(d);}
export function budgetInputDefaults(row){return {...row,amountMode:row.basis==='fixed'&&row.quantity===1&&(row.multiplier??1)===1?'total':'unit',totalAmount:lineTotal(row)};}
export function recordedMoney(ledger,report){const present=Object.values(ledger?.entries||{}).some(x=>!x.void);return {present,income:present?report?.income??0:null,expense:present?report?.expense??0:null,balance:present?report?.balance??0:null};}
