// 予定と実績を分離する予算書。既存の入出金台帳は変更しない。
import {amount,check,entries} from './free-model.mjs';
export const feeTargets={feeChild:'players',feeAdult:'adults',feeParent:'parents',feeCoach:'coaches',feeOther:'others'};
export const kinds={expense:'支出',income:'補助・その他収入',feeChild:'団員参加費',feeAdult:'大人参加費（従来の一括区分）',feeParent:'保護者参加費',feeCoach:'コーチ参加費',feeOther:'その他参加費'};
export const targets={all:'全体',players:'団員',adults:'大人全員',parents:'保護者',coaches:'コーチ',others:'その他参加者',transport:'交通費に充当'};
export const quantityModes={manual:'手入力',players:'参加する団員',adults:'参加する大人全員',parents:'参加する保護者',coaches:'参加するコーチ',others:'参加するその他の方',playersOvernight:'宿泊する団員',adultsOvernight:'宿泊する大人全員',parentsOvernight:'宿泊する保護者',coachesOvernight:'宿泊するコーチ',othersOvernight:'宿泊するその他の方',all:'参加者全員'};
export const rateBases={person:'1人あたり',room:'1部屋あたり',fixed:'一式・1回あたり'};
export const categories={hotel:'宿泊費',meal:'食事代',leisure:'レジャー',transport:'交通費',insurance:'保険',supplies:'備品',reserve:'予備費',support:'援助・補助',other:'その他',participation:'参加費'};
export function peopleCounts(people=[]) {const yes=people.filter(p=>p.response==='yes');const counts={all:yes.length};for(const [key,kind] of [['players','player'],['parents','parent'],['coaches','coach'],['others','other']]){counts[key]=yes.filter(p=>p.kind===kind).length;counts[key+'Overnight']=yes.filter(p=>p.kind===kind&&p.overnight).length;}counts.adults=counts.parents+counts.coaches+counts.others;counts.adultsOvernight=counts.parentsOvernight+counts.coachesOvernight+counts.othersOvernight;return counts;}
export function matchesFee(person,kind){const target=feeTargets[kind];return target==='adults'?['parent','coach','other'].includes(person.kind):({players:'player',parents:'parent',coaches:'coach',others:'other'})[target]===person.kind;}
const optionalNumber=v=>{if(v===null||v===undefined||v==='')return null;check(typeof v==='number','金額・数量は数字で入力してください');return amount(v);};
export function validateLine(d) {
 const text=(v,n)=>typeof v==='string'&&v.length<=n;
 check(text(d.title,150)&&d.title.trim(),'費目を入力してください（150文字以内）');
 check(Object.hasOwn(kinds,d.kind)&&Object.hasOwn(categories,d.category)&&Object.hasOwn(targets,d.target)&&Object.hasOwn(quantityModes,d.quantityMode),'区分・費目・人数の指定を確認してください');
 check(text(d.notes,1000),'補足は1000文字以内で入力してください');
 const unit=optionalNumber(d.unit),quantity=optionalNumber(d.quantity);
 const basis=d.basis??'person',multiplier=d.multiplier??1;
 check(Object.hasOwn(rateBases,basis),'単価の単位を確認してください');
 check(Number.isInteger(multiplier)&&multiplier>=1&&multiplier<=100,'泊数・回数は1〜100で入力してください');
 check(basis==='person'||d.quantityMode==='manual','部屋数・一式の数量は手入力で指定してください');
 check(quantity===null||quantity<=10000,'数量は0〜10000で入力してください');
 check(unit===null||quantity===null||Number.isSafeInteger(unit*quantity*multiplier)&&unit*quantity*multiplier<=100000000,'1行の予定額は1億円以下にしてください');
 check(!(d.kind==='expense'&&d.target==='transport'),'支出は全体または参加者の区分を選択してください。交通費は費目で指定します');
 if(feeTargets[d.kind])check(d.target===feeTargets[d.kind]&&d.category==='participation'&&basis==='person'&&multiplier===1,'参加費の対象・費目を確認してください。参加費は合宿全体の1人分で入力します');
 check(d.kind.startsWith('fee')||d.category!=='participation','参加費は団員・保護者・コーチなどの参加費区分で入力してください');
 return {title:d.title.trim(),kind:d.kind,category:d.category,target:d.target,quantityMode:d.quantityMode,unit,quantity,notes:d.notes,archived:d.archived===true,...(Object.hasOwn(d,'basis')||Object.hasOwn(d,'multiplier')?{basis,multiplier}:{})};
}
export function legacyLine(row){return {...row,source:'budgets',kind:'expense',category:'other',target:'all',quantityMode:'manual',legacy:true};}
export function lineTotal(row){return row.unit===null||row.unit===undefined||row.quantity===null||row.quantity===undefined?null:amount(row.unit)*amount(row.quantity)*(row.multiplier??1);}
export function budgetSummary(rows,people=[],rounding=100){
 check([1,10,100,500,1000].includes(rounding),'端数単位を確認してください');
 const active=rows.filter(x=>!x.archived),counts=peopleCounts(people);let expense=0,fees=0,other=0,pending=0;
 const keys=['players','parents','coaches','others'],cost=Object.fromEntries(keys.map(k=>[k,0])),aid={...cost};let shared=0,sharedAid=0,transport=0,transportAid=0,adultCost=0,adultAid=0;const transportCosts={};
 const addCost=(target,n)=>{if(target==='adults')adultCost+=n;else if(keys.includes(target))cost[target]+=n;else shared+=n;};
 for(const r of active){const n=lineTotal(r);if(n===null){pending++;continue;}
  if(r.kind==='expense'){expense+=n;if(r.category==='transport'){transport+=n;transportCosts[r.target]=(transportCosts[r.target]||0)+n;}else addCost(r.target,n);}
  else if(r.kind==='income'){other+=n;if(r.target==='transport')transportAid+=n;else if(r.target==='adults')adultAid+=n;else if(keys.includes(r.target))aid[r.target]+=n;else sharedAid+=n;}
  else fees+=n;
 }
 check([expense,fees,other].every(Number.isSafeInteger),'予算総額が大きすぎます');
 // 従来の「大人全員」は保護者・コーチ・その他に人数比例で配分。対象者0人なら未配分のまま残す。
 for(const [target,n] of Object.entries(transportCosts))addCost(target,transport?n*Math.max(0,transport-transportAid)/transport:0);
 const adultNet=adultCost-adultAid;for(const key of keys.filter(k=>k!=='players'))if(counts.adults){cost[key]+=Math.max(0,adultNet)*counts[key]/counts.adults;aid[key]+=Math.max(0,-adultNet)*counts[key]/counts.adults;}
 const sharedNeed=Math.max(0,shared-sharedAid),sharedSurplus=Math.max(0,sharedAid-shared),net=Object.fromEntries(keys.map(k=>[k,cost[k]-aid[k]]));
 const adultBase=counts.adults?0:Math.max(0,adultNet),positive=keys.reduce((n,k)=>n+Math.max(0,net[k]),0)+adultBase,use=Math.min(sharedSurplus,positive),suggested={};
 let restrictedSurplus=Math.max(0,transportAid-transport)+(counts.adults?0:Math.max(0,-adultNet));
 for(const key of keys){const common=counts.all?sharedNeed*counts[key]/counts.all:0;const used=positive?use*Math.max(0,net[key])/positive:0,required=Math.max(0,net[key]-used+common);
  const per=counts[key]?Math.max(0,Math.ceil(required/counts[key]/rounding-1e-9))*rounding:null;suggested[key]={required,per,rounded:per===null?0:per*counts[key],surplus:per===null?0:per*counts[key]-required};restrictedSurplus+=Math.max(0,-net[key]-common);
 }
 // 旧呼出元向けの大人集計も維持。役割別の請求額はこの平均から自動作成しない。
 const adults=keys.filter(k=>k!=='players').map(k=>suggested[k]),adultRequired=adults.reduce((n,v)=>n+v.required,0),adultRounded=adults.reduce((n,v)=>n+v.rounded,0);
 suggested.adults={required:adultRequired,per:counts.adults?Math.ceil(adultRequired/counts.adults/rounding)*rounding:null,rounded:adultRounded,surplus:adultRounded-adultRequired};
 const commonUnallocated=counts.all?0:sharedNeed,adultUnallocated=adultBase-(positive?use*adultBase/positive:0),unallocated=commonUnallocated+adultUnallocated+keys.filter(k=>!counts[k]).reduce((n,k)=>n+suggested[k].required,0);
 return {expense,fees,other,income:fees+other,balance:fees+other-expense,pending,required:Math.max(0,Math.ceil(keys.reduce((n,k)=>n+suggested[k].required,0)+commonUnallocated+adultUnallocated-1e-7)),surplus:Math.max(0,other-expense),counts,suggested,restrictedSurplus,unallocated,rounding};
}

