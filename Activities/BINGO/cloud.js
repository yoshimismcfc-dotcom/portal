/* Shared game only. Preferences remain on each display; no history is kept locally. */
(function(root){
 'use strict';
 const B=typeof module!=='undefined'?require('./core.js'):root.Bingo;
 const URL='https://yoshimi-smc-portal-default-rtdb.asia-southeast1.firebasedatabase.app/bingo_shared_v1/current.json';
 function empty(){return {version:1,revision:0,round:1,count:0,history:[],operationId:'',action:'initial'};}
 function validate(raw){
  if(raw===null)return empty();
  if(!raw||raw.version!==1||!Number.isSafeInteger(raw.revision)||raw.revision<0||!Number.isSafeInteger(raw.round)||raw.round<1||!Number.isInteger(raw.count)||raw.count<0||raw.count>75||typeof raw.operationId!=='string'||!['initial','draw','undo','reset'].includes(raw.action))throw Error('共有データの形式を確認できません。担当者にご相談ください。');
  const history=raw.count===0&&raw.history==null?[]:raw.history;
  B.validate({version:1,history});if(history.length!==raw.count)throw Error('共有データの番号数が一致しません。');
  return {...raw,history:[...history]};
 }
 function next(current,action,id,choose){
  const s=validate(current);if(!['draw','undo','reset'].includes(action))throw Error('不明な操作です');
  if(action==='draw'){if(s.count===75)throw Error('75個すべて抽選しました。');s.history.push(B.draw(s.history,choose));}
  if(action==='undo'){if(!s.count)throw Error('取り消す番号がありません。');s.history.pop();}
  if(action==='reset'){s.history=[];s.round++;}
  return {version:1,revision:s.revision+1,round:s.round,count:s.history.length,history:s.history,operationId:id,action,updatedAt:{'.sv':'timestamp'}};
 }
 class Store{
  constructor({fetch:fetcher=root.fetch.bind(root),url=URL,onstate=()=>{},onstatus=()=>{},timeout=8000}={}){Object.assign(this,{fetcher,url,onstate,onstatus,timeout});this.state=null;this.etag=null;this.ready=false;this.busy=false;this.epoch=0;this.reading=null;}
  status(ready,message){this.ready=ready;this.onstatus(ready,message);}
  async request(options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeout);try{return await this.fetcher(this.url,{...options,cache:'no-store',signal:controller.signal});}finally{clearTimeout(timer);}}
  async snapshot(response){if(!response.ok)throw Error([401,403].includes(response.status)?'クラウドへのアクセスが許可されていません。管理者にご相談ください。':'クラウドと通信できません。再接続をお待ちください。');const state=validate(await response.json()),etag=response.headers.get('etag');if(!etag)throw Error('共有状態を確認できません。再接続してください。');return {state,etag};}
  apply({state,etag}){if(this.state&&state.revision<this.state.revision)throw Error('クラウドの状態を再確認しています。');this.state=state;this.etag=etag;this.onstate(state);this.status(true,'✓ クラウド共有中・コーチ全員で同じゲーム');}
  async refresh(){if(this.busy)return false;if(this.reading)return this.reading;const epoch=this.epoch;this.reading=(async()=>{try{const snap=await this.snapshot(await this.request({headers:{'X-Firebase-ETag':'true'}}));if(epoch!==this.epoch)return false;this.apply(snap);return true;}catch(e){if(epoch===this.epoch)this.status(false,e.message||'通信が切れました。再接続をお待ちください。');return false;}finally{this.reading=null;}})();return this.reading;}
  async mutate(action,expectedRevision,choose){
   if(this.busy||!this.ready||!this.state)throw Error('共有状態を確認中です。少しお待ちください。');
   if(this.state.revision!==expectedRevision)throw Error('他のコーチが更新しました。最新の番号を確認してから操作してください。');
   this.busy=true;this.epoch++;const id=root.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;let proposal;
   try{
    proposal=next(this.state,action,id,choose);this.status(false,'クラウドに保存しています…');
    const response=await this.request({method:'PUT',headers:{'Content-Type':'application/json','if-match':this.etag,'X-Firebase-ETag':'true'},body:JSON.stringify(proposal)});
    if(response.status===412){this.status(false,'他のコーチが先に更新しました。最新の番号を確認してください。');return {committed:false,conflict:true};}
    if(!response.ok)throw Error([401,403].includes(response.status)?'クラウドに保存する権限がありません。管理者にご相談ください。':'保存の結果を確認しています。');
    const state=validate(await response.json());if(state.operationId!==id)throw Error('保存の結果を確認しています。');this.state=state;this.etag=response.headers.get('etag');this.onstate(state);this.status(!!this.etag,'✓ クラウドに保存しました。全員の画面に反映します。');return {committed:true,state};
   }catch(e){this.status(false,e.message||'保存の結果を確認しています。');return {committed:false,uncertain:true,message:e.message};}
   finally{this.busy=false;await this.refresh();}
  }
 }
 const api={Store,validate,next,empty,URL};root.BingoCloud=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
