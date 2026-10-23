import {planFees,feeRoles,budgetFeeInputs} from './bulk-fees-model.mjs?v=20261024-2';
import {totals} from './free-model.mjs?v=20261024-2';
export function createBulkFeesUI(ctx){
 const {edit,button,yen,getCamp,service,reload,message}=ctx,$=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;},field=(key,title,type='text',options)=>({key,title,type,options});
 function open(initial={}){
  const c=getCamp(),roles=Object.entries(feeRoles).filter(([key])=>key!=='other'||c.participants.some(p=>p.kind===key)),defaults={mode:'both',duePolicy:'keep',commonDue:'',overwrite:false,includePending:false,includeNo:false,byKind:false,...initial};
  const advanced=f=>({...f,advanced:true}),fields=[field('mode','設定する内容','text',[['both','参加費と期限'],['amount','参加費だけ'],['due','期限だけ']]),...roles.map(([r,t])=>({...field('fee_'+r,t+'（円）','number'),optionalNumber:true})),field('duePolicy','支払期限','text',[['keep','変更しない（新規は期限なし）'],['set','日付を指定する'],['clear','未設定に戻す']]),field('commonDue','共通の支払期限','date'),advanced(field('byKind','区分ごとに期限を変える','checkbox')),...roles.map(([r,t])=>advanced(field('due_'+r,t+'の支払期限','date'))),advanced(field('overwrite','設定済みの参加費も変更する','checkbox')),advanced(field('includePending','未回答の人も含める','checkbox')),advanced(field('includeNo','不参加の人も含める','checkbox'))];
  const update=()=>{const get=k=>$('fields').querySelector('[name="'+k+'"]'),hide=(k,v)=>{const l=$('fields').querySelector('[data-field="'+k+'"]');if(l)l.hidden=v;},mode=get('mode').value,policy=get('duePolicy').value,byKind=get('byKind').checked;for(const [r]of roles){hide('fee_'+r,mode==='due');hide('due_'+r,mode==='amount'||policy!=='set'||!byKind);}hide('duePolicy',mode==='amount');hide('commonDue',mode==='amount'||policy!=='set'||byKind);hide('byKind',mode==='amount'||policy!=='set');hide('overwrite',mode==='due');};
  edit('参加費をまとめて設定',fields,defaults,async input=>{const plan=planFees(getCamp(),input);return()=>confirm(input,plan);},{saveLabel:'内容を確認する',onInput:update});
  const box=$('fields');box.classList.add('bulk-fee-form');box.prepend(el('p','参加する人の未設定分だけに適用します。空欄は変更せず、0円は無料です。','bulk-fee-hint'));
  const importStatus=el('p',undefined,'bulk-fee-hint');importStatus.setAttribute('role','status');const importButton=button('予算から金額を取り込む',()=>{const result=budgetFeeInputs(getCamp().budgetBook?.lines),imported=[];for(const [k,v]of Object.entries(result.values)){const n=box.querySelector('[name="'+k+'"]');if(n&&n.value===''){n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));imported.push(k);}}const text=imported.length?'予算金額を入力欄へ反映しました。まだ保存していません。'+(result.ambiguous.length?' 複数明細の区分は手入力してください。':''):'取り込める空欄がありません。予算の金額・重複明細を確認し、手入力してください。';importStatus.textContent=text;message(text);});importButton.classList.add('secondary');box.append(importButton,importStatus);update();
 }
 function confirm(input,plan){
  const camp=getCamp(),id=camp.id,op={id:crypto.randomUUID(),type:'charges',revision:plan.revision,changes:plan.changes},old=camp.ledger.charges||{},balances=totals(camp.ledger).balances;
  edit('この内容で設定しますか？',[],{},async()=>{await service.finance(id,op);},{saveLabel:'この内容で設定する',savingLabel:'設定しています…',successText:plan.changes.length+'人の参加費・期限を設定しました。',onCancel:()=>open(input)});
  const box=$('fields');box.classList.add('bulk-fee-confirm');box.append(el('p','請求額・支払期限を設定します。入金は作成しません。','bulk-fee-hint'));
  for(const [r,g]of Object.entries(plan.groups))box.append(el('p',feeRoles[r]+' '+g.count+'人 ／ 変更後の請求 '+yen(g.total),'bulk-fee-group'));
  const nums=el('div',undefined,'participant-balances');for(const [title,value]of [['今回変更する請求合計',yen(plan.changedTotal)],['設定後の全体請求合計',yen(plan.total)]]){const d=el('div');d.append(el('span',title),el('strong',value));nums.append(d);}box.append(nums,el('p','新規 '+plan.newCount+'人 ／ 変更 '+plan.updatedCount+'人 ／ 変更しない '+plan.skipped+'人','bulk-fee-hint'));
  const deadlines=[...new Set(plan.changes.map(x=>x.due))];box.append(el('p','支払期限：'+(deadlines.length===1?(deadlines[0]||'期限なし'):'対象者ごと（内訳で確認）'),'bulk-fee-hint'));
  const detail=el('details',undefined,'bulk-fee-people');detail.open=!!input.overwrite||input.mode==='due';detail.append(el('summary','対象者と変更前後を確認（'+plan.changes.length+'人）'));
  for(const c of plan.changes){const before=old[c.participantId],b=balances[c.participantId],received=b?.received||0,d=el('div',undefined,'bulk-fee-person');d.append(el('strong',c.name),el('span',(before?yen(before.amount):'未設定')+' → '+yen(c.amount)),el('span','期限 '+(before?.due||'なし')+' → '+(c.due||'なし')));if(received)d.append(el('span','入金 '+yen(received)+' ／ 変更後 '+(received>c.amount?'過入金 '+yen(received-c.amount):'未徴収 '+yen(c.amount-received))));detail.append(d);}box.append(detail);
  const refresh=button('最新情報で確認し直す',async()=>{if($('save').disabled)return;await reload();open(input);message('最新情報で入力内容を再確認し、「内容を確認する」を押してください。');});refresh.classList.add('secondary');box.append(refresh);
 }
 return{open};
}
