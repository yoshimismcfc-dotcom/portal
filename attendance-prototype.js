(function(){
  "use strict";
  var STORAGE_KEY="yoshimi_smc_attendance_prototype_v1";
  var GRADES=["6年","5年","4年","3年","2年","1年","年長"];
  var DAY_NAMES=["日","月","火","水","木","金","土"];
  var ANSWERS=[{value:"attending",label:"参加"},{value:"maybe",label:"未定"},{value:"absent",label:"不参加"}];
  var state=loadState(),members=[],rosterState="読み込み中",holidays={},audience="players",selectedDate="",selectedEventId="",selectedGrade="すべて",editingPersonId="",formAnswers={},transposeBoard=false;
  var $=function(id){return document.getElementById(id);};
  function loadState(){try{var value=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");return {events:Array.isArray(value.events)?value.events:[],archive:Array.isArray(value.archive)?value.archive:[],coaches:Array.isArray(value.coaches)?value.coaches:[],answers:value.answers&&typeof value.answers==="object"?value.answers:{},notes:value.notes&&typeof value.notes==="object"?value.notes:{}};}catch(e){return {events:[],archive:[],coaches:[],answers:{},notes:{}};}}
  function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch(e){alert("このブラウザに保存できませんでした。プライベートブラウズ設定や空き容量をご確認ください。");return false;}}
  function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];});}
  function localISO(date){return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");}
  function fromISO(value){var parts=String(value).split("-").map(Number);return new Date(parts[0],parts[1]-1,parts[2]);}
  function dateLabel(value){var date=fromISO(value);return date.getFullYear()+"年"+(date.getMonth()+1)+"月"+date.getDate()+"日（"+DAY_NAMES[date.getDay()]+"）";}
  function todayISO(){return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
  function maxDate(){var d=fromISO(todayISO()),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+2);var lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,lastDay));return localISO(d);}
  function movePastEvents(){var today=todayISO(),active=[];state.events.forEach(function(event){if(event.date<today){event.archivedAt=new Date().toISOString();state.archive.push(event);}else active.push(event);});if(active.length!==state.events.length){state.events=active;saveState();}}
  function readRoster(){
    var started=false;
    function consume(db){if(started)return;started=true;db.ref("members_v2").once("value").then(function(snapshot){var raw=snapshot.val()||{},list=[];Object.keys(raw).forEach(function(id){var m=raw[id];if(m&&String(m.name||"").trim()){list.push({id:String(m.id||id),name:String(m.name).trim(),kana:String(m.kana||""),grade:String(m.grade||"未設定")});}});members=list.sort(function(a,b){var ga=GRADES.indexOf(a.grade),gb=GRADES.indexOf(b.grade);if(ga<0)ga=99;if(gb<0)gb=99;return ga-gb||String(a.kana||a.name).localeCompare(String(b.kana||b.name),"ja");});rosterState="名簿から"+members.length+"名を読み込みました";$("roster-status").textContent="✓ "+rosterState+"（読み取り専用）";render();}).catch(function(){rosterState="団員名簿を読み込めませんでした。通信状態をご確認ください";$("roster-status").textContent="⚠ "+rosterState;render();});}
    if(window.FIREBASE_READY&&window.FIREBASE_DB)consume(window.FIREBASE_DB);else if(typeof window.onFirebaseReady==="function")window.onFirebaseReady(consume);else{rosterState="名簿の読み込み機能を利用できません";render();}
    window.setTimeout(function(){if(!started){rosterState="名簿の読み込みに時間がかかっています。画面を更新してください";render();}},10000);
  }
  function loadHolidays(){
    try{var cached=JSON.parse(localStorage.getItem("yoshimi_jp_holidays_cache_v1")||"null");if(cached&&cached.savedAt>Date.now()-7*86400000){holidays=cached.data||{};renderDateOptions();renderResponse(true);}}
    catch(e){}
    fetch("https://holidays-jp.github.io/api/v1/date.json").then(function(r){if(!r.ok)throw new Error("holiday data unavailable");return r.json();}).then(function(data){holidays=data||{};localStorage.setItem("yoshimi_jp_holidays_cache_v1",JSON.stringify({savedAt:Date.now(),data:holidays}));renderDateOptions();renderResponse(true);}).catch(function(){if(!Object.keys(holidays).length){holidays={};renderDateOptions();renderResponse(true);}});
  }
  function isDefaultDay(iso){var date=fromISO(iso);return [0,3,4,6].indexOf(date.getDay())>=0||Boolean(holidays[iso]);}
  function defaultEvent(iso){
    return {id:"day_"+iso,date:iso,kind:"",title:holidays[iso]||""};
  }
  function getBoardEvents(){
    var start=fromISO(todayISO()),end=fromISO(maxDate()),events=[];
    for(var date=new Date(start);date<=end;date.setDate(date.getDate()+1)){
      var iso=localISO(date);
      var registered=eventForDate(iso);
      if(registered.length){
        events.push.apply(events,registered.sort(function(a,b){return a.title.localeCompare(b.title,"ja");}));
      }else if(isDefaultDay(iso)){
        events.push(defaultEvent(iso));
      }
    }
    return events;
  }
  function pastDefaultEvents(){
    var today=todayISO();
    return Object.keys(state.answers).filter(function(id){
      return /^day_\d{4}-\d{2}-\d{2}$/.test(id)&&id.slice(4)<today&&
        !state.archive.some(function(event){return event.id===id;})&&
        Object.values(state.answers[id]||{}).some(function(responses){return Object.keys(responses).length;});
    }).map(function(id){return defaultEvent(id.slice(4));});
  }
  function eventDetails(event){
    var kind=event.kind==="match"?"試合":event.kind==="practice"?"練習":"";
    return (kind?'<span class="board-kind">'+kind+'</span>':"")+
      (event.title?'<span class="board-event-title" title="'+esc(event.title)+'">'+esc(event.title)+'</span>':"");
  }
  function eventForDate(iso){return state.events.filter(function(e){return e.date===iso;});}
  function renderDateOptions(){
    var list=$("date-options"),start=fromISO(todayISO()),end=fromISO(maxDate()),parts=[];
    for(var date=new Date(start);date<=end;date.setDate(date.getDate()+1)){
      var iso=localISO(date);if(!isDefaultDay(iso))continue;
      var items=eventForDate(iso),holiday=holidays[iso],weekday=date.getDay(),routine=weekday===3?"通常練習":weekday===4?"低学年練習":"";
      var classes="date-option"+(selectedDate===iso?" selected":"")+(items.length?" has-event":"");
      var tags=(holiday?'<span class="date-option-holiday">'+esc(holiday)+"</span>":"")+(routine?"<span>"+esc(routine)+"</span>":"")+(items.length?'<span class="date-option-added">登録済み '+items.length+"件</span>":"");
      parts.push('<button type="button" class="'+classes+'" data-date="'+iso+'" aria-pressed="'+(selectedDate===iso?"true":"false")+'"><span class="date-option-date">'+(date.getMonth()+1)+"/"+date.getDate()+"（"+DAY_NAMES[weekday]+'）</span><span class="date-option-tags">'+tags+'</span><span class="date-option-select">'+(selectedDate===iso?"選択中":"選ぶ")+"</span></button>");
    }
    list.innerHTML=parts.length?parts.join(""):'<div class="empty-state">今後2か月以内に対象日がありません。</div>';
    list.querySelectorAll("button[data-date]").forEach(function(btn){btn.addEventListener("click",function(){selectedDate=btn.dataset.date;$("selected-date-label").textContent=dateLabel(selectedDate)+(holidays[selectedDate]?" · "+holidays[selectedDate]:"");$("add-event").disabled=false;renderDateOptions();renderResponse();});});
    $("add-event").disabled=!selectedDate||selectedDate<todayISO()||selectedDate>maxDate()||!isDefaultDay(selectedDate);
    $("selected-date-label").textContent=selectedDate?dateLabel(selectedDate)+(holidays[selectedDate]?" · "+holidays[selectedDate]:""):"日程を選んでください";
  }
  function answerCounts(event){var table=state.answers[event.id]&&state.answers[event.id][audience]||{};var counts={attending:0,maybe:0,absent:0,unanswered:0};var people=audience==="players"?members:state.coaches;people.forEach(function(person){var id=audience==="players"?person.id:person.id;var value=table[id]&&table[id].value;if(counts[value]!=null)counts[value]++;else counts.unanswered++;});return counts;}
  function renderEventList(){
    var active=state.events.slice().sort(function(a,b){return a.date.localeCompare(b.date)||a.title.localeCompare(b.title,"ja");});
    var list=$("event-list");
    if(!active.length){
      list.innerHTML='<div class="empty-state">日程を選ぶと予定の詳細を追加できます。</div>';
    }else{
      list.innerHTML=active.map(function(event){
        var c=answerCounts(event);
        return '<article class="event-card'+(selectedEventId===event.id?" selected":"")+'"><button class="event-open" type="button" data-open-event="'+esc(event.id)+'"><strong>'+esc(event.title)+'</strong><span class="event-meta"><span>'+dateLabel(event.date)+'</span><span class="kind-badge '+(event.kind==="match"?"match":"")+'">'+(event.kind==="match"?"試合":"練習")+'</span>'+(event.place?'<span>'+esc(event.place)+'</span>':"")+"</span></button><span class=\"event-count\">参加 <b>"+c.attending+"</b> ・未定 "+c.maybe+'<br>未回答 '+c.unanswered+'</span><button type="button" class="delete-event" data-delete-event="'+esc(event.id)+'" aria-label="この予定を削除">削除</button></article>';
      }).join("");
    }
    list.querySelectorAll("[data-open-event]").forEach(function(btn){btn.addEventListener("click",function(){openEvent(btn.dataset.openEvent);});});
    list.querySelectorAll("[data-delete-event]").forEach(function(btn){btn.addEventListener("click",function(){var event=state.events.find(function(e){return e.id===btn.dataset.deleteEvent;});if(event&&confirm("「"+event.title+"」を試作データから削除しますか？")){state.events=state.events.filter(function(e){return e.id!==event.id;});delete state.answers[event.id];if(selectedEventId===event.id)selectedEventId="";saveState();render();}});});
    var archive=document.getElementById("archive-list");if(archive){archive.innerHTML=state.archive.length?state.archive.slice().sort(function(a,b){return b.date.localeCompare(a.date);}).map(function(e){return '<div class="event-card"><span><strong>'+esc(e.title)+'</strong><span class="event-meta">'+dateLabel(e.date)+' · 過去の予定（端末内保管）</span></span><span class="kind-badge">保存済み</span></div>';}).join(""):'<div class="empty-state">過去の予定はありません。</div>';}
  }
  function getPeople(){return audience==="players"?members:state.coaches;}
  function answerMark(value){return value==="attending"?"○":value==="maybe"?"△":value==="absent"?"×":"";}
  function answerButton(event,person,value){var symbol=answerMark(value),label=value?symbol:"未回答";return '<button type="button" class="board-mark editable" data-answer-event="'+esc(event.id)+'" data-answer-person="'+esc(person.id)+'" data-value="'+esc(value||"")+'" aria-label="'+esc(person.name)+" "+dateLabel(event.date)+" 現在："+label+"。タップで次の回答に変更"+'">'+symbol+"</button>";}
  function renderResponse(preserveScroll){
    var panel=$("response-panel"),rows=$("response-list"),oldBoard=rows.querySelector(".attendance-board-scroll"),savedTop=preserveScroll&&oldBoard?oldBoard.scrollTop:0,savedLeft=preserveScroll&&oldBoard?oldBoard.scrollLeft:0,people=getPeople(),events=getBoardEvents();
    $("board-toolbar").hidden=true;
    panel.hidden=false;$("response-title").textContent="参加予定【"+(audience==="players"?"団員用":"コーチ用")+"】";$("respondent-count").textContent=people.length+"名";$("response-summary").textContent="名前と日程が交わるマスをタップして、○・△・×を入力できます。";$("entry-mode-button").disabled=audience==="players"&&!members.length;
    $("coach-editor").hidden=audience!=="coaches";$("grade-filters").hidden=audience!=="players";$("grade-filters").innerHTML="";
    if(audience==="players"){var grades=["すべて"].concat(GRADES.filter(function(g){return members.some(function(m){return m.grade===g;});}));$("grade-filters").innerHTML=grades.map(function(g){return '<button type="button" class="filter-chip'+(selectedGrade===g?" active":"")+'" data-grade="'+esc(g)+'">'+esc(g)+(g==="すべて"?"":"（"+members.filter(function(m){return m.grade===g;}).length+"）")+"</button>";}).join("");$("grade-filters").querySelectorAll("[data-grade]").forEach(function(btn){btn.addEventListener("click",function(){selectedGrade=btn.dataset.grade;renderResponse();});});if(selectedGrade!=="すべて")people=people.filter(function(p){return p.grade===selectedGrade;});}
    $("entry-mode-button").textContent=events.length?"出欠を入力する":(selectedDate?"この日に予定を登録":"日程を選んで出欠を入力");$("entry-mode-help").textContent=events.length?"名前を選び、複数の日程をまとめて回答できます。":(selectedDate?dateLabel(selectedDate)+"の練習・試合を登録して、続けて出欠を入力できます。":"水・木・土・日・祝日の一覧から日程を選びます。");
    if(!people.length){rows.innerHTML='<div class="empty-state">'+(audience==="players"?esc(rosterState)+"。":"コーチ名を追加してください。")+"</div>";return;}if(!events.length){rows.innerHTML='<div class="empty-state">表示できる日程がありません。</div>';return;}
    var head,body;
    if(transposeBoard){
      head='<thead><tr><th class="event-col">日程</th>'+people.map(function(person){return '<th class="rotated-person"><button type="button" class="board-member-name" data-edit-person="'+esc(person.id)+'">'+(audience==="players"?'<span class="board-member-grade">'+esc(person.grade||"学年未登録")+'</span>':"")+esc(person.name)+'</button></th>';}).join("")+'</tr></thead><tbody>';
      body=events.map(function(event){var table=state.answers[event.id]&&state.answers[event.id][audience]||{},d=fromISO(event.date),counts={attending:0,maybe:0,absent:0};people.forEach(function(person){var value=table[person.id]&&table[person.id].value;if(counts[value]!=null)counts[value]++;});var row='<tr><th class="event-col" scope="row" data-event-column="'+esc(event.id)+'"><span class="board-date">'+(d.getMonth()+1)+"/"+d.getDate()+"（"+DAY_NAMES[d.getDay()]+'）</span>'+eventDetails(event)+'<span class="event-count-summary">○ '+counts.attending+'人　△ '+counts.maybe+'人　× '+counts.absent+'人</span></th>';people.forEach(function(person){var response=table[person.id]||{};row+='<td>'+answerButton(event,person,response.value||"")+'</td>';});return row+'</tr>';}).join("");
    }else{
      head='<thead><tr><th class="person-col" scope="col">参加者</th>'+events.map(function(event){var d=fromISO(event.date);return '<th scope="col" data-event-column="'+esc(event.id)+'"><span class="board-date">'+(d.getMonth()+1)+"/"+d.getDate()+"（"+DAY_NAMES[d.getDay()]+'）</span>'+eventDetails(event)+'</th>';}).join("")+'</tr></thead><tbody>';
      var summary=ANSWERS.map(function(answer){var symbol=answer.value==="attending"?"○":answer.value==="maybe"?"△":"×",row='<tr class="summary-row"><th class="person-col"><span class="summary-symbol mark-'+answer.value+'">'+symbol+'</span><span> '+answer.label+'</span></th>';events.forEach(function(event){var table=state.answers[event.id]&&state.answers[event.id][audience]||{},count=people.filter(function(person){return table[person.id]&&table[person.id].value===answer.value;}).length;row+='<td>'+count+'人</td>';});return row+'</tr>';}).join("");
      body=people.map(function(person){var note=state.notes[audience]&&state.notes[audience][person.id]||"",row='<tr><th class="person-col" scope="row"><button type="button" class="board-member-name" data-edit-person="'+esc(person.id)+'">'+(audience==="players"?'<span class="board-member-grade">'+esc(person.grade||"学年未登録")+'</span>':"")+'<span>'+esc(person.name)+'</span></button>'+(note?'<span class="board-comment" title="'+esc(note)+'">'+esc(note)+'</span>':"");var coachActions=audience==="coaches"?'<div class="coach-edit-actions"><button type="button" data-edit-coach="'+esc(person.id)+'">名前を編集</button><button type="button" class="remove-coach" data-remove-coach="'+esc(person.id)+'">削除</button></div>':"";row+=coachActions+'</th>';events.forEach(function(event){var table=state.answers[event.id]&&state.answers[event.id][audience]||{},response=table[person.id]||{};row+='<td>'+answerButton(event,person,response.value||"")+'</td>';});return row+"</tr>";}).join("");
      body=summary+body;
    }
    $("board-toolbar").hidden=false;$("board-status").textContent=transposeBoard?"日程を縦、参加者を横に表示中":"参加者を縦、日程を横に表示中";$("transpose-board").setAttribute("aria-pressed",transposeBoard?"true":"false");
    rows.innerHTML='<div class="attendance-board-scroll" role="region" aria-label="出欠一覧、上下左右にスクロール" tabindex="0"><table class="attendance-board'+(transposeBoard?" is-transposed":"")+'">'+head+body+'</tbody></table></div>';
    var newBoard=rows.querySelector(".attendance-board-scroll");if(preserveScroll&&newBoard){newBoard.scrollTop=savedTop;newBoard.scrollLeft=savedLeft;}
    rows.querySelectorAll("[data-edit-person]").forEach(function(btn){btn.addEventListener("click",function(){openAttendanceForm(btn.dataset.editPerson);});});
    rows.querySelectorAll("[data-answer-event]").forEach(function(btn){btn.addEventListener("click",function(){var eventId=btn.dataset.answerEvent,personId=btn.dataset.answerPerson,current=btn.dataset.value,next={attending:"maybe",maybe:"absent",absent:"","":"attending"}[current];if(!events.some(function(item){return item.id===eventId;}))return;if(!state.answers[eventId])state.answers[eventId]={};if(!state.answers[eventId][audience])state.answers[eventId][audience]={};if(next)state.answers[eventId][audience][personId]={value:next,updatedAt:new Date().toISOString()};else delete state.answers[eventId][audience][personId];var saved=saveState();renderEventList();renderResponse(true);
      if(saved)$("answer-status").textContent="回答を保存しました。"+(next?answerMark(next):"未回答");
      var replacement=rows.querySelector('[data-answer-event="'+CSS.escape(eventId)+'"][data-answer-person="'+CSS.escape(personId)+'"]');
      if(replacement)replacement.focus({preventScroll:true});});});
    rows.querySelectorAll("[data-edit-coach]").forEach(function(btn){btn.addEventListener("click",function(){var coach=state.coaches.find(function(c){return c.id===btn.dataset.editCoach;});if(!coach)return;var name=prompt("コーチ名を入力してください",coach.name);if(name!==null&&name.trim()){coach.name=name.trim();saveState();render();}});});rows.querySelectorAll("[data-remove-coach]").forEach(function(btn){btn.addEventListener("click",function(){var coach=state.coaches.find(function(c){return c.id===btn.dataset.removeCoach;});if(coach&&confirm(coach.name+"さんを試作リストから削除しますか？")){state.coaches=state.coaches.filter(function(c){return c.id!==coach.id;});saveState();render();}});});
  }
  function openAttendanceForm(personId){
    var people=getPeople(),events=getBoardEvents(),select=$("entry-person");editingPersonId=personId||"";formAnswers={};
    select.innerHTML='<option value="">名前を選択してください</option>'+people.map(function(person){var label=(audience==="players"?(person.grade||"学年未登録")+" · ":"")+person.name;return '<option value="'+esc(person.id)+'">'+esc(label)+"</option>";}).join("");
    select.value=editingPersonId;$("entry-comment").value="";
    if(editingPersonId){events.forEach(function(event){var value=state.answers[event.id]&&state.answers[event.id][audience]&&state.answers[event.id][audience][editingPersonId];formAnswers[event.id]=value&&value.value||"";});$("entry-comment").value=state.notes[audience]&&state.notes[audience][editingPersonId]||"";}
    renderAttendanceFormEvents(events);$("attendance-dialog").showModal();
  }
  function renderAttendanceFormEvents(events){
    var root=$("attendance-form-events"),options=[{value:"attending",label:"○"},{value:"maybe",label:"△"},{value:"absent",label:"×"},{value:"",label:"未回答"}];
    root.innerHTML=events.map(function(event){var current=formAnswers[event.id]||"";return '<section class="attendance-form-event"><div class="attendance-form-date">'+dateLabel(event.date)+'</div><div class="attendance-form-title">'+eventDetails(event)+(event.place?" · "+esc(event.place):"")+'</div><div class="attendance-form-choices">'+options.map(function(option){return '<button type="button" class="attendance-form-choice'+(current===option.value?" selected":"")+'" data-form-event="'+esc(event.id)+'" data-form-value="'+esc(option.value)+'" aria-pressed="'+(current===option.value?"true":"false")+'">'+option.label+'</button>';}).join("")+'</div></section>';}).join("");
    root.querySelectorAll("[data-form-event]").forEach(function(button){button.addEventListener("click",function(){formAnswers[button.dataset.formEvent]=button.dataset.formValue;renderAttendanceFormEvents(events);});});
  }
  function saveAttendanceForm(event){
    event.preventDefault();var personId=$("entry-person").value;if(!personId){alert("名前を選んでください。");return;}var person=getPeople().find(function(item){return item.id===personId;});if(!person){alert("入力する人を選び直してください。");return;}var now=new Date().toISOString();
    getBoardEvents().forEach(function(item){if(!formAnswers[item.id]&&!state.answers[item.id])return;if(!state.answers[item.id])state.answers[item.id]={};if(!state.answers[item.id][audience])state.answers[item.id][audience]={};if(formAnswers[item.id])state.answers[item.id][audience][personId]={value:formAnswers[item.id],updatedAt:now};else delete state.answers[item.id][audience][personId];});
    if(!state.notes[audience])state.notes[audience]={};var note=$("entry-comment").value.trim().slice(0,80);if(note)state.notes[audience][personId]=note;else delete state.notes[audience][personId];
    saveState();$("attendance-dialog").close();render();
  }
  function openEvent(id){selectedEventId=id;render();var column=document.querySelector('[data-event-column="'+CSS.escape(id)+'"]');if(column)column.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});else $("response-panel").scrollIntoView({behavior:"smooth",block:"start"});}
  function render(){renderDateOptions();renderEventList();renderResponse();}
  function addEvent(){if(!selectedDate||!isDefaultDay(selectedDate)){alert("出欠予定は水・木・土・日・祝日から選んでください。");return;}$("dialog-date").textContent=dateLabel(selectedDate)+(holidays[selectedDate]?" · "+holidays[selectedDate]:"");$("event-title").value=fromISO(selectedDate).getDay()===3?"通常練習":fromISO(selectedDate).getDay()===4?"低学年練習":"";$("event-place").value="";$("event-dialog").showModal();}
  function exportCsv(){var people=getPeople(),rows=[["対象","日付","種類","予定名","会場","名前","学年","出欠","備考","最終更新"]],events=getBoardEvents().concat(state.archive, pastDefaultEvents()).sort(function(a,b){return a.date.localeCompare(b.date);});events.forEach(function(event){var table=state.answers[event.id]&&state.answers[event.id][audience]||{};people.forEach(function(person){var response=table[person.id]||{},note=state.notes[audience]&&state.notes[audience][person.id]||"";rows.push([audience==="players"?"団員":"コーチ",event.date,event.kind==="match"?"試合":event.kind==="practice"?"練習":"",event.title,event.place||"",person.name,person.grade||"",({attending:"参加",maybe:"未定",absent:"不参加"})[response.value]||"未回答",note,response.updatedAt||""]);});});function cell(value){var text=String(value==null?"":value);if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}var csv="\uFEFF"+rows.map(function(row){return row.map(cell).join(",");}).join("\r\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="吉見SMC_出欠試作_"+(audience==="players"?"団員":"コーチ")+"_"+todayISO()+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},0);}
  function init(){movePastEvents();
    document.querySelectorAll(".audience-tab").forEach(function(btn){btn.addEventListener("click",function(){audience=btn.dataset.audience;selectedGrade="すべて";document.querySelectorAll(".audience-tab").forEach(function(tab){var active=tab===btn;tab.classList.toggle("active",active);tab.setAttribute("aria-pressed",active?"true":"false");});render();});});
    $("add-event").addEventListener("click",addEvent);$("cancel-event").addEventListener("click",function(){$("event-dialog").close();});$("event-form").addEventListener("submit",function(e){e.preventDefault();var title=$("event-title").value.trim();if(!title)return;if(selectedDate<todayISO()||selectedDate>maxDate()||!isDefaultDay(selectedDate)){alert("出欠予定は今日から2か月先までの水・木・土・日・祝日から登録してください。");return;}var id=eventForDate(selectedDate).length?"demo_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7):defaultEvent(selectedDate).id;state.events.push({id:id,date:selectedDate,kind:$("event-kind").value,title:title,place:$("event-place").value.trim(),createdAt:new Date().toISOString()});saveState();$("event-dialog").close();openEvent(id);});
    $("entry-mode-button").addEventListener("click",function(){if(getPeople().length){openAttendanceForm("");return;}if(audience==="coaches"&&!state.coaches.length){$("coach-editor").scrollIntoView({behavior:"smooth",block:"center"});$("coach-name-input").focus({preventScroll:true});return;}});$("entry-mode-icon").addEventListener("click",function(){$("entry-mode-button").click();});$("transpose-board").addEventListener("click",function(){transposeBoard=!transposeBoard;renderResponse();});$("cancel-attendance").addEventListener("click",function(){$("attendance-dialog").close();});$("attendance-form").addEventListener("submit",saveAttendanceForm);$("entry-person").addEventListener("change",function(){var id=this.value,events=getBoardEvents();editingPersonId=id;formAnswers={};events.forEach(function(event){var response=id&&state.answers[event.id]&&state.answers[event.id][audience]&&state.answers[event.id][audience][id];formAnswers[event.id]=response&&response.value||"";});$("entry-comment").value=id&&state.notes[audience]&&state.notes[audience][id]||"";renderAttendanceFormEvents(events);});$("export-csv").addEventListener("click",exportCsv);$("reset-demo").addEventListener("click",function(){if(!confirm("この端末に保存した試作の予定・回答・コーチ名をすべて削除しますか？団員名簿は変更されません。"))return;state={events:[],archive:[],coaches:[],answers:{},notes:{}};selectedEventId="";selectedDate="";localStorage.removeItem(STORAGE_KEY);render();});$("add-coach").addEventListener("click",function(){var input=$("coach-name-input"),name=input.value.trim();if(!name){input.focus();return;}if(state.coaches.some(function(c){return c.name===name;})){alert("同じ名前がすでに登録されています。");return;}state.coaches.push({id:"coach_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6),name:name});input.value="";saveState();render();});
    var archiveSection=document.createElement("section");archiveSection.className="panel archived-panel";archiveSection.innerHTML='<details><summary>過去の予定（試作データ）</summary><div id="archive-list" class="event-list"></div><p class="small-note">日付が過ぎた予定は一覧から自動で移し、試作版の回答記録はCSV出力用にこの端末へ残しています。</p></details>';$("event-panel").after(archiveSection);
    render();loadHolidays();readRoster();
  }
  document.addEventListener("DOMContentLoaded",init);
})();
