import {emptyOperations,readOperations,writeOperations,changeOperations,usedSeats,usedBeds,participantsForOperations} from './logistics-local-model.mjs?v=20261024-6';

// 情報はこの端末のlocalStorageに限定。共有リンク・Firestore・GPSへは送信しない。
export function createLocalOperationsUI({getCamp,el,button,edit,field,message,reload,goRoutes,rerender}) {
 const current=()=>getCamp();
 const read=()=>{const c=current();return readOperations(localStorage,c.id,c.participants);};
 function update(change){
  const c=current(),next=changeOperations(read(),change,c.participants);
  writeOperations(localStorage,c.id,next,c.participants);
  return next;
 }
 const notice=(p,s)=>p.append(el('p',s,'small'));
 const line=(p,title,summary,actions)=>{
  const item=el('div',undefined,'operation-row'),head=el('div',undefined,'operation-row-head');
  head.append(el('strong',title),el('span',summary,'small'));
  const tools=el('div',undefined,'operation-row-actions');tools.append(...actions);
  item.append(head,tools);p.append(item);return item;
 };
 const personName=(people,id)=>people.find(p=>p.id===id)?.name||'未設定';
 function editor(kind,old={}){
  const c=current(),state=read(),isCar=kind==='vehicle',item={id:old.id||crypto.randomUUID(),label:'',capacity:isCar?5:4,active:true,...(isCar?{driver:''}:{}),...old};
  const adults=participantsForOperations(c.participants).filter(p=>['coach','parent','other'].includes(p.kind));
  const inputs=[field('label',isCar?'車両名（例：1号車）':'部屋名（例：A室）'),field('capacity',isCar?'乗車定員（運転者を含む）':'宿泊定員','number'),
   ...(isCar?[field('driver','運転者（任意）','text',[['','未設定'],...adults.map(p=>[p.id,p.name])])]:[]),
   field('active','使用する','checkbox')];
  edit(old.id?(isCar?'車両を編集':'部屋を編集'):(isCar?'車両を追加':'部屋を追加'),inputs,item,async data=>{
   const next={...item,...data,label:data.label.trim(),capacity:Number(data.capacity)};
   if(!next.label)throw Error('名前を入力してください。');
   update({kind,item:next});
   return ()=>{rerender();message('この端末に保存しました（他の端末には共有されません）。');};
  },{localOnly:true,successText:'この端末に保存しました（他の端末には共有されません）。'});
 }
 function assignEditor(person,state){
  const c=current(),prior=state.allocation[person.id]||{vehicle:'',room:''};
  const vehicles=[['','未設定'],...state.vehicles.filter(v=>v.active).map(v=>[v.id,v.label])];
  const rooms=[['','未設定'],...state.rooms.filter(r=>r.active).map(r=>[r.id,r.label])];
  edit(person.name+'の割当',[field('vehicle','乗る車両','text',vehicles),
   ...(person.overnight?[field('room','宿泊する部屋','text',rooms)]:[])],
   prior,async d=>{update({kind:'assign',id:person.id,vehicle:d.vehicle,room:person.overnight?d.room:''});return ()=>{rerender();message('この端末の割当を保存しました。他端末には共有されません。');};},
   {localOnly:true,successText:'この端末の割当を保存しました。他端末には共有されません。'});
 }
 function saveQuick(change){
  update(change);
  rerender();
  message('この端末だけに記録しました。別の端末には反映されません。');
 }
 function render(p){
  const c=current(),people=participantsForOperations(c.participants);p.classList.add('operations-panel');
  p.append(el('h2','配車・部屋割り・点呼'));
  notice(p,'この画面の個別配置・点呼は、操作中の端末にのみ保存します。共有リンクから他の人には見えません。端末・ブラウザを変えると引き継がれません。');
  notice(p,'緊急連絡先・健康情報・GPS・現在地のリンクは記録しないでください。実際の集合・乗車・到着は現場の大人が確認してください。');
  let state;try{state=read();}catch(e){
   p.append(el('p','端末内の運営データを読み込めません。保存済みデータを削除せず、管理担当者に確認してください。詳細：'+(e.message||'不明'),'budget-alert'));
   return;
  }
  const stats=el('div',undefined,'operations-summary');
  const absentCar=people.filter(x=>!state.allocation[x.id]?.vehicle).length;
  const guests=people.filter(x=>x.overnight),absentRoom=guests.filter(x=>!state.allocation[x.id]?.room).length;
  for(const [label,value] of [['参加確定',people.length+'人'],['車両未割当',absentCar+'人'],['宿泊未割当',absentRoom+'人'],['出発確認',people.filter(x=>state.rollcall[x.id]?.depart).length+'/'+people.length],['到着確認',people.filter(x=>state.rollcall[x.id]?.arrive).length+'/'+people.length]]){
   const n=el('div',undefined,'operation-stat');n.append(el('span',label),el('strong',value));stats.append(n);
  }p.append(stats);
  if(!people.length)notice(p,'先に「参加集約」で出欠を参加に設定してください。');

  const config=el('div',undefined,'operations-config');
  const carSection=el('details',undefined,'operations-section'),roomSection=el('details',undefined,'operations-section');
  carSection.open=!state.vehicles.length;roomSection.open=!state.rooms.length;
  carSection.append(el('summary','🚗 車両の登録（'+state.vehicles.filter(v=>v.active).length+'台）'));
  carSection.append(button('＋ 車両を追加',()=>editor('vehicle')));
  for(const v of state.vehicles){
   const n=usedSeats(state,c.participants,v);
   line(carSection,v.label+(v.active?'':'（使用しない）'),n+'/'+v.capacity+'席・運転者 '+personName(c.participants,v.driver),
    [button('編集',()=>editor('vehicle',v))]);
   const riders=people.filter(p=>state.allocation[p.id]?.vehicle===v.id);
   notice(carSection,'乗車予定：'+(riders.length?riders.map(p=>p.name).join('・'):'まだいません'));
   if(v.active&&n>v.capacity)carSection.append(el('p','定員超過です。割当または車両定員を見直してください。','budget-alert'));
   if(v.active&&!v.driver)notice(carSection,v.label+'：運転者が未設定です。');
  }
  roomSection.append(el('summary','🛏️ 部屋の登録（'+state.rooms.filter(r=>r.active).length+'室）'));
  roomSection.append(button('＋ 部屋を追加',()=>editor('room')));
  for(const room of state.rooms){
   line(roomSection,room.label+(room.active?'':'（使用しない）'),usedBeds(state,c.participants,room)+'/'+room.capacity+'人',
    [button('編集',()=>editor('room',room))]);
   const guests=people.filter(p=>p.overnight&&state.allocation[p.id]?.room===room.id);
   notice(roomSection,'宿泊予定：'+(guests.length?guests.map(p=>p.name).join('・'):'まだいません'));
   if(room.active&&guests.length>room.capacity)roomSection.append(el('p','定員超過です。割当または部屋の定員を見直してください。','budget-alert'));
  }
  config.append(carSection,roomSection);p.append(config);

  const nav=el('div',undefined,'operations-helper');
  nav.append(button('行程・地図共有の案内へ',goRoutes));
  nav.append(button('不参加者の古い割当を整理',()=>{
   if(!confirm('不参加者の割当・点呼、宿泊しない人の部屋割当をこの端末から整理しますか？'))return;
   saveQuick({kind:'clean'});
  }));
  p.append(nav,el('h3','参加者の割当・点呼'),el('p','名前ごとに「割当」を設定し、現場で確認後に「出発」「到着」をチェックします。チェックは手動で、位置情報とは連動しません。','small'));
  const list=el('div',undefined,'operations-people');
  for(const person of people){
   const a=state.allocation[person.id]||{},car=state.vehicles.find(v=>v.id===a.vehicle),room=state.rooms.find(r=>r.id===a.room);
   const summary=[car?(car.label+(car.active?'':'（使用停止）')):'車未設定',person.overnight?(room?(room.label+(room.active?'':'（使用停止）')):'部屋未設定'):'日帰り'].join(' ／ ');
   const depart=!!state.rollcall[person.id]?.depart,arrive=!!state.rollcall[person.id]?.arrive;
   const actions=[button('割当を編集',()=>assignEditor(person,state))];
   for(const [key,title,flag] of [['depart','出発',depart],['arrive','到着',arrive]]){
    const b=button((flag?'✓ ':'○ ')+title,()=>saveQuick({kind:'rollcall',id:person.id,field:key,value:!flag}));
    b.setAttribute('aria-pressed',String(flag));b.classList.add('operation-check');actions.push(b);
   }
   line(list,person.name,summary,actions);
  }
  p.append(list);
  const bottom=el('div',undefined,'operations-helper');
  bottom.append(button('点呼だけを全件解除',()=>{
   if(!confirm('この端末の出発・到着のチェックをすべて解除しますか？配車と部屋割りは残します。'))return;
   saveQuick({kind:'clear-rollcall'});
  }));
  p.append(bottom);
  notice(p,'端末の閲覧履歴・サイトデータを削除すると、この画面の内容も失われる場合があります。必要な情報は現場の管理者が別途安全に保管してください。');
 }
 return {render};
}
