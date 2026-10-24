// 合宿の個別配車・部屋割り・点呼。端末内でのみ使用しFirebaseに送らない。
export const emptyOperations=()=>({version:1,vehicles:[],rooms:[],allocation:{},rollcall:{}});
const bad=s=>{throw new Error(s);};
const exists=(a,id)=>a.some(x=>x.id===id&&x.active!==false);
export const participantsForOperations=people=>people.filter(p=>p.response==='yes');
export function usedSeats(state,people,v){
 const assigned=participantsForOperations(people).filter(p=>state.allocation[p.id]?.vehicle===v.id);
 const extra=v.driver && !assigned.some(p=>p.id===v.driver) ? 1 : 0;
 return assigned.length+extra;
}
export function usedBeds(state,people,room){
 return participantsForOperations(people).filter(p=>p.overnight&&state.allocation[p.id]?.room===room.id).length;
}
export function verifyOperations(state,people){
 if(!state||state.version!==1||!Array.isArray(state.vehicles)||!Array.isArray(state.rooms)||
 !state.allocation||Array.isArray(state.allocation)||!state.rollcall||Array.isArray(state.rollcall))bad('端末内のデータ形式を確認してください。');
 if(state.vehicles.length>24||state.rooms.length>32||Object.keys(state.allocation).length>120||Object.keys(state.rollcall).length>120)bad('登録件数が上限を超えています。');
 for(const [kind,items] of [['車両',state.vehicles],['部屋',state.rooms]]){
  const seen=new Set();
  for(const item of items){
   if(typeof item.id!=='string'||seen.has(item.id)||typeof item.label!=='string'||!item.label.trim()||item.label.trim().length>40||
    !Number.isInteger(item.capacity)||item.capacity<1||item.capacity>20||typeof item.active!=='boolean')bad(kind+'の名前・定員を確認してください。');
   seen.add(item.id);
  }
 }
 for(const v of state.vehicles){
  if(typeof v.driver!=='string'||v.driver&&!people.some(p=>p.id===v.driver&&['coach','parent','other'].includes(p.kind)))bad('運転者は参加する大人から選んでください。');
  if(v.active&&usedSeats(state,people,v)>v.capacity)bad(v.label+'の乗車定員を超えています。運転者も定員に含みます。');
  if(v.driver&&state.allocation[v.driver]?.vehicle&&state.allocation[v.driver].vehicle!==v.id)bad('運転者が別の車に割り当てられています。');
 }
 for(const r of state.rooms)if(r.active&&usedBeds(state,people,r)>r.capacity)bad(r.label+'の宿泊定員を超えています。');
 for(const [id,a] of Object.entries(state.allocation)){
  if(!people.some(p=>p.id===id)||!a||typeof a.vehicle!=='string'||typeof a.room!=='string')bad('参加者の割り当てを確認してください。');
  if(a.vehicle&&!state.vehicles.some(v=>v.id===a.vehicle))bad('登録されていない車両があります。');
  if(a.room&&!state.rooms.some(r=>r.id===a.room))bad('登録されていない部屋があります。');
 }
 for(const [id,a] of Object.entries(state.rollcall)){
  if(!people.some(p=>p.id===id)||!a||typeof a.depart!=='boolean'||typeof a.arrive!=='boolean')bad('点呼の記録を確認してください。');
 }
 return state;
}
export function changeOperations(state,change,people){
 const next=JSON.parse(JSON.stringify(state));
 if(change.kind==='vehicle'||change.kind==='room'){
  const key=change.kind==='vehicle'?'vehicles':'rooms',item=change.item,idx=next[key].findIndex(x=>x.id===item.id);
  if(idx<0)next[key].push(item);else next[key][idx]=item;
 }else if(change.kind==='assign'){
  const p=people.find(x=>x.id===change.id&&x.response==='yes');
  if(!p)bad('参加確定者だけを割り当てられます。');
  const vehicle=change.vehicle||'',room=p.overnight?(change.room||''):'';
  if(vehicle&&!exists(next.vehicles,vehicle))bad('使用中の車両を選んでください。');
  if(room&&!exists(next.rooms,room))bad('使用中の部屋を選んでください。');
  if(!vehicle&&!room)delete next.allocation[p.id];else next.allocation[p.id]={vehicle,room};
 }else if(change.kind==='rollcall'){
  if(!people.some(p=>p.id===change.id&&p.response==='yes'))bad('参加確定者だけを点呼できます。');
  if(!['depart','arrive'].includes(change.field)||typeof change.value!=='boolean')bad('点呼の状態を確認してください。');
  next.rollcall[change.id]={depart:false,arrive:false,...(next.rollcall[change.id]||{}),[change.field]:change.value};
 }else if(change.kind==='clear-rollcall'){
  next.rollcall={};
 }else if(change.kind==='clean'){
  for(const [id,a] of Object.entries(next.allocation)){
   const p=people.find(p=>p.id===id);
   if(!p||p.response!=='yes')delete next.allocation[id];
   else if(!p.overnight)next.allocation[id]={...a,room:''};
  }
  for(const id of Object.keys(next.rollcall))if(!people.some(p=>p.id===id&&p.response==='yes'))delete next.rollcall[id];
 }else bad('操作を確認してください。');
 return verifyOperations(next,people);
}
export function localOperationsKey(campId){return 'smc-camp-operations-local-v1:'+campId;}
export function readOperations(store,campId,people){
 const source=store.getItem(localOperationsKey(campId));
 if(!source)return emptyOperations();
 const value=JSON.parse(source);
 return verifyOperations(value,people);
}
export function writeOperations(store,campId,state,people){
 const next=verifyOperations(state,people);
 store.setItem(localOperationsKey(campId),JSON.stringify(next));
 return next;
}
