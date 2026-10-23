// 特別収支は独立した原本。通常予算や入出金へ予定額を複製しない。
import {check,amount} from './free-model.mjs';
export const specialStates={planned:'予定',checking:'確認中',confirmed:'確定',settled:'支払済み・適用済み',cancelled:'取消'};
export const fundingSources={unknown:'未確認',team:'団費',pool:'コーチプール金',individual:'個人',other:'その他'};
export const owners={unknown:'未確認',camp:'団体会計',personal:'個人受給'};
export const uses={all:'合宿全体',players:'団員',hotel:'宿泊費',transport:'交通費',leisure:'観光・レクリエーション',reserve:'予備費'};
export const detailFields={schemeName:'補助制度の正式名称',applicationBasis:'加入・申請の根拠',beneficiaries:'対象者・確認記録',payer:'支払者',recipient:'受給者',ownershipEvidence:'団体会計への帰属の根拠',consentEvidence:'受給者の了承・資金移動の記録',verification:'確認状況・確認者',discountReference:'値引きの適用識別番号（請求書の補助内訳など）',note:'管理者向け備考'};
const num=v=>v===null||v===undefined||v===''?null:amount(v);
const text=(v,n)=>typeof v==='string'&&v.length<=n;
export function plannedAmount(r){return r.amountMode==='total'?r.amount:r.unit==null||r.quantity==null?null:r.unit*r.quantity;}
export function validateSpecial(data){
 const d={kind:'expense',title:'特別支出',amountMode:'unit',unit:null,quantity:1,amount:null,confirmedAmount:null,due:'',status:'planned',funding:'unknown',owner:'unknown',flow:'cash',use:'all',includeBudget:false,eligibilityVerified:false,ownershipVerified:false,consentVerified:false,budgetAnchor:null,entryIds:[],discountActual:null,...data};
 check(['expense','aid'].includes(d.kind),'収支区分を確認してください');check(text(d.title,80)&&d.title.trim(),'共有用の項目名を80文字以内で入力してください');
 check(['unit','total'].includes(d.amountMode)&&Object.hasOwn(specialStates,d.status)&&Object.hasOwn(fundingSources,d.funding)&&Object.hasOwn(owners,d.owner)&&Object.hasOwn(uses,d.use)&&['cash','discount'].includes(d.flow),'区分・状況を確認してください');
 d.unit=num(d.unit);d.quantity=num(d.quantity);d.amount=num(d.amount);d.confirmedAmount=num(d.confirmedAmount);check(d.quantity===null||d.quantity<=10000,'数量は0〜10000で入力してください');
 const planned=plannedAmount(d);check(planned===null||Number.isSafeInteger(planned)&&planned<=100000000,'予定額は1億円以下の整数にしてください');
 check(text(d.due,10)&&(d.due===''||/^\d{4}-\d{2}-\d{2}$/.test(d.due)&&Number.isFinite(Date.parse(d.due+'T00:00:00Z'))&&new Date(d.due+'T00:00:00Z').toISOString().slice(0,10)===d.due),'予定日を確認してください');
 for(const k of ['includeBudget','eligibilityVerified','ownershipVerified','consentVerified'])check(typeof d[k]==='boolean','確認項目を確認してください');
 check(Array.isArray(d.entryIds)&&d.entryIds.length<=100&&new Set(d.entryIds).size===d.entryIds.length&&d.entryIds.every(x=>typeof x==='string'&&/^[\w-]{1,100}$/.test(x)),'実績の参照を確認してください');
 check(d.kind!=='expense'||d.flow==='cash','特別支出は支払として記録してください');
 // 個人受給は了承があっても自動的に団体収入とはしない。予算への明示的な反映と実入金を別に確認する。
 if(d.kind==='expense'&&d.owner==='personal')check(!d.includeBudget,'個人負担は団体支出へ計上しません。団体経費の個人立替は団体会計を選択してください');
 if(d.owner==='personal'&&d.includeBudget)check(d.consentVerified&&d.flow==='cash','個人受給は了承と団体への資金移動予定を確認し、後日入金として扱ってください');
 if(d.includeBudget)check(d.owner!=='unknown','団体会計への帰属を選択してください');
 const allowed=['kind','title','amountMode','unit','quantity','amount','confirmedAmount','due','status','funding','owner','flow','use','includeBudget','eligibilityVerified','ownershipVerified','consentVerified','budgetAnchor','entryIds','discountActual'];
 return Object.fromEntries(allowed.map(k=>[k,k==='title'?d[k].trim():d[k]]));
}
export function validateDetails(details={}){return Object.fromEntries(Object.keys(detailFields).map(k=>{const v=details[k]??'';check(text(v,3000),'管理者記録は各3000文字以内で入力してください');return [k,v];}));}
export function budgetAnchor(line,basis){check(line&&['gross','net'].includes(basis),'値引きを対応づける宿泊費と、値引き前／後を選んでください');return {source:line.source==='budgets'?'budgets':'budgetLines',id:line.id,revision:line.revision,total:line.unit==null||line.quantity==null?null:line.unit*line.quantity*(line.multiplier??1),basis};}
const accepted=r=>r.includeBudget&&r.owner!=='unknown'&&(r.owner!=='personal'||r.kind==='aid'&&r.consentVerified&&r.flow==='cash');
const expected=r=>plannedAmount(r);
export const publicItems=book=>Object.values(book?.items||{});
export function specialPlan(book={},base=[]){
 let aid=0,expense=0,cashAid=0,discount=0,pending=0,unverified=0,variances=0;const adjustments={},issues=[],modes={},discountAmounts={},conflicts=new Set();
 for(const r of publicItems(book).filter(r=>r.status!=='cancelled')){
  if(!accepted(r))continue;const n=expected(r);if(n===null){pending++;continue;}if(!r.eligibilityVerified||!r.ownershipVerified)unverified++;if(r.confirmedAmount!==null&&r.confirmedAmount!==n)variances++;
  if(r.kind==='expense')expense+=n;
  else if(r.flow==='cash'){aid+=n;cashAid+=n;}
  else {const a=r.budgetAnchor,line=a&&base.find(l=>l.id===a.id&&(l.source==='budgets'?'budgets':'budgetLines')===a.source);
   if(!line||line.category!=='hotel'&&a.source!=='budgets'||line.archived||line.revision!==a.revision||line.unit==null||line.quantity==null||line.unit*line.quantity*(line.multiplier??1)!==a.total){issues.push('宿泊費が未設定または更新されています。値引きの対応づけを管理者が確認してください。');continue;}
   const key=a.source+'/'+a.id;aid+=n;discountAmounts[key]=(discountAmounts[key]||0)+n;if(modes[key]&&modes[key]!==a.basis)conflicts.add(key);modes[key]=a.basis;if(a.basis==='gross')adjustments[key]=(adjustments[key]||0)+n;
  }
 }
 for(const key of conflicts){aid-=discountAmounts[key];delete adjustments[key];issues.push('同じ宿泊費で値引き前／後の指定が混在しています。管理者が再確認するまで反映しません。');}
 for(const [key,n] of Object.entries(adjustments)){const line=base.find(l=>(l.source==='budgets'?'budgets':'budgetLines')+'/'+l.id===key);const max=line.unit*line.quantity*(line.multiplier??1);if(n>max){issues.push('宿泊費を超える値引きがあります。該当の値引きは収支へ反映していません。');delete adjustments[key];aid-=n;}else discount+=n;}
 return {aid,expense,net:aid-expense,cashAid,discount,adjustments,pending,unverified,variances,issues};
}
export function specialBudgetRows(book,base){const s=specialPlan(book,base);const adjusted=base.map(r=>{const n=s.adjustments[(r.source==='budgets'?'budgets':'budgetLines')+'/'+r.id];return n?{...r,unit:r.unit*r.quantity*(r.multiplier??1)-n,quantity:1,multiplier:1}:r;});
 for(const r of publicItems(book).filter(r=>r.status!=='cancelled'&&accepted(r)&&expected(r)!==null)){
  if(r.kind==='aid'&&r.flow==='discount')continue;
  adjusted.push({id:'special-'+r.id,title:r.kind==='expense'?'特別支出':'特別補助',kind:r.kind==='expense'?'expense':'income',category:r.kind==='expense'?'other':'support',target:['players','transport'].includes(r.use)&&r.kind==='aid'?r.use:'all',unit:expected(r),quantity:1,quantityMode:'manual',notes:'',archived:false});
 }return adjusted;
}
export function specialActual(book={},ledger={}){
 let aid=0,expense=0,discount=0,applied=0;const rows=[],issues=[],byEntry={},adjustments={},seen=new Set();
 for(const r of publicItems(book)){
  const cash=[...new Set(r.entryIds||[])].filter(id=>{if(seen.has(id)){issues.push('同じ台帳記録への重複参照があります。二重集計していません。');return false;}seen.add(id);return true;}).map(id=>ledger.entries?.[id]).filter(x=>x&&!x.void&&x.kind===(r.kind==='expense'?'expense':'income'));let value=cash.length?cash.reduce((n,x)=>n+x.amount,0):null;
  if(r.kind==='expense')expense+=value??0;else aid+=value??0;
  if(r.discountActual){const a=r.discountActual,x=ledger.entries?.[a.entryId];
   if(!x||x.void||x.kind!=='expense'||x.amount!==a.entryAmount){issues.push('宿泊費の実績が変更されています。値引きの適用を再確認してください。');}
   else{value=a.amount;applied+=value;aid+=value;const group=byEntry[a.entryId]||{gross:0,net:0,max:x.amount};group[a.basis]+=value;byEntry[a.entryId]=group;}
  }rows.push({...r,actual:value,planned:r.status==='cancelled'?0:expected(r),difference:value===null||expected(r)===null?null:value-expected(r)});
 }
 for(const [key,g] of Object.entries(byEntry)){if(g.gross&&g.net||g.gross>g.max)issues.push('同じ宿泊費で値引き前／後が混在、または値引きが過大です。追加の値引きは反映していません。');else{discount+=g.gross;if(g.gross)adjustments[key]=g.gross;}}
 return {aid,expense,net:aid-expense,discount,applied,rows,issues,adjustments};
}
export function specialReport(report,book,ledger){if(!report)return report;const s=specialActual(book,ledger),categories={...report.categories};for(const [key,n] of Object.entries(s.adjustments)){const category='expense:'+ledger.entries[key].category;if(Object.hasOwn(categories,category))categories[category]-=n;}return {...report,categories,expense:report.expense-s.discount,balance:report.balance+s.discount,ledgerExpense:report.expense,ledgerBalance:report.balance,special:s};}
export function validateAllocation(a,net){const clean={members:amount(a.members??0),team:amount(a.team??0),leisure:amount(a.leisure??0),reserve:amount(a.reserve??0),confirmed:a.confirmed===true};check(clean.members+clean.team+clean.leisure+clean.reserve<=Math.max(0,net),'配分額が特別収支の差引を超えています');return clean;}
export function simulation({children=20,adults=10,childRate=8085,adultRate=10930,largeAdults=0,largeRate=12030,aid=60000,expense=18600}={}){for(const v of [children,adults,childRate,adultRate,largeAdults,largeRate,aid,expense])amount(v);check(largeAdults<=adults,'大部屋の大人人数は大人全員の人数以内にしてください');const hotel=children*childRate+(adults-largeAdults)*adultRate+largeAdults*largeRate;check(Number.isSafeInteger(hotel)&&hotel<=100000000,'試算額が大きすぎます');return {hotel,aid,expense,burden:hotel-aid+expense,net:aid-expense,perChild:children?Math.floor((aid-expense)/children):null,remainder:children?(aid-expense)%children:null};}
export const springDefaults=[
 {id:'spring-2027-expense',...validateSpecial({kind:'expense',title:'補助利用関連費',unit:6200,quantity:3,owner:'camp',includeBudget:true})},
 {id:'spring-2027-aid',...validateSpecial({kind:'aid',title:'宿泊費補助',unit:3000,quantity:20,owner:'camp',includeBudget:true,use:'hotel'})}
];
