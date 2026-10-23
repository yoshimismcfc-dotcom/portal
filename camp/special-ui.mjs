import {specialPlan,specialActual,specialBudgetRows,simulation,publicItems,specialStates} from './special-model.mjs';
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export const baseBudgetLines=c=>[...c.budgets.map(r=>({...r,source:'budgets',kind:'expense',category:'other',target:'all',quantityMode:'manual'})),...(c.budgetBook?.lines||[]).map(r=>({...r,source:'budgetLines'}))];
export const effectiveBudgetLines=c=>specialBudgetRows(c.specialBook,baseBudgetLines(c));
export function renderSpecial(parent,c,button,yen,actual=false){
 const book=c.specialBook||{},plan=specialPlan(book,baseBudgetLines(c)),s=actual?specialActual(book,c.ledger):plan;
 const box=node('details',undefined,'budget-section special-book');box.append(node('summary','明細・試算・配分を見る'));
 const stats=node('div',undefined,'special-totals');for(const [name,value] of [['特別補助',s.aid],['特別支出',s.expense],['差引収支',s.net]]){const d=node('div');const entered=!actual||s.rows.some(r=>r.actual!==null&&(name==='差引収支'||r.kind===(name==='特別補助'?'aid':'expense')));d.append(node('span',name),node('strong',!book.available?'設定待ち':entered?(name==='差引収支'&&value>0?'+':'')+yen(value):'未入力'));stats.append(d);}
 // 3つの集計は常時表示。詳細だけを折りたたむ。
 const heading=node('h3',actual?'特別収支（実績）':plan.unverified?'特別収支（予算・要確認）':'特別収支（予算）');parent.append(heading,stats,box);
 if(!book.available)box.append(node('p','特別収支の保存設定は準備中です。既存の予算・決算は引き続き利用できます。','small'));
 else{
  if(!publicItems(book).length)box.append(node('p','まだ特別明細がありません。明細を追加すると集計へ反映されます。','small'));
  if(!actual&&plan.unverified)box.append(node('p','資格・会計への帰属が要確認の試算を含みます。実際の入出金には計上していません。','budget-alert'));
  if(!actual&&plan.variances)box.append(node('p','予定額と確定額が異なる明細があります。予算には予定額を使用します。','budget-alert'));if(!actual&&plan.pending)box.append(node('p',plan.pending+'項目は金額未定です。','small'));
  for(const issue of s.issues)box.append(node('p',issue,'budget-alert'));
  if(actual){box.append(node('p','未入力は実績0円とは区別します。支払・入金は台帳の実記録から集計します。値引きは入金にせず、宿泊費が値引き前で記録されている場合だけ追加反映します。','small'));
   for(const r of s.rows){const p=node('p');p.append(node('strong',r.title+'：'),node('span',(r.actual===null?'実績未入力':yen(r.actual))+' ／ '+(r.status==='settled'&&r.actual===null?'台帳変更：実績を再確認してください':specialStates[r.status])));box.append(p);}
  }
  const a=book.allocation||{},alloc=node('p','配分：'+(a.confirmed?'確定':'未確定')+' ／ 団員参加費 '+yen(a.members||0)+'・団費 '+yen(a.team||0)+'・観光 '+yen(a.leisure||0)+'・予備費 '+yen(a.reserve||0),'small');box.append(alloc,node('p','配分だけで請求額や入出金は変更しません。参加費は担当者が別途確認して設定します。','small'));
  const sim=node('details',undefined,'special-simulation');sim.append(node('summary','宿泊先を比較・試算する'));
  const form=node('div',undefined,'special-inputs'),inputs={};
  function input(key,label,value){const l=node('label',label),n=node('input');n.type='number';n.min='0';n.step='1';n.inputMode='numeric';n.value=value;n.setAttribute('aria-label',label);inputs[key]=n;l.append(n);form.append(l);return n;}
  const facility=node('select');facility.setAttribute('aria-label','比較する宿泊先');for(const [v,t] of [['sanraku','山楽荘'],['todoroki','伊香保温泉とどろき']]){const o=node('option',t);o.value=v;facility.append(o);}const facilityLabel=node('label','宿泊先');facilityLabel.append(facility);sim.append(facilityLabel);
  input('children','子ども人数',20);input('adults','大人人数',10);input('childRate','子ども1人の宿泊費（円）',8085);input('adultRate','通常客室・大人1人（円）',10930);input('largeAdults','大部屋の大人人数',0);input('largeRate','大部屋・大人1人（円）',12030);input('aid','特別補助（円）',plan.aid);input('expense','特別支出（円）',plan.expense);
  const out=node('p',undefined,'notice');out.setAttribute('aria-live','polite');const update=()=>{try{if(Object.values(inputs).some(n=>n.value===''))throw Error('未入力の項目があります');const result=simulation(Object.fromEntries(Object.entries(inputs).map(([k,n])=>[k,Number(n.value)])));out.textContent='宿泊費 '+yen(result.hotel)+' − 補助 '+yen(result.aid)+' ＋ 特別支出 '+yen(result.expense)+' ＝ 実質負担 '+yen(result.burden)+' ／ 団員1人の負担軽減参考 '+(result.perChild===null?'人数未定':yen(result.perChild))+'（余り '+yen(result.remainder||0)+'）';}catch(e){out.textContent=e.message;}};
  form.addEventListener('input',update);facility.onchange=()=>{inputs.childRate.value=facility.value==='todoroki'?8910:8085;inputs.adultRate.value=facility.value==='todoroki'?12030:10930;update();};sim.append(form,out,node('p','指定された通常客室料金・1泊での比較用試算です。全補助・支出の団体帰属を仮定します。試算は保存済みの予算・請求を変更しません。','small'));update();box.append(sim);
 }
 const link=node('a','特別支出・補助を追加・編集');link.href='camp-special.html#'+c.id;link.className='special-admin-link';box.append(link);
 return {plan,actual:s};
}
export function appendSpecialPrint(paper,c,yen,actual=false){const s=actual?specialActual(c.specialBook,c.ledger):specialPlan(c.specialBook,baseBudgetLines(c));if(!c.specialBook?.available)return;
 const value=(kind,n)=>actual&&!s.rows.some(r=>r.actual!==null&&(!kind||r.kind===kind))?'未入力':(kind===null&&n>0?'+':'')+yen(n);paper.append(node('h2','特別収支'+(actual?'（実績）':'（予算）')),node('p','特別補助 '+value('aid',s.aid)+' ／ 特別支出 '+value('expense',s.expense)+' ／ 差引 '+value(null,s.net)));
 if(!actual&&s.discount)paper.append(node('p','宿泊費の値引き '+yen(s.discount)+' は支出予定から1回だけ差し引いています。'));
 if(!actual&&s.unverified)paper.append(node('p','確認中の試算を含みます。'));
 if(!actual&&s.aid-s.cashAid>s.discount)paper.append(node('p','値引き後の宿泊費は追加控除していません。値引きは現金入金に含めません。'));if(actual&&s.applied)paper.append(node('p','適用された宿泊費値引き '+yen(s.applied)+' は現金入金に含めません。'));if(actual&&s.discount)paper.append(node('p','宿泊費（値引き前の記録）から値引き '+yen(s.discount)+' を反映。現金入金には含めません。'));
}
