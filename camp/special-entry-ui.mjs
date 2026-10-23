// Shared-link editor. Private scheme/beneficiary records are never read or written here.
import {createSpecialService} from './special-service.mjs?v=20261023-10';
import {validateSpecial,specialStates,fundingSources,owners,uses,plannedAmount,publicItems} from './special-model.mjs';
import {baseBudgetLines} from './special-ui.mjs?v=20261023-10';
export function createSpecialEntryUI({getCamp,edit,button,message,reload,yen}){
 const field=(key,title,type='text',options,advanced=false)=>({key,title,type,options,advanced,optionalNumber:type==='number'});
 const api=()=>createSpecialService(firebase.firestore(),'shared-editor',{shared:true});
 function form(row){const c=getCamp(),initial=row||validateSpecial({kind:'aid',title:'補助',owner:'camp',includeBudget:true,unit:null,quantity:1}),itemId=initial.id||crypto.randomUUID(),operation=crypto.randomUUID(),base=baseBudgetLines(c),isAid=initial.kind==='aid';
  const fs=[field('title','項目名（必須・個人情報は入力しない）'),field('amountMode','金額の入力方法','text',[['unit','単価 × 人数・数量'],['total','合計額を入力']]),field('unit','単価（円）','number'),field('quantity','人数・数量','number'),field('amount','合計額（円）','number'),field('confirmedAmount','確定額（未確定は空欄）','number',undefined,true),field('status','確認・支払状況','text',Object.entries(specialStates),true),field('due','支払・入金予定日','date',undefined,true),field('funding','負担元','text',Object.entries(fundingSources),true),field('owner','団体・個人の区分','text',Object.entries(owners),true),field('use','使い道','text',Object.entries(uses),true),field('includeBudget','団体会計の予定へ含める（未確認は試算）','checkbox',undefined,true),field('eligibilityVerified','補助の適用条件・支払内容を確認した','checkbox',undefined,true),field('ownershipVerified','団体会計への帰属と資金の流れを確認した','checkbox',undefined,true),field('consentVerified','個人受給者の了承と団体への資金移動を確認した','checkbox',undefined,true)];
  if(isAid)fs.push(field('flow','受け取り方法','text',[['cash','団体へ入金'],['discount','宿泊費から直接値引き']],true),field('hotelLine','値引きする宿泊費','text',[['','未選択'],...base.filter(r=>!r.archived&&(r.category==='hotel'||r.source==='budgets')).map(r=>[r.source+'/'+r.id,r.title])],true),field('hotelBasis','宿泊費の登録額','text',[['gross','値引き前'],['net','すでに値引き後']],true));
  edit(row?.id?'明細を編集':'補助・臨時支出を追加',fs,{...initial,hotelLine:initial.budgetAnchor?initial.budgetAnchor.source+'/'+initial.budgetAnchor.id:'',hotelBasis:initial.budgetAnchor?.basis||'gross'},async d=>{const line=base.find(r=>r.source+'/'+r.id===d.hotelLine),anchor=line?{source:line.source,id:line.id,revision:line.revision,basis:d.hotelBasis}:null;await api().save(c.id,itemId,row?.revision||0,{...initial,...d},{},anchor,operation);});
 }
 async function cancel(row){if(!confirm('「'+row.title+'」を予定から外しますか？実際の入出金は残ります。'))return;await api().save(getCamp().id,row.id,row.revision,{...row,status:'cancelled'},{},null,crypto.randomUUID());await reload();message('明細を取り消しました。履歴と入出金は残しています。');}
 function add(kind){form(validateSpecial({kind,title:kind==='aid'?'補助':'臨時支出',owner:'camp',includeBudget:true,unit:null,quantity:1}));}
 function record(row){const c=getCamp();if(row.flow==='discount'){location.href='camp-special.html#'+c.id;return;}
  const available=Object.entries(c.ledger.entries||{}).filter(([id,x])=>!x.void&&!x.budgetId&&x.kind===(row.kind==='aid'?'income':'expense')&&!publicItems(c.specialBook).some(r=>r.entryIds.includes(id)));
  const operation=crypto.randomUUID();edit(row.kind==='aid'?'補助の入金を記録':'臨時支出の支払を記録',[field('existing','記録方法','text',[['','新しく記録する'],...available.map(([id,x])=>[id,'登録済み：'+x.date+' '+yen(x.amount)])]),field('amount','今回の実績金額（円）','number'),field('date','実際の日付','date'),field('confirm','実際の入出金と、団体会計への帰属・確認状況を確認しました','checkbox')],{date:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})},async d=>{if(!d.confirm)throw Error('実際の入出金を確認してください');if(d.existing)await api().linkCash(c.id,row,d.existing,operation);else await api().recordCash(c.id,row,d.amount,d.date,operation);});
 }
 return {form,add,cancel,record};
}
