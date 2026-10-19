/* Pure game rules, shared by the app and the tests. No external dependencies. */
(function(root){
 'use strict';
 const defaults=()=>({version:1,history:[],started:false,settings:{sound:true,rate:0.9,animation:true,mode:'simple',historyVisible:true}});
 function column(n){if(!Number.isInteger(n)||n<1||n>75)throw new RangeError('番号の範囲外');return 'BINGO'[Math.floor((n-1)/15)];}
 function validate(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.history)||raw.history.length>75||raw.history.some(n=>!Number.isInteger(n)||n<1||n>75)||new Set(raw.history).size!==raw.history.length)throw new Error('保存データを確認できません');
  const s=defaults(),v=raw.settings||{};s.history=[...raw.history];s.started=raw.started===true||s.history.length>0;
  for(const k of ['sound','animation','historyVisible'])if(typeof v[k]==='boolean')s.settings[k]=v[k];
  if([0.7,0.9,1.1].includes(v.rate))s.settings.rate=v.rate;
  if(['simple','venue','history'].includes(v.mode))s.settings.mode=v.mode;
  return s;
 }
 function remaining(history){return Array.from({length:75},(_,i)=>i+1).filter(n=>!history.includes(n));}
 function randomIndex(length){if(root.crypto&&root.crypto.getRandomValues){const a=new Uint32Array(1),limit=4294967296-(4294967296%length);do{root.crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%length;}return Math.floor(Math.random()*length);}
 function draw(history,choose=randomIndex){const pool=remaining(history);if(!pool.length)return null;const n=pool[choose(pool.length)];if(n===undefined)throw new RangeError('乱数が範囲外です');return n;}
 class Game{constructor(state=defaults()){this.state=validate(state);this.busy=false;}begin(){if(this.busy||this.state.history.length===75)return false;this.busy=true;return true;}finish(choose){if(!this.busy)return null;const n=draw(this.state.history,choose);if(n!==null){this.state.history.push(n);this.state.started=true;}this.busy=false;return n;}undo(){if(this.busy)return null;return this.state.history.pop()??null;}reset(){if(this.busy)return false;this.state.history=[];this.state.started=true;return true;}}
 const api={defaults,column,validate,remaining,draw,Game};root.Bingo=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
