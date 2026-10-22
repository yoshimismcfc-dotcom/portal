/* 合宿専用。個人情報のlocalStorage保存、既存Firebaseパスへの書込は行わない。 */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), vals=x=>Object.values(x||{}), yen=x=>new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY'}).format(x||0);
  const dict={player:'選手',coach:'コーチ',parent:'保護者',other:'その他',yes:'参加',no:'不参加',pending:'未回答',outbound:'往路',return:'復路',confirmed:'確認済み',missing:'未確認',absent:'欠席',payment:'入金',refund:'返金',cash:'現金',transfer:'振込',income:'収入',expense:'支出',all:'全員向け',staff:'運営担当',leader:'合宿責任者',accountant:'会計担当',admin:'システム管理者',waiting:'出発前',moving:'移動中',resting:'休憩中',arrived:'到着済み'};
  const label=x=>dict[x]||x||'—', today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
  const dateLabel=x=>new Date(x+'T00:00:00+09:00').toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'});
  let user=null,camp=null,tab='dashboard',info=null,saveHandler=null,formFields=[],pendingCommand=null,busy=false,locations=[],checkpoint='朝の集合',scheduleDay='',search='',filter='',watchId=null,sharingVehicle=null,sharingCamp=null,sharingToken=null,sharingTimer=null,loadedAt=null;
  const tabs={dashboard:'概要',schedule:'行程',participants:'参加者',vehicles:'配車・現在地',checks:'点呼',rooms:'部屋割り',charges:'集金',transactions:'会計',announcements:'お知らせ',checklists:'持ち物・準備',emergency:'緊急連絡',settings:'設定・履歴'};
  const manager=()=>['admin','leader'].includes(camp?.role);
  let recentHistory=[];
  const finance=()=>manager()||camp?.role==='accountant';
  const canEdit=e=>manager()||(camp?.role==='accountant'&&['charges','payments','transactions'].includes(e))||(camp?.role==='staff'&&['checks','announcements','checklists'].includes(e));
  function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
  function button(text,fn,secondary=false){const n=el('button',text,secondary?'secondary':'');n.type='button';n.onclick=()=>Promise.resolve(fn()).catch(error=>message(error.message,true));return n;}
  function message(text,error=false){$('camp-message').textContent=text;$('camp-message').className='notice'+(error?' error':'');}
  const id=()=>crypto.randomUUID();
  async function api(path,body) {
    if(!navigator.onLine)throw new Error('通信が切れています。入力内容を残しています。再接続後に保存してください。');
    if(!user)throw new Error('ログインしてください');
    let token;try{token=await user.getIdToken();}catch{throw new Error('ログイン状態を確認できません。接続を確認して再試行してください。');}
    let response;try{response=await fetch(window.SMC_CAMP_CONFIG.apiBase.replace(/\/$/,'')+path,{
      method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(20000)
    });}catch{throw new Error('通信結果を確認できませんでした。入力を変えずに再試行すると、二重登録せず保存結果を確認できます。');}
    let result;try{result=await response.json();}catch{throw new Error('サーバーの応答を確認できませんでした。接続設定を管理者へ確認してください。');}
    if(!response.ok){const error=new Error(result.error||'通信に失敗しました');error.status=response.status;throw error;}return result;
  }
  async function command(action,data={},entity) {
    if(busy)return;
    const signature=JSON.stringify({action,data,entity,campId:camp?.id});
    if(!pendingCommand||pendingCommand.signature!==signature) pendingCommand={signature,body:{action,data,entity,campId:camp?.id,revision:camp?.revision,requestId:id()}};
    busy=true;$('camp-submit').disabled=true;message('保存しています…');
    try{
      const result=await api('/api/command',pendingCommand.body);
      pendingCommand=null;
      $('camp-dialog').close();
      await load(result.id);
      message('保存しました。'+new Date().toLocaleTimeString('ja-JP'));
    } catch(error){
      if(error.status)pendingCommand=null;
      message(error.message,true);throw error;
    } finally{busy=false;$('camp-submit').disabled=false;}
  }
  function field(key,title,type='text',options,required=false){return {key,title,type,options,required};}
  const f=field, select=(k,t,options,required=true)=>f(k,t,'select',options,required);
  const opts=keys=>keys.map(v=>[v,label(v)]);
  const people=()=>vals(camp.participants).map(p=>[p.id,p.name+'（'+label(p.kind)+'）']);
  const schema={
    meta:()=>[f('name','合宿名','text',null,true),f('start','開始日','date',null,true),f('end','終了日','date',null,true),f('place','行き先・活動場所'),f('hotel','宿泊施設'),f('hotelAddress','宿泊施設の所在地'),f('meeting','集合場所'),f('departure','集合時刻','time'),f('dismissal','解散場所'),f('dismissalTime','解散予定時刻','time'),f('owner','担当責任者'),f('grades','参加対象学年'),f('capacity','募集人数','number'),f('deadline','申込締切','date'),f('fee','標準会費（円・請求は別途登録）','number'),f('paymentDeadline','集金期限','date'),f('guide','案内文・未確定事項','textarea'),select('status','実施状況',opts(['準備中','募集中','実施中','終了','精算完了'])),f('archived','アーカイブ','checkbox')],
    participants:()=>[f('name','氏名','text',null,true),f('grade','学年・カテゴリー'),select('kind','区分',opts(['player','coach','parent','other'])),select('response','出欠',opts(['pending','yes','no'])),f('overnight','宿泊する','checkbox'),f('guardian','同行保護者'),f('dates','参加日程'),f('familyUid','閲覧を許可する保護者のUID')],
    schedule:()=>[f('date','日付','date',null,true),f('start','開始','time',null,true),f('end','終了','time',null,true),f('title','行程名','text',null,true),f('detail','活動内容','textarea'),f('place','場所'),f('address','住所'),f('mapUrl','地図リンク（HTTPS）','url'),f('owner','担当者'),f('notes','注意事項','textarea'),f('belongings','持ち物'),f('order','同時刻での表示順','number')],
    vehicles:()=>[f('name','車両名','text',null,true),f('driver','運転者'),f('phone','連絡先','tel'),f('capacity','乗車定員（運転者を含む全員を割当）','number',null,true),select('direction','往復',opts(['outbound','return'])),select('status','移動状況',opts(['waiting','moving','resting','arrived'])),f('departure','出発予定','datetime-local'),f('arrival','到着予定','datetime-local'),f('driverUid','位置報告を担当する成人のUID'),f('sharingStart','位置共有可能な開始日時（日本時間）','datetime-local'),f('sharingEnd','位置共有可能な終了日時（開始から12時間以内）','datetime-local'),f('shareUrl','外部地図の共有リンク（HTTPS）','url'),f('notes','備考','textarea')],
    rides:()=>[select('participantId','参加者',people()),select('vehicleId','車両',vals(camp.vehicles).map(v=>[v.id,label(v.direction)+' '+v.name])),f('boarded','人による乗車確認済み','checkbox')],
    rooms:()=>[f('name','部屋番号・部屋名','text',null,true),f('type','部屋タイプ'),f('capacity','定員','number',null,true),f('owner','担当コーチ・保護者'),f('notes','特記事項','textarea')],
    roomAssignments:()=>[select('participantId','宿泊者',people()),select('roomId','部屋',vals(camp.rooms).map(r=>[r.id,r.name]))],
    charges:()=>[select('participantId','参加者',people()),f('amount','請求額（割引・追加を反映した円）','number',null,true),f('due','支払期限','date',null,true),f('notes','割引・追加・キャンセル理由','textarea')],
    payments:()=>[select('participantId','参加者',people()),select('kind','区分',opts(['payment','refund'])),f('amount','金額（円）','number',null,true),f('date','入金・返金日','date',null,true),select('method','支払方法',opts(['cash','transfer','other'])),f('reference','入金識別番号（振込番号等・重複不可）','text',null,true),f('familyReference','家族まとめ払いの共通番号'),f('notes','備考・訂正理由','textarea'),f('void','誤登録として取消（履歴は残ります）','checkbox')],
    transactions:()=>[select('kind','区分',opts(['expense','income'])),select('category','科目',opts(['宿泊費','食費','交通費','高速道路代','駐車場代','施設利用料','観光・入場料','保険料','団からの補助','その他収入','余剰金繰入','その他'])),f('amount','実績額（円）','number',null,true),f('budget','予算額（円）','number'),f('date','取引日','date',null,true),f('payer','立替者'),f('settled','立替精算済み','checkbox'),f('notes','備考・訂正理由','textarea'),f('void','誤登録として取消（履歴は残ります）','checkbox')],
    announcements:()=>[f('title','件名','text',null,true),f('body','本文','textarea',null,true),select('audience','公開範囲',opts(['all','staff'])),f('pinned','重要：上部に固定','checkbox')],
    checklists:()=>[f('title','持ち物・準備内容','text',null,true),select('audience','公開範囲',opts(['all','staff'])),f('assignee','担当者UID'),f('due','期限','date'),f('done','完了','checkbox')],
    emergency:()=>[f('title','施設・医療機関・対応手順の名称','text',null,true),f('phone','電話番号','tel'),f('body','住所・対応手順・集合場所','textarea',null,true)]
  };
  function modal(title,fields,data,handler) {
    $('camp-dialog-title').textContent=title;$('camp-fields').replaceChildren();$('camp-form-error').textContent='';
    formFields=fields;saveHandler=handler;
    for(const spec of fields) {
      const l=el('label',spec.title+(spec.required?' *':''));
      let input;
      if(spec.type==='select') {
        input=el('select');input.append(new Option('選択してください',''));
        for(const [value,title] of spec.options||[])input.append(new Option(title,value));
      } else if(spec.type==='textarea')input=el('textarea');
      else{input=el('input');input.type=spec.type;if(spec.type==='number'){input.min='0';input.max='100000000';input.step='1';}}
      input.name=spec.key;input.required=spec.required;input.autocomplete='off';
      if(spec.type==='checkbox')input.checked=!!data[spec.key];
      else input.value=data[spec.key]??'';
      l.append(input);$('camp-fields').append(l);
    }
    $('camp-dialog').showModal();
  }
  function edit(entity,record={}) {
    const defaults={id:id(),date:today(),status:'waiting',direction:'outbound',response:'pending',kind:entity==='participants'?'player':entity==='payments'?'payment':'expense',audience:'all',method:'cash'};
    const x={...defaults,...record};if(!x.id)x.id=id();
    modal(record.id?'編集する':'新しく登録',schema[entity](),x,data=>command('save',{...x,...data},entity));
  }
  async function remove(entity,x) {
    if(confirm('この登録を削除しますか？操作履歴は残ります。'))await command('delete',{id:x.id},entity);
  }
  async function list() {
    if(sharingVehicle)await stopLocation(sharingVehicle);
    camp=null;tab='dashboard';info=await api('/api/camps');
    const root=$('camp-content');root.replaceChildren();
    $('camp-identity').textContent='あなたのUID：'+info.uid;
    const title=el('div',undefined,'toolbar');title.append(el('h2','合宿一覧'));
    if(info.admin) {
      title.append(button('＋ 合宿を作成',()=>modal('合宿を作成',schema.meta(),{status:'準備中'},data=>command('create',data))));
      title.append(button('春合宿2027の候補を入力',()=>{
        if(info.camps.some(c=>c.name==='吉見SMC 春合宿2027'))throw new Error('同じ名前の合宿が登録済みです。一覧から確認してください。');
        modal('初期候補を確認して保存',schema.meta(),{name:'吉見SMC 春合宿2027',start:'2027-03-13',end:'2027-03-14',hotel:'伊東園ホテルとどろき',hotelAddress:'群馬県伊香保町（詳細住所未確認）',status:'準備中',guide:'未確定の計画です。想定30〜40人／予約8部屋／自家用車。観光候補：渋川スカイランドパーク、榛名湖、恐竜博物館、こんにゃくパーク。行程・配車・費用は未確定。'},data=>command('create',data));
      },true));
    }
    root.append(title);
    if(!info.camps.length)root.append(el('p','閲覧できる合宿はまだありません。管理者へUIDを伝え、担当権限を割り当ててもらってください。','panel'));
    for(const c of info.camps.sort((a,b)=>Number(a.archived)-Number(b.archived)||b.start.localeCompare(a.start))) {
      const card=el('section',undefined,'camp-card');
      card.append(el('span',c.archived?'アーカイブ':c.status,'badge'),el('h2',c.name),el('p',dateLabel(c.start)+' 〜 '+dateLabel(c.end)+' ／ '+(c.place||'場所未定')),button('合宿を開く',()=>load(c.id)));
      root.append(card);
    }
  }
  async function load(campId) {
    camp=await api('/api/camps/'+campId);loadedAt=new Date();locations=[];
    recentHistory=manager()?await api('/api/camps/'+campId+'/history'):[];render();
  }
  function allowedTabs() {
    if(camp.role==='parent')return ['dashboard','schedule','participants','charges','announcements','checklists'];
    if(camp.role==='accountant')return ['dashboard','schedule','participants','charges','transactions','announcements'];
    if(camp.role==='staff')return ['dashboard','schedule','participants','vehicles','checks','rooms','announcements','checklists'];
    return Object.keys(tabs);
  }
  function render() {
    if(!camp)return;
    if(!allowedTabs().includes(tab))tab='dashboard';
    const root=$('camp-content');root.replaceChildren();
    const heading=el('section',undefined,'panel');
    heading.append(el('span',camp.status+(camp.archived?' ／ アーカイブ':''),'badge'),el('span',label(camp.role),'badge'),el('h2',camp.name),el('p',dateLabel(camp.start)+' 〜 '+dateLabel(camp.end)+' ／ '+(camp.place||camp.hotel||'場所未定')));
    root.append(heading);
    const nav=el('nav',undefined,'tabs');nav.setAttribute('aria-label','合宿の機能');
    for(const key of allowedTabs()){const b=button(tabs[key],()=>{tab=key;search='';filter='';render();});b.setAttribute('aria-selected',String(tab===key));nav.append(b);}root.append(nav);
    const section=el('section',undefined,'panel');root.append(section);
    const toolbar=el('div',undefined,'toolbar');toolbar.append(el('h2',tabs[tab]));
    toolbar.append(button('印刷・PDF保存',()=>window.print(),true));
    if(!['dashboard','settings'].includes(tab))toolbar.append(button('CSV出力',()=>exportCSV(),true));
    section.append(toolbar);
    views[tab](section,toolbar);
  }
  function stats(parent,items) {
    const grid=el('div',undefined,'stats');for(const [title,value] of items){const n=el('div',undefined,'stat');n.append(el('span',title),el('strong',String(value)));grid.append(n);}parent.append(grid);
  }
  function row(parent,title,lines=[],actions=[],badge) {
    const n=el('article',undefined,'record'),body=el('div',undefined,'record-content');
    if(badge)body.append(el('span',badge,'badge'));
    body.append(el('h3',title));for(const line of lines)if(line)body.append(el('p',line));
    n.append(body);
    if(actions.length){const a=el('div',undefined,'record-actions');a.append(...actions);n.append(a);}
    parent.append(n);return body;
  }
  const editActions=(entity,x)=>canEdit(entity)?[button('編集',()=>edit(entity,x),true),...(!['charges','payments','transactions'].includes(entity)?[button('削除',()=>remove(entity,x),true)]:[])]:[];
  function empty(parent,records){if(!records.length)parent.append(el('p','まだ登録されていません。','empty'));}
  function control(parent,title,options,value,change) {
    const l=el('label',title),s=el('select');for(const [v,t] of options)s.append(new Option(t,v));s.value=value;s.onchange=()=>change(s.value);l.append(s);parent.append(l);
  }
  const participating=()=>vals(camp.participants).filter(p=>p.response==='yes');
  function scheduleItems(){return vals(camp.schedule).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)||(a.order||0)-(b.order||0));}
  function currentChecks(){return vals(camp.checks).filter(x=>x.checkpoint===checkpoint);}
  const views={
    dashboard(parent) {
      const p=participating(),t=camp.totals,rides=vals(camp.rides).filter(r=>camp.vehicles[r.vehicleId]?.direction==='outbound');
      const unchecked=p.filter(x=>!currentChecks().some(c=>c.participantId===x.id&&c.status!=='missing')).length;
      stats(parent,[['参加人数',p.length],['未回答',vals(camp.participants).filter(x=>x.response==='pending').length],
        ...(camp.role!=='parent'&&camp.role!=='accountant'?[['往路配車済み',rides.length],['往路未配車',p.filter(x=>!rides.some(r=>r.participantId===x.id)).length],['点呼未確認（'+checkpoint+'）',unchecked]]:[]),
        ...(finance()||camp.role==='parent'?[['集金率',t.rate===null?'請求なし':(t.rate*100).toFixed(1)+'%'],['未納総額',yen(t.outstanding)],...(finance()?[['会計収支',yen(t.balance)]]:[])]:[])]);
      if(camp.role==='parent')parent.append(el('p','集計カードは自分の家庭の情報です。他の家庭の未納額は「集金」で確認できます。','small'));
      const quick=el('div',undefined,'toolbar');
      const priorities=camp.status==='実施中'?['checks','vehicles','emergency']:['終了','精算完了'].includes(camp.status)?['charges','transactions','settings']:['participants','schedule','charges'];
      for(const target of priorities.filter(x=>allowedTabs().includes(x)))quick.append(button(tabs[target]+'を開く',()=>{tab=target;render();}));parent.append(quick);
      const now=Date.now(),next=scheduleItems().find(s=>Date.parse(s.date+'T'+s.end+':00+09:00')>now);
      row(parent,'次の行程',next?[next.date+' '+next.start+'〜'+next.end,next.title,next.place]:['今後の行程は未登録です']);
      for(const x of vals(camp.announcements).filter(a=>a.pinned))row(parent,'重要：'+x.title,[x.body]);
      const todo=vals(camp.checklists).filter(x=>!x.done);
      row(parent,'未完了の準備 '+todo.length+'件',todo.slice(0,6).map(x=>x.title+(x.due?' ／ '+x.due:'')));
      if(camp.guide)row(parent,'案内・確認事項',[camp.guide]);
      if(recentHistory.length)row(parent,'最近の更新',recentHistory.slice(0,5).map(x=>new Date(x.at).toLocaleString('ja-JP')+' ／ '+(tabs[x.entity]||'合宿設定・運営記録')));
      parent.append(el('p','最終取得：'+loadedAt.toLocaleString('ja-JP')+' ／ 更新番号 '+camp.revision,'small'));
    },
    schedule(parent,toolbar) {
      if(canEdit('schedule'))toolbar.append(button('＋ 行程を追加',()=>edit('schedule',{date:scheduleDay||camp.start})));
      const days=[];for(let d=Date.parse(camp.start);d<=Date.parse(camp.end);d+=86400000)days.push(new Date(d).toISOString().slice(0,10));
      if(!days.includes(scheduleDay))scheduleDay=days[0];
      control(parent,'表示する日',days.map((d,i)=>[d,(i+1)+'日目 '+d]),scheduleDay,v=>{scheduleDay=v;render();});
      const records=scheduleItems().filter(x=>x.date===scheduleDay);empty(parent,records);
      for(const x of records) {
        const current=Date.now()>=Date.parse(x.date+'T'+x.start+':00+09:00')&&Date.now()<Date.parse(x.date+'T'+x.end+':00+09:00');
        const actions=editActions('schedule',x);
        if(canEdit('schedule'))actions.push(button('複製',()=>edit('schedule',{...x,id:undefined}),true),button('変更をお知らせ',()=>edit('announcements',{title:'行程変更：'+x.title,body:x.date+' '+x.start+' '+x.title+'\n'+(x.notes||''),audience:'all',pinned:true}),true));
        const body=row(parent,x.start+'〜'+x.end+' '+x.title,[x.detail,x.place,x.address,x.owner?'担当：'+x.owner:'',x.notes,x.belongings?'持ち物：'+x.belongings:''],actions,current?'現在の行程':undefined);
        if(current)body.parentElement.classList.add('current');
        if(x.mapUrl)link(body,x.mapUrl,'地図を開く');
      }
    },
    participants(parent,toolbar) {
      if(manager()){toolbar.append(button('＋ 参加者を追加',()=>edit('participants')),button('SMC名簿から選択',importMembers,true));}
      const input=el('input');input.placeholder='氏名・学年で検索';input.setAttribute('aria-label','参加者を検索');input.value=search;input.onchange=()=>{search=input.value;render();};parent.append(input);
      control(parent,'出欠で絞り込み',[['','全員'],...opts(['yes','no','pending'])],filter,v=>{filter=v;render();});
      const records=vals(camp.participants).filter(x=>(!filter||x.response===filter)&&(x.name+' '+(x.grade||'')).includes(search)).sort((a,b)=>a.name.localeCompare(b.name,'ja'));
      const groups={};for(const p of records){const k=(p.grade||'学年なし')+'／'+label(p.kind);groups[k]=(groups[k]||0)+1;}
      parent.append(el('p',Object.entries(groups).map(([k,v])=>k+' '+v+'人').join('　'),'small'));empty(parent,records);
      for(const x of records) {
        const actions=editActions('participants',x);
        if(camp.role==='parent')actions.push(button('出欠を回答',()=>modal('ご家族の出欠',schema.participants().filter(f=>['response','overnight'].includes(f.key)),x,data=>command('save',{...x,...data},'participants')),true));
        row(parent,x.name,[label(x.kind)+' ／ '+(x.grade||'')+' ／ '+(x.overnight?'宿泊あり':'宿泊なし'),x.guardian?'同行：'+x.guardian:''],actions,label(x.response));
      }
    },
    vehicles(parent,toolbar) {
      if(manager()){toolbar.append(button('＋ 車両を追加',()=>edit('vehicles')),button('乗車を割り当て',()=>edit('rides'),true),button('割当を変更・解除',()=>assignmentList('rides'),true),button('現在地を更新',async()=>{locations=await api('/api/camps/'+camp.id+'/locations');render();},true));}
      control(parent,'往路・復路',opts(['outbound','return']),filter||'outbound',v=>{filter=v;render();});
      const direction=filter||'outbound',records=vals(camp.vehicles).filter(x=>x.direction===direction);
      const rides=vals(camp.rides).filter(x=>camp.vehicles[x.vehicleId]?.direction===direction);
      row(parent,'未配車', [participating().filter(p=>!rides.some(r=>r.participantId===p.id)).map(p=>p.name).join('、')||'全員配車済み']);
      parent.append(el('p','定員には運転者も含みます。運転者を参加者として登録し、乗車割当にも含めてください。現在地は30分以内の最新1件だけ保存し、停止時に削除します。','small'));
      empty(parent,records);
      for(const x of records) {
        const assigned=rides.filter(r=>r.vehicleId===x.id),actions=editActions('vehicles',x);
        if(manager()||x.driverUid===user.uid) {
          for(const [status,title] of [['moving','出発報告'],['resting','休憩報告'],['arrived','到着報告']])actions.push(button(title,()=>command('vehicleStatus',{id:x.id,status},'vehicles'),true));
        }
        if(x.driverUid===user.uid){
          actions.push(button('現在地を1回報告',()=>startLocation(x,false),true),button('位置共有を開始',()=>startLocation(x,true),true),button('共有停止・位置削除',()=>stopLocation(x.id),true));
        }
        const body=row(parent,x.name+' '+assigned.length+'/'+x.capacity+'人',['運転者：'+(x.driver||'未設定'),assigned.map(r=>(camp.participants[r.participantId]?.name||'不明')+(r.boarded?' ✓乗車確認':' 未確認')).join('、'),x.actualDeparture?'出発実績：'+new Date(x.actualDeparture).toLocaleString('ja-JP'):'',x.actualArrival?'到着実績：'+new Date(x.actualArrival).toLocaleString('ja-JP'):''],actions,label(x.status));
        const loc=locations.find(l=>l.vehicleId===x.id&&l.expires>Date.now());
        if(loc){body.append(el('p','最終更新 '+Math.max(0,Math.floor((Date.now()-Date.parse(loc.at))/60000))+'分前 ／ 精度 約'+Math.round(loc.accuracy)+'m（現在位置の保証ではありません）'));link(body,'https://www.google.com/maps?q='+loc.lat+','+loc.lng,'報告位置を地図で確認');}
        else body.append(el('p','位置情報：未取得・停止・期限切れ'));
        if(x.shareUrl)link(body,x.shareUrl,'登録された外部共有地図');
      }
    },
    checks(parent,toolbar) {
      const input=el('input');input.value=checkpoint;input.setAttribute('aria-label','点呼名');input.onchange=()=>{checkpoint=input.value.trim()||'朝の集合';render();};parent.append(el('label','点呼名（例：朝の集合・ホテル到着）'),input);
      control(parent,'対象',[['','全員'],...vals(camp.vehicles).map(v=>['v:'+v.id,label(v.direction)+' '+v.name]),...Array.from(new Set(participating().map(p=>p.grade).filter(Boolean))).map(g=>['g:'+g,g])],filter,v=>{filter=v;render();});
      const records=participating().filter(p=>!filter||(filter.startsWith('v:')?vals(camp.rides).some(r=>r.vehicleId===filter.slice(2)&&r.participantId===p.id):p.grade===filter.slice(2)));
      const checkFor=p=>currentChecks().find(x=>x.participantId===p.id);
      records.sort((a,b)=>Number(!!checkFor(a)&&checkFor(a).status!=='missing')-Number(!!checkFor(b)&&checkFor(b).status!=='missing'));
      const confirmed=records.filter(p=>checkFor(p)?.status==='confirmed').length,absent=records.filter(p=>checkFor(p)?.status==='absent').length;
      stats(parent,[['対象',records.length],['確認済み',confirmed],['未確認',records.length-confirmed-absent],['欠席',absent]]);
      if(confirmed!==records.length)parent.append(el('p','注意：参加予定人数と確認済み人数が一致していません。欠席者も責任者が確認してください。','notice'));
      for(const p of records) {
        const x=checkFor(p),last=vals(camp.checks).filter(x=>x.participantId===p.id&&x.status==='confirmed').sort((a,b)=>b.checkedAt.localeCompare(a.checkedAt))[0];
        const actions=canEdit('checks')?['confirmed','missing','absent'].map(status=>button(label(status),()=>modal('点呼：'+p.name,[f('place','人が確認した場所','text',null,true)],{place:x?.place||''},data=>command('save',{id:x?.id||id(),participantId:p.id,checkpoint,status,...data},'checks')),true)):[];
        row(parent,p.name,[x?.checkedAt?'記録：'+new Date(x.checkedAt).toLocaleString('ja-JP')+' ／ 担当 '+x.checkedBy:'',last?'最後の確認：'+last.place+' '+new Date(last.checkedAt).toLocaleString('ja-JP'):'確認済みの点呼記録なし'],actions,label(x?.status||'missing'));
      }
    },
    rooms(parent,toolbar) {
      if(manager())toolbar.append(button('＋ 部屋を追加',()=>edit('rooms')),button('宿泊者を割り当て',()=>edit('roomAssignments'),true),button('割当を変更・解除',()=>assignmentList('roomAssignments'),true));
      const assignments=vals(camp.roomAssignments);
      row(parent,'未割当の宿泊者',[participating().filter(p=>p.overnight&&!assignments.some(a=>a.participantId===p.id)).map(p=>p.name).join('、')||'未割当なし']);
      const records=vals(camp.rooms);empty(parent,records);
      for(const r of records){const ps=assignments.filter(a=>a.roomId===r.id);row(parent,r.name+' '+ps.length+'/'+r.capacity+'人',[r.type,r.owner?'担当：'+r.owner:'',ps.map(a=>camp.participants[a.participantId]?.name).join('、'),r.notes],editActions('rooms',r));}
    },
    charges(parent,toolbar) {
      if(finance())toolbar.append(button('＋ 請求を登録',()=>edit('charges')),button('入金・返金を登録',()=>edit('payments'),true));
      toolbar.append(button('入金履歴CSV',()=>exportCSV('payments'),true));
      parent.append(el('h3','家庭別の未納額（合宿参加家庭に共有）'));
      parent.append(el('p','氏名と未納額を共有します。同じ保護者UIDで家庭単位に集計し、未設定の場合は参加者単位で表示します。','small'));
      for(const x of camp.sharedOutstanding||[])row(parent,x.names.join('・'),['未納 '+yen(x.amount)]);
      if(!camp.sharedOutstanding?.length)parent.append(el('p','未納はありません。'));
      parent.append(el('h3',camp.role==='parent'?'自分の家庭の請求・入金明細':'請求・入金明細'));
      const t=camp.totals;stats(parent,[['請求総額',yen(t.billed)],['入金済総額（返金差引）',yen(t.received)],['未納総額',yen(t.outstanding)],['過入金・返金候補',yen(t.credit)],['入金済人数',t.paidCount],['未納人数',t.unpaidCount],['集金率',t.rate===null?'請求なし':(t.rate*100).toFixed(1)+'%']]);
      parent.append(el('p','請求は割引・追加費用を反映した金額で登録します。家族まとめ払いは参加者ごとに金額を分け、同じ家族共通番号と異なる入金識別番号を付けて登録してください。','small'));
      control(parent,'表示',[['','全員'],['unpaid','未納のみ']],filter,v=>{filter=v;render();});
      for(const p of vals(camp.participants).filter(p=>!filter||t.balances[p.id]?.due>0)) {
        const b=t.balances[p.id]||{};row(parent,p.name,['請求 '+yen(b.billed)+' ／ 入金 '+yen(b.received)+' ／ 未納 '+yen(b.due)]);
        for(const x of vals(camp.charges).filter(x=>x.participantId===p.id))row(parent,'請求 '+yen(x.amount),['期限 '+x.due,x.notes],editActions('charges',x));
        for(const x of vals(camp.payments).filter(x=>x.participantId===p.id))row(parent,label(x.kind)+' '+yen(x.amount)+(x.void?'（取消）':''),[x.date+' ／ '+label(x.method),'識別番号：'+x.reference,x.notes],editActions('payments',x));
      }
    },
    transactions(parent,toolbar) {
      if(finance())toolbar.append(button('＋ 取引を追加',()=>edit('transactions')));
      const t=camp.totals;stats(parent,[['収入',yen(t.income)],['支出',yen(t.expense)],['収支差額',yen(t.balance)],['未精算の立替',yen(t.advances)]]);
      row(parent,'参加費（集金台帳から自動連動）',[yen(t.received)+' ／ 入金・返金と同一データから計算しています。']);
      const tx=vals(camp.transactions).sort((a,b)=>a.date.localeCompare(b.date));empty(parent,tx);
      for(const x of tx)row(parent,x.category+' '+yen(x.amount)+(x.void?'（取消）':''),[label(x.kind)+' ／ '+x.date+' ／ 予算 '+yen(x.budget),x.payer?'立替：'+x.payer+' ／ '+(x.settled?'精算済み':'未精算'):'',x.notes],editActions('transactions',x));
      parent.append(el('p','開催日：'+camp.start+'〜'+camp.end+' ／ 参加人数：'+participating().length+'人','small'));
    },
    announcements(parent,toolbar) {
      if(canEdit('announcements'))toolbar.append(button('＋ お知らせ',()=>edit('announcements')));
      const records=vals(camp.announcements).sort((a,b)=>Number(b.pinned)-Number(a.pinned));empty(parent,records);
      for(const x of records){const read=!!x.readBy?.[user.uid];row(parent,x.title,[x.body], [...editActions('announcements',x),...(!read?[button('既読にする',()=>command('read',{id:x.id}),true)]:[])],(x.pinned?'重要 ／ ':'')+label(x.audience)+' ／ '+(read?'既読':'未読'));}
    },
    checklists(parent,toolbar) {
      if(canEdit('checklists'))toolbar.append(button('＋ 持ち物・準備',()=>edit('checklists')));
      const records=vals(camp.checklists).sort((a,b)=>Number(a.done)-Number(b.done));empty(parent,records);
      for(const x of records)row(parent,x.title,[x.due?'期限：'+x.due:'',x.assignee?'担当：'+x.assignee:''],editActions('checklists',x),x.done?'完了':'未完了');
    },
    emergency(parent,toolbar) {
      toolbar.append(button('＋ 緊急情報',()=>edit('emergency')));
      for(const x of vals(camp.emergency))row(parent,x.title,[x.phone,x.body],editActions('emergency',x));
      parent.append(el('p','施設連絡先・集合場所・対応手順を登録します。個人の緊急連絡先・健康情報は入力しないでください。責任者だけに表示されます。','small'));
    },
    settings(parent,toolbar) {
      toolbar.append(button('合宿情報を編集',()=>modal('合宿情報',schema.meta(),camp,data=>command('meta',data))));
      toolbar.append(button('翌年・別日程へ複製',()=>modal('行程・部屋・準備項目を複製',schema.meta(),{...camp,name:camp.name+'（複製）',status:'準備中',archived:false},data=>command('duplicate',data)),true));
      if(info?.admin)toolbar.append(button('権限を割り当て',()=>modal('合宿ごとの担当権限',[f('uid','利用者のUID','text',null,true),select('role','権限',[...opts(['leader','accountant','staff','parent']),['revoke','この合宿へのアクセスを解除']])],{},data=>command('permission',data)),true));
      toolbar.append(button('変更履歴を表示',async()=>{const history=await api('/api/camps/'+camp.id+'/history');const box=el('section');for(const x of history)row(box,new Date(x.at).toLocaleString('ja-JP'),[x.action+' ／ '+(tabs[x.entity]||x.entity||'合宿設定'),'担当UID：'+x.actor]);parent.append(box);},true));
      toolbar.append(button('健康・緊急情報を消去',async()=>{if(confirm('この合宿の健康情報・緊急連絡先・緊急情報・位置共有を消去します。必要な対応が終了していることを確認してください。'))await command('eraseSensitive');},true));
      parent.append(el('p','複製するのは基本設定・行程・部屋・準備項目です。参加者、家族UID、集金、位置情報、点呼記録は複製しません。','small'));
    }
  };
  function link(parent,url,title){if(!/^https:\/\//i.test(url))return;const a=el('a',title);a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}
  function assignmentList(entity) {
    const records=vals(camp[entity]);
    modal('割当を選択',[select('id','変更する割当',records.map(x=>[x.id,(camp.participants[x.participantId]?.name||'')+' ／ '+(entity==='rides'?camp.vehicles[x.vehicleId]?.name:camp.rooms[x.roomId]?.name)]))],{},data=>{
      const x=camp[entity][data.id];$('camp-dialog').close();
      modal('割当の変更',schema[entity](),x,d=>command('save',{...x,...d},entity));
      const deleteButton=button('この割当を解除',()=>remove(entity,x),true);$('camp-fields').append(deleteButton);
    });
  }
  async function importMembers() {
    const members=await api('/api/camps/'+camp.id+'/members');
    const available=members.filter(m=>!vals(camp.participants).some(p=>p.memberId===m.id));
    if(!available.length)throw new Error('未登録の選手はいません');
    modal('既存SMC名簿から追加',[select('memberId','選手',available.map(m=>[m.id,m.name+' '+m.grade]))],{},data=>{
      const m=available.find(x=>x.id===data.memberId);$('camp-dialog').close();
      edit('participants',{memberId:m.id,name:m.name,grade:m.grade,kind:'player',response:'pending'});
    });
  }
  async function startLocation(vehicle,continuous) {
    if(!navigator.geolocation)throw new Error('この端末は位置取得に対応していません。出発・到着報告をご利用ください。');
    if(sharingVehicle)throw new Error('既に位置共有中です。停止してから切り替えてください。');
    if(!confirm('担当成人として位置共有に同意しますか？\n停車中または同乗者が操作してください。移動時間内のみ共有し、最新1件を最大30分保存します。Webアプリでは画面を閉じた後の更新は保証されません。'))return;
    const campId=camp.id;
    const session=await api('/api/camps/'+campId+'/locations/'+vehicle.id,{start:true,consent:true,adult:true});
    sharingCamp=campId;sharingVehicle=vehicle.id;sharingToken=session.token;
    sharingTimer=setTimeout(()=>stopLocation(vehicle.id).catch(e=>message(e.message,true)),Math.max(1,session.expires-Date.now()));
    const send=async position=>{
      if(sharingToken!==session.token)return;
      try {await api('/api/camps/'+campId+'/locations/'+vehicle.id,{lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy,token:session.token});message('位置を報告しました。最終送信 '+new Date().toLocaleTimeString('ja-JP'));}
      catch(e){clearLocationWatch();message(e.message,true);}
    };
    const error=async()=>{try{await stopLocation(vehicle.id);}catch{}message('位置を取得できませんでした。権限拒否でも点呼・手動の出発到着報告は利用できます。',true);};
    if(continuous){watchId=navigator.geolocation.watchPosition(send,error,{enableHighAccuracy:true,timeout:15000,maximumAge:15000});}
    else navigator.geolocation.getCurrentPosition(send,error,{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }
  async function stopLocation(vehicleId) {
    const campId=sharingCamp||camp?.id;clearLocationWatch();
    await api('/api/camps/'+campId+'/locations/'+vehicleId,{stop:true});message('位置共有を停止し、保存位置を削除しました。');locations=[];render();
  }
  function clearLocationWatch(){if(watchId!==null)navigator.geolocation.clearWatch(watchId);clearTimeout(sharingTimer);watchId=null;sharingVehicle=null;sharingCamp=null;sharingToken=null;}
  function exportCSV(entity=tab) {
    let data=entity==='charges'?vals(camp.participants).map(p=>({氏名:p.name,請求額:camp.totals.balances[p.id]?.billed||0,入金額:camp.totals.balances[p.id]?.received||0,未納額:camp.totals.balances[p.id]?.due||0})):vals(camp[entity]);
    if(entity==='vehicles')data=data.map(v=>({車両:v.name,往復:label(v.direction),運転者:v.driver,定員:v.capacity,乗車者:vals(camp.rides).filter(r=>r.vehicleId===v.id).map(r=>camp.participants[r.participantId]?.name).join('・'),状況:label(v.status)}));
    if(entity==='rooms')data=data.map(r=>({部屋:r.name,定員:r.capacity,担当者:r.owner,宿泊者:vals(camp.roomAssignments).filter(a=>a.roomId===r.id).map(a=>camp.participants[a.participantId]?.name).join('・')}));
    const headers={name:'氏名',grade:'学年',kind:'区分',response:'出欠',overnight:'宿泊',guardian:'同行保護者',dates:'参加日程',date:'日付',start:'開始',end:'終了',title:'名称',detail:'内容',place:'場所',address:'住所',mapUrl:'地図リンク',owner:'担当者',notes:'備考',belongings:'持ち物',order:'表示順',participantId:'参加者',checkpoint:'点呼名',status:'状態',checkedAt:'確認時刻',checkedBy:'確認担当UID',amount:'金額',due:'期限',method:'支払方法',reference:'入金識別番号',familyReference:'家族共通番号',void:'取消',category:'科目',budget:'予算',payer:'立替者',settled:'精算済み',body:'本文',audience:'公開範囲',pinned:'重要',assignee:'担当UID',done:'完了'};
    // 緊急連絡先・健康情報・家族ID・読者IDは通常の出力に含めない。
    const excluded=new Set(['id','care','consent','emergencyContact','familyUid','driverUid','readBy','memberId']);
    data=data.map(x=>Object.fromEntries(Object.entries(x).filter(([k])=>!excluded.has(k)).map(([k,v])=>[headers[k]||k,k==='participantId'?(camp.participants[v]?.name||'不明'):typeof v==='boolean'?(v?'はい':'いいえ'):['kind','response','status','audience','method'].includes(k)?label(v):v])));
    const keys=[...new Set(data.flatMap(Object.keys))];
    const esc=x=>'"'+String(x??'').replace(/^(?:\s*[=+\-@]|[\t\r\n])/,"'$&").replace(/"/g,'""')+'"';
    const content='\uFEFF'+[keys,...data.map(x=>keys.map(k=>typeof x[k]==='object'?'':x[k]))].map(row=>row.map(esc).join(',')).join('\r\n');
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=camp.name+'-'+(tabs[entity]||'入金履歴')+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  $('camp-form').onsubmit=async event=>{
    event.preventDefault();const data={};for(const f of formFields){const input=$('camp-form').elements.namedItem(f.key);data[f.key]=f.type==='checkbox'?input.checked:f.type==='number'?(input.value===''?0:Number(input.value)):input.value;}
    try{await saveHandler(data);}catch(error){$('camp-form-error').textContent=error.message;}
  };
  $('camp-dialog-close').onclick=()=>{if(!busy)$('camp-dialog').close();};
  $('camp-list-button').onclick=()=>list().catch(e=>message(e.message,true));
  $('camp-refresh').onclick=()=>{if($('camp-dialog').open)return message('入力画面を閉じてから最新情報を取得してください。',true);(camp?load(camp.id):list()).then(()=>message('最新情報を取得しました')).catch(e=>message(e.message,true));};
  $('camp-logout').onclick=async()=>{if(sharingVehicle)try{await stopLocation(sharingVehicle);}catch{}await FIREBASE_AUTH.signOut();};
  $('login-form').onsubmit=async event=>{event.preventDefault();try{await FIREBASE_AUTH.signInWithEmailAndPassword(event.target.email.value,event.target.password.value);event.target.password.value='';}catch{message('ログインできませんでした。メールアドレス・パスワードと管理者設定を確認してください。',true);}};
  $('reset-password').onclick=async()=>{const email=$('login-form').email.value;if(!email)return message('メールアドレスを入力してください',true);try{await FIREBASE_AUTH.sendPasswordResetEmail(email);message('再設定を受け付けました。メールを確認してください。');}catch{message('再設定できませんでした。管理者へお問い合わせください。',true);}};
  window.addEventListener('offline',()=>message('オフラインです。取得済みの画面は参照できます。保存は再接続後に行ってください。',true));
  window.addEventListener('online',()=>message('通信が戻りました。保存の再試行、または最新情報の取得を行ってください。'));
  setInterval(()=>{if(camp&&!busy&&!$('camp-dialog').open&&document.visibilityState==='visible'&&['dashboard','schedule','vehicles'].includes(tab))render();},60000);
  window.addEventListener('beforeunload',event=>{if($('camp-dialog').open||pendingCommand){event.preventDefault();event.returnValue='';}});
  if(!/^https:\/\//.test(window.SMC_CAMP_CONFIG?.apiBase||'')){
    message('合宿管理APIの接続設定待ちです。個人情報を安全に保存するため、管理者が認証とHTTPS APIを設定すると利用できます。');return;
  }
  onFirebaseReady(async()=>{
    if(!FIREBASE_AUTH){message('認証サービスを読み込めませんでした。再読み込みしてください。',true);return;}
    await FIREBASE_AUTH.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    FIREBASE_AUTH.onAuthStateChanged(async current=>{
      user=current;camp=null;locations=[];pendingCommand=null;$('camp-content').replaceChildren();$('camp-dialog').close();
      clearLocationWatch();
      $('camp-login').hidden=!!current;$('camp-app').hidden=!current;
      if(current){try{await list();message('ログインしました。合宿を選択してください。');}catch(e){message(e.message,true);}}
      else message('合宿の担当者・保護者アカウントでログインしてください。');
    });
  });
})();
