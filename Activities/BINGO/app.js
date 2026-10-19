/* DOM, voice and persistence adapters. All game data stays in this browser. */
(()=>{'use strict';
const $=id=>document.getElementById(id),KEY='smc-bingo-v1';let data=Bingo.defaults(),loadNote='',saveOK=true;
try{const stored=localStorage.getItem(KEY);if(stored){data=Bingo.validate(JSON.parse(stored));if(data.history.length)loadNote='前回の続きから再開しました。';}}catch(e){loadNote='保存内容を読み込めませんでした。新しいゲームとして開始します。';}
const game=new Bingo.Game(data);let timer=null,controlsHidden=false,confirmation=null,voiceToken=0,nextDrawAt=0;const motion=matchMedia('(prefers-reduced-motion: reduce)');
const speechSupported='speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(game.state));saveOK=true;$('storageWarning').hidden=true;$('saveStatus').textContent='✓ この端末に自動保存しました。';}catch(e){saveOK=false;$('storageWarning').hidden=false;$('storageWarning').textContent='このブラウザには保存できません。この画面を閉じると進行状況が失われます。';$('saveStatus').textContent='進行状況を保存できていません。画面を閉じずにご利用ください。';}}
function stopVoice(){voiceToken++;if(speechSupported)try{speechSynthesis.cancel();}catch(e){/* Drawing must remain available. */}}
function speak(n){if(!speechSupported||!game.state.settings.sound||!n)return;stopVoice();const token=voiceToken;try{const u=new SpeechSynthesisUtterance(({B:'ビー',I:'アイ',N:'エヌ',G:'ジー',O:'オー'})[Bingo.column(n)]+'、'+n+'番');u.lang='ja-JP';u.rate=game.state.settings.rate;const voices=speechSynthesis.getVoices().filter(v=>v.lang.toLowerCase().startsWith('ja'));const voice=voices.find(v=>v.localService)||voices[0];if(voice)u.voice=voice;u.onerror=e=>{if(token===voiceToken&&!['canceled','interrupted'].includes(e.error))$('voiceStatus').textContent='この端末では読み上げを開始できません。「もう一度読み上げ」を押すか、画面の番号を読み上げてください。';};speechSynthesis.speak(u);}catch(e){$('voiceStatus').textContent='音声が利用できません。画面の番号を読み上げてください。';}}
function render(){const {history:h,settings:s}=game.state,n=h.at(-1);document.body.dataset.mode=s.mode;document.body.classList.toggle('controls-hidden',controlsHidden&&s.mode==='venue');
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===s.mode)));
 $('drawLabel').textContent=game.busy?'抽選しています…':h.length===75?'すべての番号が出ました':n?'今回の番号':'さあ、はじめましょう';
 $('letter').textContent=game.busy?'抽選中':n?Bingo.column(n):'BINGO';$('number').textContent=game.busy?'…':n??'―';$('resultHint').textContent=game.busy?'少しお待ちください':h.length===75?'おつかれさまでした！':n?`${h.length}個目の番号です`:'次のボタンで、最初の番号が出ます';
 $('result').classList.toggle('rolling',game.busy);$('result').setAttribute('aria-busy',String(game.busy));$('draw').disabled=game.busy||h.length===75||Date.now()<nextDrawAt;$('draw').textContent=game.busy?'抽選しています…':h.length===75?'75個すべて抽選しました':'次の番号を出す →';
 $('repeat').disabled=game.busy||!n||!s.sound||!speechSupported;$('undo').disabled=game.busy||!h.length;$('reset').disabled=game.busy;
 $('count').textContent=h.length;$('remaining').textContent=75-h.length;$('orderCount').textContent=`（${h.length}個）`;
 $('historyContent').hidden=!s.historyVisible&&s.mode==='simple';$('toggleHistory').hidden=s.mode!=='simple';$('toggleHistory').textContent=s.historyVisible?'一覧を隠す':'一覧を表示';$('toggleHistory').setAttribute('aria-expanded',String(s.historyVisible));
 $('board').replaceChildren(...Array.from('BINGO',(letter,c)=>{const col=document.createElement('div');col.className='column';const head=document.createElement('div');head.className='col-heading';head.textContent=letter;col.append(head);for(let i=1;i<=15;i++){const value=c*15+i,drawn=h.includes(value),cell=document.createElement('div');cell.className='cell'+(drawn?' drawn':'')+(value===n?' latest':'');cell.setAttribute('aria-label',`${letter} ${value}、${value===n?'直近の番号':drawn?'抽選済み':'未抽選'}`);const mark=document.createElement('span');mark.className='mark';mark.setAttribute('aria-hidden','true');mark.textContent=drawn?'✓':'';cell.append(mark,document.createTextNode(value));col.append(cell);}return col;}));
 $('order').replaceChildren(...h.map((value,i)=>{const li=document.createElement('li'),small=document.createElement('small');small.textContent=`${i+1}番目`;li.append(small,document.createTextNode(`${Bingo.column(value)} ${value}`));return li;}));$('emptyHistory').hidden=!!h.length;
 $('sound').checked=s.sound;$('rate').value=s.rate;$('animation').checked=s.animation;document.querySelector('.venue-tools').hidden=s.mode!=='venue';$('hideControls').textContent=controlsHidden?'操作ボタンを表示':'操作ボタンを隠す';
}
async function startDraw(){
 if(game.busy||game.state.history.length===75||Date.now()<nextDrawAt)return;
 nextDrawAt=Date.now()+400;setTimeout(render,410);
 // Prime speech within the user's gesture, before the animation / lock awaits.
 if(speechSupported&&game.state.settings.sound){try{speechSynthesis.cancel();const warmup=new SpeechSynthesisUtterance(' ');warmup.volume=0;speechSynthesis.speak(warmup);}catch(e){/* Optional voice must never block drawing. */}}
 const run=()=>{if(!game.begin())return;stopVoice();notice('');render();const finish=()=>{timer=null;const n=game.finish();save();render();speak(n);};
 // Speech begins on the original tap when animation is off. Some mobile browsers
 // require a new tap for delayed speech; the repeat button remains available.
 if(game.state.settings.animation&&!motion.matches)timer=setTimeout(finish,1400);else finish();};
 if(navigator.locks){await navigator.locks.request(KEY,{ifAvailable:true},async lock=>{if(!lock){notice('別の画面で抽選しています。この画面だけで操作してください。');return;}syncStored();run();if(game.busy)await new Promise(resolve=>{const check=setInterval(()=>{if(!game.busy){clearInterval(check);resolve();}},60);});});}else run();
}
function syncStored(){if(!saveOK)return;try{const raw=localStorage.getItem(KEY);if(raw)game.state=Bingo.validate(JSON.parse(raw));}catch(e){/* retain current valid state */}}
function ask(kind){if(game.busy)return;stopVoice();confirmation=kind;$('confirmTitle').textContent=kind==='undo'?'直前の番号を取り消しますか？':'新しいゲームを始めますか？';$('confirmText').textContent=kind==='undo'?`${Bingo.column(game.state.history.at(-1))} ${game.state.history.at(-1)} を履歴から外し、抽選候補に戻します。`:'これまでの抽選番号をすべて消します。元には戻せません。音声と表示の設定は引き継ぎます。';$('confirmAction').textContent=kind==='undo'?'この番号を取り消す':'消して始める';$('confirm').showModal();$('cancel').focus();}
function mutateConfirmed(){if(confirmation==='undo')game.undo();else if(confirmation==='reset')game.reset();confirmation=null;save();render();$('confirm').close();notice('変更を保存しました。');}
function guide(){ $('start').textContent=game.state.started?'ゲームに戻る':'ゲーム開始';$('guide').showModal();}
function voiceStatus(){ $('voiceStatus').textContent=!speechSupported?'このブラウザは読み上げに対応していません。抽選はそのまま使えます。':'音声が出ないときは「もう一度読み上げ」を押してください。端末の音量もご確認ください。オフラインでは端末にある日本語音声が必要です。';}
$('draw').addEventListener('click',startDraw);$('repeat').onclick=()=>speak(game.state.history.at(-1));$('undo').onclick=()=>ask('undo');$('reset').onclick=()=>ask('reset');$('confirmAction').onclick=mutateConfirmed;$('cancel').onclick=()=>{$('confirm').close();confirmation=null;};$('help').onclick=guide;
$('start').onclick=()=>{game.state.started=true;save();$('guide').close();$('draw').focus();};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{game.state.settings.mode=b.dataset.mode;controlsHidden=false;save();render();});
$('toggleHistory').onclick=()=>{game.state.settings.historyVisible=!game.state.settings.historyVisible;save();render();};
for(const id of ['sound','animation','rate'])$(id).onchange=()=>{game.state.settings[id]=id==='rate'?Number($(id).value):$(id).checked;if(id==='sound'){stopVoice();voiceStatus();}save();render();};
$('hideControls').onclick=()=>{controlsHidden=!controlsHidden;render();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else notice('このブラウザは全画面表示に対応していません。そのまま会場表示をご利用ください。');}catch(e){notice('全画面にできませんでした。そのまま会場表示をご利用ください。');}};
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'全画面を終了':'全画面にする';});
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){try{const restored=Bingo.validate(JSON.parse(e.newValue));if(timer)clearTimeout(timer);timer=null;game.busy=false;game.state=restored;stopVoice();if($('confirm').open){$('confirm').close();confirmation=null;}render();notice('同じブラウザの別の画面で更新されました。抽選は1つの画面で操作してください。');}catch(err){notice('別の画面の保存内容を確認できません。現在のゲームを保持しています。');}}});
window.addEventListener('pagehide',()=>{stopVoice();});
async function offline(){if(location.protocol==='file:'){$('offlineStatus').textContent='ファイルから利用中：抽選は通信なしで動きます。保存はブラウザによって制限されます。';return;}if(!('serviceWorker'in navigator)||!window.isSecureContext){$('offlineStatus').textContent='オフライン再開には、HTTPSの公開ページで最初の読み込みが必要です。';return;}try{await navigator.serviceWorker.register('./sw.js');// The portal may already have a parent Service Worker. Wait for this
// game's cache, rather than navigator.serviceWorker.ready (which can be the parent).
const cacheDeadline=Date.now()+20000;
while(true){
 const cache=await caches.open('smc-bingo-v1');
 const files=['./','./index.html','./style.css','./core.js','./app.js'];
 const ready=await Promise.all(files.map(file=>cache.match(new URL(file,location.href).href)));
 if(ready.every(Boolean))break;
 if(Date.now()>cacheDeadline)throw new Error('offline preparation timed out');
 await new Promise(resolve=>setTimeout(resolve,200));
}
const check=async()=>{const cached=await caches.has('smc-bingo-v1');$('offlineStatus').textContent=cached?'✓ オフラインの準備ができました。このURLで通信なしでも再開できます。':'オフラインの準備中です。接続したままお待ちください。';};await check();}catch(e){$('offlineStatus').textContent='オフラインの準備ができませんでした。接続中に再読み込みしてください。今開いている画面では抽選を続けられます。';}}
voiceStatus();render();if(loadNote)notice(loadNote);save();offline();
// Keep the main action visible on first visit. The optional guide is always available.
})();