export function sourceKey(row){return (row.source==='budgets'?'legacy_':'line_')+row.id;}
export function snapshot(row){const d=validateLine(row);return {...d,sourceId:row.id,sourceCollection:row.source==='budgets'?'budgets':'budgetLines',sourceRevision:row.revision,archived:false,zeroConfirmed:false,confirmedLedgerRevision:-1};}
export function draftPreview(rows,drafts){const active=rows.filter(r=>!r.archived);return active.map(row=>{const old=drafts.find(d=>d.id===sourceKey(row));return {row,id:sourceKey(row),old,state:!old?'new':old.sourceRevision===row.revision?'same':'changed'};});}
export function actualFor(draft,ledger={}) {
 const xs=entries(ledger.entries).map(([,v])=>v).filter(v=>!v.void),linked=xs.filter(x=>x.budgetId===draft.id);
 let amountValue=0,count=0;
 if(feeTargets[draft.kind]){
  // 各参加費は請求に記録した予算行と実入金から集計。請求だけでは実績にしない。
  const ids=new Set(entries(ledger.charges).filter(([,c])=>c.budgetId===draft.id).map(([id])=>id));
  for(const x of xs)if(ids.has(x.participantId)&&['payment','refund'].includes(x.kind)){amountValue+=(x.kind==='refund'?-1:1)*x.amount;count++;}
 }else for(const x of linked){if((draft.kind==='expense'&&x.kind==='expense')||(draft.kind==='income'&&x.kind==='income')){amountValue+=x.amount;count++;}}
 return {amount:count?amountValue:draft.zeroConfirmed?0:null,count};
}
export function comparison(drafts,ledger){return drafts.filter(d=>!d.archived).map(d=>{const actual=actualFor(d,ledger),planned=lineTotal(d);return {...d,planned,actual:actual.amount,transactions:actual.count,difference:actual.amount===null||planned===null?null:actual.amount-planned};});}
export const templates=[
 ['子ども宿泊費','hotel','players','playersOvernight'],['大人宿泊費','hotel','adults','adultsOvernight'],['宿泊追加料金','hotel','all','manual'],
 ['1日目昼食','meal','all','all'],['2日目昼食','meal','all','all'],['その他の食事・飲み物','meal','all','manual'],
 ['子ども入場料','leisure','players','players'],['大人入場料','leisure','adults','adults'],['体験・施設利用料','leisure','all','manual'],
 ['ガソリン代','transport','all','manual'],['高速道路代','transport','all','manual'],['駐車場代','transport','all','manual'],['保険','insurance','all','manual'],['備品','supplies','all','manual'],['予備費','reserve','all','manual']
];
