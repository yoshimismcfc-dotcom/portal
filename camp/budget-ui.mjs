import {kinds,targets,quantityModes,rateBases,feeTargets,matchesFee,categories,peopleCounts,validateLine,legacyLine,lineTotal,budgetSummary,draftPreview,comparison,templates} from './budget-model.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fields=(key,title,type='text',options)=>({key,title,type,options});
const numeric=(key,title)=>({...fields(key,title,'number'),optionalNumber:true});
const allLines=c=>[...c.budgets.map(legacyLine),...c.budgetBook.lines.map(r=>({...r,source:'budgetLines'}))];
const rateText=r=>(r.quantity??'未定')+(r.basis==='room'?'部屋':r.basis==='fixed'?'式':r.category==='hotel'||r.kind.startsWith('fee')||r.quantityMode!=='manual'?'人':'件')+(r.category==='hotel'?' × '+(r.multiplier??1)+'泊':(r.multiplier??1)>1?' × '+r.multiplier+'回':'');
const amountText=(r,yen)=>lineTotal(r)===null?'未入力':yen(lineTotal(r));
export function createBudgetUI(ctx){
 const {getCamp,service,edit,button,message,reload,yen}=ctx;
 const section=(p,title)=>{const d=el('details',undefined,'budget-section');d.open=true;d.append(el('summary',title));const box=el('div');d.append(box);p.append(d);return box;};
 const actions=(...bs)=>{const n=el('div',undefined,'budget-actions');n.append(...bs);return n;};
 function form(row={}){
  const c=getCamp(),recordId=row.id||crypto.randomUUID(),counts=peopleCounts(c.participants),initial={kind:'expense',category:'other',target:'all',quantityMode:'manual',unit:null,quantity:1,notes:'',archived:false,...(c.budgetBook.ratesAvailable?{basis:'person',multiplier:1}:{}),...row};
  const extended=c.budgetBook.ratesAvailable;
  const options=(obj,old)=>Object.entries(obj).filter(([key])=>extended||old.includes(key));
  edit(row.id?'予算項目を編集':'予算項目を追加',row.legacy?[fields('title','費目（必須）'),numeric('unit','単価（円）'),numeric('quantity','数量・人数'),fields('notes','補足','textarea')]:[
   fields('title','費目（必須）'),fields('kind','収支の区分','text',options(kinds,['expense','income','feeChild','feeAdult'])),fields('category','集計する費目','text',Object.entries(categories)),fields('target','対象・援助の使途','text',options(targets,['all','players','adults','transport'])),
   numeric('unit','単価（円・未定なら空欄）'),numeric('quantity','人数・部屋数・数量（未定なら空欄）'),fields('quantityMode','人数の参照元（部屋数は手入力）','text',options(quantityModes,['manual','players','adults','playersOvernight','adultsOvernight','all'])),...(extended?[fields('basis','単価の単位','text',Object.entries(rateBases)),{...numeric('multiplier','泊数・回数（参加費は1）'),optionalNumber:false}]:[]),fields('notes','補足（部屋名・食事込み・補助の予定／確定など）','textarea')
  ],initial,async d=>{
   const clean=validateLine({...initial,...d,archived:initial.archived});
   if(clean.quantityMode!=='manual'&&clean.quantity!==counts[clean.quantityMode]){
    if(!confirm('現在の名簿は'+counts[clean.quantityMode]+'人です。入力した'+(clean.quantity??'未定')+'人で保存しますか？'))throw new Error('人数を確認して保存してください。名簿の人数は自動で上書きしません。');
   }
   if(row.legacy){
    // 旧予算行は旧構造のまま編集。構造変更は新規項目で行う。
    if(clean.kind!=='expense'||clean.unit===null||clean.quantity===null||clean.category!=='other'||clean.target!=='all'||clean.quantityMode!=='manual')throw new Error('過去の予算は従来形式で保存します。新しい区分は「予算項目を追加」で作成してください。');
    await service.save(c.id,'budgets',{id:row.id,title:clean.title,unit:clean.unit,quantity:clean.quantity,notes:clean.notes,archived:false,revision:row.revision});
   }else await service.saveBudget(c.id,{...clean,id:recordId,revision:row.revision||0});
  });
 }
 function addTemplate(){const recordId=crypto.randomUUID(),counts=peopleCounts(getCamp().participants);const choices=[...templates.map((r,i)=>['expense:'+i,r[0]]),['feeChild','団員参加費'],...(getCamp().budgetBook.ratesAvailable?[['feeParent','保護者参加費'],['feeCoach','コーチ参加費'],['feeOther','その他参加費'],['room:players','子ども部屋（1部屋料金）'],['room:adults','大人部屋（1部屋料金）']]:[['feeAdult','大人参加費']]),['income:all','団費からの補助'],['income:transport','コーチのプール金からの援助（交通費）'],['income:other','寄付・その他収入']];
  edit('よく使う費目から選ぶ',[fields('template','追加する費目','text',choices)],{},async d=>{
   let row={unit:null,quantity:1,quantityMode:'manual',notes:'',archived:false,...(getCamp().budgetBook.ratesAvailable?{basis:'person',multiplier:1}:{})};
   if(d.template.startsWith('expense:')){const [title,category,target,mode]=templates[Number(d.template.split(':')[1])];row={...row,title,kind:'expense',category,target,quantityMode:mode,quantity:mode==='manual'?1:counts[mode]};}
   else if(d.template.startsWith('fee')){const target=feeTargets[d.template];row={...row,title:kinds[d.template],kind:d.template,category:'participation',target,quantityMode:target,quantity:counts[target]};}
   else if(d.template.startsWith('room:')){const target=d.template.split(':')[1];row={...row,title:target==='players'?'子ども部屋（部屋料金）':'大人部屋（部屋料金）',kind:'expense',category:'hotel',target,basis:'room',quantityMode:'manual',notes:'部屋タイプごとに追加してください。人数単価の宿泊費と二重に登録しないでください。'};}
   else {const key=d.template.split(':')[1];row={...row,title:key==='all'?'団費からの補助':key==='transport'?'コーチのプール金からの援助':'寄付・その他収入',kind:'income',category:key==='other'?'other':'support',target:key==='transport'?'transport':'all'};}
   await service.saveBudget(getCamp().id,{...row,id:recordId,revision:0});
  });
 }
 async function archive(row){if(!confirm('「'+row.title+'」を予算から外しますか？保存済みの決算下書き・実績は残ります。'))return;
  if(row.legacy)await service.save(getCamp().id,'budgets',{id:row.id,title:row.title,unit:row.unit,quantity:row.quantity,notes:row.notes,archived:true,revision:row.revision});
  else await service.saveBudget(getCamp().id,{...row,archived:true});await reload();message('予算項目を非表示にしました。決算実績は変更していません。');
 }
 function plan(p){const c=getCamp();
  if(!c.budgetBook?.available){p.append(el('div','新しい予算書は準備中です。管理担当に設定の確認を依頼してください。従来の予算は下から利用できます。','notice'));return false;}
  const rows=allLines(c).filter(r=>!r.archived),s=budgetSummary(rows,c.participants,c.budgetBook.settings.rounding);
  const heading=el('div',undefined,'budget-heading');heading.append(el('h2','合宿予算書'),button('予算書を印刷・PDF',()=>printBook('budget')));p.append(heading,el('p','宿泊・昼食・レジャー・参加費・補助を登録し、決算へコピーできます。予定額は実際の入出金と区別します。','small'));
  const summary=el('div',undefined,'stats budget-totals');for(const [title,v] of [['収入予定',s.income],['支出予定',s.expense],['差引予定',s.balance],['参加者から集める必要額',s.required]]){const stat=el('div',undefined,'stat');stat.append(el('span',title),el('strong',yen(v)));summary.append(stat);}p.append(summary);
  if(!c.budgetBook.ratesAvailable)p.append(el('p','参加者別の料金・部屋数／泊数計算はFirebase設定後に利用できます。現在の予算はそのまま編集できます。','notice'));
  if(rows.some(r=>r.kind==='feeAdult')&&rows.some(r=>['feeParent','feeCoach','feeOther'].includes(r.kind)))p.append(el('p','大人一括と役割別の参加費が両方あります。同じ人の参加費を二重に見込んでいないか確認してください。','budget-alert'));
  if(s.pending)p.append(el('p',s.pending+'項目が未入力です。合計は入力済み分の仮計算です。','budget-alert'));
  if(s.surplus)p.append(el('p','補助等の余剰予定 '+yen(s.surplus),'small'));
  if(s.restrictedSurplus)p.append(el('p','使途指定の援助に余りがあります（'+yen(s.restrictedSurplus)+'）。他の対象へ自動配分しません。','budget-alert'));
  p.append(actions(button('＋ 費目を選んで追加',addTemplate),button('＋ 自由に追加',()=>form()),button('予算から決算の下書きを作る',copyDialog)));
  for(const [kind,title] of [['expense','支出予算'],['income','参加費・援助などの収入予算']]){const box=section(p,title);if(kind==='expense')box.append(el('p','宿泊費は料金・部屋タイプごとに追加。1人料金と部屋料金の二重計上、食事込みの料金にご注意ください。','small'));const subset=rows.filter(r=>kind==='expense'?r.kind==='expense':r.kind!=='expense');
   if(!subset.length)box.append(el('p','まだ項目がありません。「費目を選んで追加」から登録してください。','small'));
   for(const r of subset){const card=el('article',undefined,'budget-row');const top=el('div',undefined,'budget-row-heading');top.append(el('strong',r.title),el('strong',amountText(r,yen)));card.append(top);
    const equation=el('div',undefined,'budget-equation');equation.append(el('span',(r.unit===null?'未定':yen(r.unit))+' × '+rateText(r)+' '+(r.quantityMode==='manual'?'':quantityModes[r.quantityMode])),el('span',targets[r.target]+' ／ '+kinds[r.kind]));card.append(equation);
    if(r.quantityMode!=='manual'&&r.quantity!==s.counts[r.quantityMode])card.append(el('p','名簿は現在'+s.counts[r.quantityMode]+'人です。保存済みは'+r.quantity+'人。編集して確認してください。','budget-alert'));
    const more=el('details');more.append(el('summary','補足・編集'));if(r.legacy)more.append(el('p','過去の予算：従来形式の支出項目として読み込んでいます。','small'));if(r.notes)more.append(el('p',r.notes));
    const bs=[button('編集',()=>form(r)),button('予算から外す',()=>archive(r))];if(r.quantityMode!=='manual'&&!r.legacy)bs.unshift(button('名簿の人数を取り込む',()=>{if(confirm('人数を'+s.counts[r.quantityMode]+'人へ更新しますか？'))return service.saveBudget(c.id,{...r,quantity:s.counts[r.quantityMode]}).then(async()=>{await reload();message('名簿の人数を取り込んで保存しました。');});}));more.append(actions(...bs));card.append(more);box.append(card);
   }
  }
  const fees=el('details',undefined,'budget-section');fees.append(el('summary','人数・参加費の参考計算'));const counts=s.counts;fees.append(el('p','参加確定：団員'+counts.players+'人・保護者'+counts.parents+'人・コーチ'+counts.coaches+'人・その他'+counts.others+'人','small'));
  fees.append(el('p','共通費は参加確定人数で配分します。対象・交通費を指定した補助は他へ流用しません。参加費の参考額から請求は自動作成しません。','small'));
  const select=el('select');select.setAttribute('aria-label','参考参加費の切り上げ単位');for(const v of [1,10,100,500,1000]){const o=el('option',v+'円単位で切り上げ');o.value=v;o.selected=v===s.rounding;select.append(o);}const label=el('label','端数処理');label.append(select);fees.append(label,button('端数単位を保存',async()=>{await service.saveBudgetSettings(c.id,Number(select.value),c.budgetBook.settings.revision);await reload();message('端数単位を保存しました。');}));
  for(const [key,title] of [['players','団員'],['parents','保護者'],['coaches','コーチ'],['others','その他']]){const v=s.suggested[key];fees.append(el('p',title+' 1人の参考額：'+(v.per===null?'人数未定':yen(v.per))+' ／ 丸めによる余り '+yen(Math.ceil(v.surplus))));}
  if(s.unallocated)fees.append(el('p','対象者が未登録の費用 '+yen(Math.ceil(s.unallocated))+'があります。人数・対象を確認してください。','budget-alert'));p.append(fees);return true;
 }
 function copyDialog(){const c=getCamp(),preview=draftPreview(allLines(c),c.budgetBook.drafts),candidates=preview.filter(x=>x.state!=='same');
  if(!candidates.length){message('すべての予算が決算下書きへコピー済みです。重複作成しません。');return;}
  edit('決算下書きへコピー（入出金は登録しません）',candidates.map(x=>fields(x.id,(x.state==='new'?'新規：':'基準予算を更新：')+x.row.title+' '+amountText(x.row,yen),'checkbox')),Object.fromEntries(candidates.map(x=>[x.id,x.state==='new'])),async d=>{const selected=candidates.filter(x=>d[x.id]);if(!selected.length)throw new Error('コピーする項目を選んでください');await service.copyBudget(c.id,selected);});
 }
 function settlement(p){const c=getCamp();if(!c.budgetBook?.available)return;const rows=comparison(c.budgetBook.drafts,c.ledger);const box=section(p,'予算と実績の比較');box.classList.add('settlement-comparison');
  box.append(el('p','予算はコピー時点の基準額です。実績は台帳の入金・支出から集計します。','small'),actions(button('予算から下書きを追加・更新',copyDialog),button('決算比較を印刷・PDF',()=>printBook('settlement'))));
  if(!rows.length)box.append(el('p','予算画面から「決算の下書きを作る」を押してください。','small'));
  for(const r of rows){const a=el('article',undefined,'budget-row');a.append(el('strong',r.title));const nums=el('div',undefined,'budget-compare-numbers');for(const [label,value] of [['予算',r.planned],['実績',r.actual],['差額',r.difference]]){const item=el('div');item.append(el('span',label),el('strong',value===null?'未入力':yen(value)));nums.append(item);}a.append(nums);
   let status=r.actual===null?'実績未入力':r.transactions?(r.confirmedLedgerRevision===c.ledger.revision?'実績確認済み':'台帳'+r.transactions+'件から集計（記録途中・未確認）'):'確認済み0円';if(r.difference!==null)status+=' ／ '+(r.kind==='expense'?(r.difference>0?'予算超過':'予算内'):(r.difference<0?'収入不足':'予算以上'));
   a.append(el('p',status,'small'));const controls=[];if(r.transactions&&r.confirmedLedgerRevision!==c.ledger.revision)controls.push(button('この実績を確認済みにする',async()=>{await service.confirmBudgetActual(c.id,r);await reload();message('現在の台帳をもとに実績を確認しました。台帳が更新されたら再確認してください。');}));
   if(r.kind.startsWith('fee'))controls.push(button('請求に紐づける',()=>linkCharges(r)));
   else controls.push(button(r.kind==='expense'?'支出を記録':'入金を記録',()=>recordActual(r)));
   controls.push(button('既存の記録を紐づける',()=>linkExisting(r)));
   if(!r.transactions)controls.push(button(r.zeroConfirmed?'0円確認を取り消す':'実績0円を確認',async()=>{if(confirm(r.zeroConfirmed?'0円確認を取り消しますか？':'取引のない実績0円と確認しますか？台帳には取引を作りません。')){await service.confirmBudgetZero(c.id,r,!r.zeroConfirmed);await reload();message('実績の確認状態を保存しました。');}}));
   const more=el('details');more.append(el('summary','実績の入力・紐づけ'),actions(...controls));a.append(more);box.append(a);
  }
  const unlinked=Object.values(c.ledger.entries||{}).filter(x=>!x.void&&!x.budgetId&&['income','expense'].includes(x.kind)).length;
  if(unlinked)box.append(el('p','予算項目に未紐づけの入出金が'+unlinked+'件あります。決算総額には含まれています。','budget-alert'));
 }
 function recordActual(draft){const c=getCamp(),id=crypto.randomUUID();edit('実際の'+(draft.kind==='expense'?'支払':'受領')+'を記録（予定額ではありません）',[fields('amount','実績金額（円・必須）','number'),fields('date','実際の日付','date'),fields('note','備考'),...(draft.kind==='expense'?[fields('payer','立替者（任意）'),fields('settled','立替精算済み','checkbox')]:[])],{amount:'',date:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}),note:'',payer:'',settled:false},d=>service.finance(c.id,{id,type:'entry',kind:draft.kind,revision:c.ledger.revision,...d,budgetId:draft.id,category:categories[draft.category],reference:id}));}
 function linkCharges(draft){const operationId=crypto.randomUUID(),c=getCamp(),people=c.participants.filter(p=>p.response==='yes'&&matchesFee(p,draft.kind));if(!people.length){message('対象となる参加確定者がいません。');return;}
  edit('既存の請求と参加費予算を紐づける',[fields('person','対象者','text',people.map(p=>[p.id,p.name])),fields('amount','請求総額（円・必須）','number')],{amount:draft.unit??''},async d=>{const person=people.find(p=>p.id===d.person);const old=c.ledger.charges?.[person.id];if(old?.budgetId&&old.budgetId!==draft.id)throw new Error('この請求は別の参加費予算に紐づいています。重複登録せず、元の参加費予算を確認してください。請求・入金は変更していません。');if(old&&old.amount!==d.amount&&!confirm(person.name+'さんの請求総額を'+yen(old.amount)+'から'+yen(d.amount)+'へ変更しますか？入金額は変わりません。'))throw new Error('請求は変更していません。');await service.finance(c.id,{id:operationId,type:'charge',revision:c.ledger.revision,participantId:person.id,name:person.name,household:person.familyUid||person.id,amount:d.amount,due:old?.due||'',budgetId:draft.id});});
 }
 function linkExisting(draft){const operationId=crypto.randomUUID(),c=getCamp();if(draft.kind.startsWith('fee')){linkCharges(draft);return;}
  const xs=Object.entries(c.ledger.entries||{}).filter(([,x])=>!x.void&&x.kind===draft.kind&&!x.budgetId);if(!xs.length){message('紐づけ可能な未設定の記録がありません。新しい入出金は「実績を記録」から登録できます。');return;}
  edit('台帳の金額を変えずに予算と紐づける',[fields('entryId','既存の記録','text',xs.map(([id,x])=>[id,(x.date||'')+' '+x.category+' '+yen(x.amount)]))],{},d=>service.finance(c.id,{id:operationId,type:'linkBudget',revision:c.ledger.revision,entryId:d.entryId,budgetId:draft.id}));
 }
 function printBook(type){const c=getCamp(),paper=el('section',undefined,'budget-print');paper.append(el('h1',c.name+' '+(type==='budget'?'予算書':'決算比較書')),el('p',c.start+'〜'+c.end+' ／ '+c.place));
  const table=el('table'),head=el('tr');for(const h of type==='budget'?['区分','費目','単価','数量','予定額']:['区分','費目','予算額','実績額','差額'])head.append(el('th',h));const thead=el('thead');thead.append(head);table.append(thead);const tbody=el('tbody');
  const rows=type==='budget'?allLines(c).filter(r=>!r.archived):comparison(c.budgetBook.drafts,c.ledger);
  for(const r of rows){const tr=el('tr');const values=type==='budget'?[kinds[r.kind],r.title,r.unit===null?'':yen(r.unit),rateText(r),lineTotal(r)===null?'':yen(lineTotal(r))]:[kinds[r.kind],r.title,r.planned===null?'':yen(r.planned),r.actual===null?'':yen(r.actual),r.difference===null?'':yen(r.difference)];for(const v of values)tr.append(el('td',String(v)));tbody.append(tr);}table.append(tbody);paper.append(table);
  const s=budgetSummary(allLines(c),c.participants,c.budgetBook.settings.rounding);paper.append(el('p','参加確定：子ども'+s.counts.players+'人・大人'+s.counts.adults+'人 ／ 収入予定 '+yen(s.income)+' ／ 支出予定 '+yen(s.expense)+' ／ 差引予定 '+yen(s.balance)));
  if(type==='budget'&&s.pending)paper.append(el('p','未入力 '+s.pending+'項目。合計は入力済み分の仮計算です。'));
  if(type==='settlement'){const report=c.report||{};paper.append(el('p','実績総額：収入 '+yen(report.income)+' ／ 支出 '+yen(report.expense)+' ／ 差引 '+yen(report.balance)),el('p','空欄は実績未入力。比較対象外・未紐づけの取引も実績総額に含みます。記録途中の費目は台帳を確認してください。'));}
  document.querySelectorAll('.budget-print').forEach(n=>n.remove());document.body.append(paper);document.body.classList.add('budget-printing');const cleanup=()=>{paper.remove();document.body.classList.remove('budget-printing');};window.addEventListener('afterprint',cleanup,{once:true});try{window.print();}catch(e){cleanup();throw e;}
 }
 return {plan,settlement};
}
