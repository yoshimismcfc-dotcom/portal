// 予定と実績を分離する予算書。既存の入出金台帳は変更しない。
import {amount,check,entries} from './free-model.mjs';
export const kinds={expense:'支出',income:'補助・その他収入',feeChild:'子ども参加費',feeAdult:'大人参加費'};
export const targets={all:'全体',players:'子ども',adults:'大人',transport:'交通費に充当'};
export const quantityModes={manual:'手入力',players:'参加する子ども',adults:'参加する大人',playersOvernight:'宿泊する子ども',adultsOvernight:'宿泊する大人',all:'参加者全員'};
export const categories={hotel:'宿泊費',meal:'食事代',leisure:'レジャー',transport:'交通費',insurance:'保険',supplies:'備品',reserve:'予備費',support:'援助・補助',other:'その他',participation:'参加費'};
export function peopleCounts(people=[]) {const yes=people.filter(p=>p.response==='yes');return {players:yes.filter(p=>p.kind==='player').length,adults:yes.filter(p=>p.kind!=='player').length,playersOvernight:yes.filter(p=>p.kind==='player'&&p.overnight).length,adultsOvernight:yes.filter(p=>p.kind!=='player'&&p.overnight).length,all:yes.length};}
const optionalNumber=v=>{if(v===null||v===undefined||v==='')return null;check(typeof v==='number','金額・数量は数字で入力してください');return amount(v);};
export function validateLine(d) {
 const text=(v,n)=>typeof v==='string'&&v.length<=n;
 check(text(d.title,150)&&d.title.trim(),'費目を入力してください（150文字以内）');
 check(Object.hasOwn(kinds,d.kind)&&Object.hasOwn(categories,d.category)&&Object.hasOwn(targets,d.target)&&Object.hasOwn(quantityModes,d.quantityMode),'区分・費目・人数の指定を確認してください');
 check(text(d.notes,1000),'補足は1000文字以内で入力してください');
 const unit=optionalNumber(d.unit),quantity=optionalNumber(d.quantity);
 check(quantity===null||quantity<=10000,'数量は0〜10000で入力してください');
 check(unit===null||quantity===null||Number.isSafeInteger(unit*quantity)&&unit*quantity<=100000000,'1行の予定額は1億円以下にしてください');
 check(!(d.kind==='expense'&&d.target==='transport'),'支出の対象は全体・子ども・大人から選択してください');
 if(d.kind==='feeChild')check(d.target==='players'&&d.category==='participation','子ども参加費の対象・費目を確認してください');
 if(d.kind==='feeAdult')check(d.target==='adults'&&d.category==='participation','大人参加費の対象・費目を確認してください');
 check(d.kind.startsWith('fee')||d.category!=='participation','参加費は子ども・大人参加費の区分で入力してください');
 return {title:d.title.trim(),kind:d.kind,category:d.category,target:d.target,quantityMode:d.quantityMode,unit,quantity,notes:d.notes,archived:d.archived===true};
}
export function legacyLine(row){return {...row,source:'budgets',kind:'expense',category:'other',target:'all',quantityMode:'manual',legacy:true};}
export function lineTotal(row){return row.unit===null||row.unit===undefined||row.quantity===null||row.quantity===undefined?null:amount(row.unit)*amount(row.quantity);}
export function budgetSummary(rows,people=[],rounding=100){
 check([1,10,100,500,1000].includes(rounding),'端数単位を確認してください');
 const active=rows.filter(x=>!x.archived),counts=peopleCounts(people);let expense=0,fees=0,other=0,pending=0;
 const group={players:0,adults:0},aid={players:0,adults:0};let shared=0,sharedAid=0,transport=0,transportAid=0;
 for(const r of active){const n=lineTotal(r);if(n===null){pending++;continue;}
  if(r.kind==='expense'){expense+=n;if(r.category==='transport')transport+=n;else if(r.target==='players'||r.target==='adults')group[r.target]+=n;else shared+=n;}
  else if(r.kind==='income'){other+=n;if(r.target==='transport')transportAid+=n;else if(r.target==='players'||r.target==='adults')aid[r.target]+=n;else sharedAid+=n;}
  else fees+=n;
 }
 check([expense,fees,other].every(Number.isSafeInteger),'予算総額が大きすぎます');
 // 交通費専用援助の余剰は別用途に流用しない。個別援助も対象外に配らない。
 const transportSurplus=Math.max(0,transportAid-transport);shared+=Math.max(0,transport-transportAid);
 let sharedNeed=Math.max(0,shared-sharedAid),sharedSurplus=Math.max(0,sharedAid-shared);
 const direct={players:Math.max(0,group.players-aid.players),adults:Math.max(0,group.adults-aid.adults)};
 const directSurplus={players:Math.max(0,aid.players-group.players),adults:Math.max(0,aid.adults-group.adults)};
 // 全体援助の残りだけを、個別費用へ人数比例で充てる。
 const directTotal=direct.players+direct.adults;if(sharedSurplus&&directTotal){const use=Math.min(sharedSurplus,directTotal),child=Math.min(direct.players,use*direct.players/directTotal);direct.players-=child;direct.adults-=use-child;sharedSurplus-=use;}
 const shares={players:counts.all?counts.players/counts.all:0,adults:counts.all?counts.adults/counts.all:0};
 const suggested={};for(const key of ['players','adults']){const required=Math.max(0,direct[key]+sharedNeed*shares[key]-directSurplus[key]);const per=counts[key]?Math.ceil(required/counts[key]/rounding)*rounding:null;suggested[key]={required,per,rounded:per===null?0:per*counts[key],surplus:per===null?0:per*counts[key]-required};}
 const restrictedSurplus=transportSurplus+Math.max(0,directSurplus.players-sharedNeed*shares.players)+Math.max(0,directSurplus.adults-sharedNeed*shares.adults);
 return {expense,fees,other,income:fees+other,balance:fees+other-expense,pending,required:Math.ceil(suggested.players.required+suggested.adults.required+(counts.all?0:sharedNeed)),surplus:Math.max(0,other-expense),counts,suggested,restrictedSurplus,unallocated:counts.all?0:sharedNeed,rounding};
}
export function sourceKey(row){return (row.source==='budgets'?'legacy_':'line_')+row.id;}
export function snapshot(row){const d=validateLine(row);return {...d,sourceId:row.id,sourceCollection:row.source==='budgets'?'budgets':'budgetLines',sourceRevision:row.revision,archived:false,zeroConfirmed:false,confirmedLedgerRevision:-1};}
export function draftPreview(rows,drafts){const active=rows.filter(r=>!r.archived);return active.map(row=>{const old=drafts.find(d=>d.id===sourceKey(row));return {row,id:sourceKey(row),old,state:!old?'new':old.sourceRevision===row.revision?'same':'changed'};});}
export function actualFor(draft,ledger={}) {
 const xs=entries(ledger.entries).map(([,v])=>v).filter(v=>!v.void),linked=xs.filter(x=>x.budgetId===draft.id);
 let amountValue=0,count=0;
 if(draft.kind==='feeChild'||draft.kind==='feeAdult'){
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
