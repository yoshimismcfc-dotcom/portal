(function(){
  "use strict";
  var STORAGE_KEY="yoshimi_smc_attendance_preview_v1";
  var GRADES=["6年","5年","4年","3年","2年","1年","年長"];
  var DAY_NAMES=["日","月","火","水","木","金","土"];
  var ANSWERS=[{value:"attending",label:"参加"},{value:"maybe",label:"未定"},{value:"absent",label:"不参加"}];
  var TRIPS=["行きのみ","帰りのみ","往復"];
  var deviceMode=false;
  var previewKey=new URLSearchParams(location.hash.slice(1)).get("test")||"";
  var state=loadState(),members=[],rosterState="読み込み中",holidays={},audience="players",selectedDate="",selectedEventId="",selectedGrade="すべて",transposeBoard=false;
  var staffCoaches=[],staffCoachesReady=false,coachRosterStarted=false,coachRosterStatus="コーチ担当を読み込み中…";
  var previewRosterStarted=false, sharedStore, sharedRows=new Map(), sharedReady=false, savingShared=false, entryBaseline;
  if(!deviceMode){state.answers={};state.matchNotes={};state.notes={};state.coaches=[];state.coachLinks={};}
  var weekendPracticeDates=new Set(), calendarMatchesChecked=false;
  var eventVisibility=new Map(),visibilityReady=false,visibilitySaving=false,undoVisibility=null;
  var viewedEvent=null,csvModule=null;
  var excludedHolidays=new Set(), holidaySettingsReady=false, savingHoliday=false;
  var recruitmentRows=new Map(),recruitmentReady=false,recruitmentEdit=null,savingRecruitment=false;
  var $=function(id){return document.getElementById(id);};
  function loadState(){try{var value=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");return {events:Array.isArray(value.events)?value.events:[],archive:Array.isArray(value.archive)?value.archive:[],coaches:Array.isArray(value.coaches)?value.coaches:[],coachLinks:value.coachLinks&&typeof value.coachLinks==="object"&&!Array.isArray(value.coachLinks)?value.coachLinks:{},answers:value.answers&&typeof value.answers==="object"?value.answers:{},notes:value.notes&&typeof value.notes==="object"?value.notes:{},matchNotes:value.matchNotes&&typeof value.matchNotes==="object"?value.matchNotes:{}};}catch(e){return {events:[],archive:[],coaches:[],coachLinks:{},answers:{},notes:{},matchNotes:{}};}}
  function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(deviceMode?state:{...loadState(),events:state.events,archive:state.archive}));return true;}catch(e){alert("このブラウザに保存できませんでした。プライベートブラウズ設定や空き容量をご確認ください。");return false;}}
  function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];});}
  function localISO(date){return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");}
  function fromISO(value){var parts=String(value).split("-").map(Number);return new Date(parts[0],parts[1]-1,parts[2]);}
  function dateLabel(value){var date=fromISO(value);return date.getFullYear()+"年"+(date.getMonth()+1)+"月"+date.getDate()+"日（"+DAY_NAMES[date.getDay()]+"）";}
  function todayISO(){return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
  function maxDate(){var d=fromISO(todayISO()),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+2);var lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,lastDay));return localISO(d);}
  function movePastEvents(){var today=todayISO(),active=[];state.events.forEach(function(event){if(event.date<today){event.archivedAt=new Date().toISOString();state.archive.push(event);}else active.push(event);});if(active.length!==state.events.length){state.events=active;saveState();}}
  function readRoster(){
    if(previewRosterStarted)return;
    previewRosterStarted=true;
    var started=false;
    function consume(db){if(started)return;started=true;db.ref("members_v2").once("value").then(function(snapshot){var raw=snapshot.val()||{},list=[];Object.keys(raw).forEach(function(id){var m=raw[id];if(m&&String(m.name||"").trim()){list.push({id:String(m.id||id),name:String(m.name).trim(),kana:String(m.kana||""),grade:String(m.grade||"未設定")});}});members=list.sort(function(a,b){var ga=GRADES.indexOf(a.grade),gb=GRADES.indexOf(b.grade);if(ga<0)ga=99;if(gb<0)gb=99;return ga-gb||String(a.kana||a.name).localeCompare(String(b.kana||b.name),"ja");});rosterState="名簿から"+members.length+"名を読み込みました";$("roster-status").textContent="✓ "+rosterState+"（読み取り専用）";render();renderSavedEvent();refreshCsvIfOpen();}).catch(function(){rosterState="団員名簿を読み込めませんでした。通信状態をご確認ください";$("roster-status").textContent="⚠ "+rosterState;render();});}
    if(window.FIREBASE_READY&&window.FIREBASE_DB)consume(window.FIREBASE_DB);else if(typeof window.onFirebaseReady==="function")window.onFirebaseReady(consume);else{rosterState="名簿の読み込み機能を利用できません";render();}
    window.setTimeout(function(){if(!started){rosterState="名簿の読み込みに時間がかかっています。画面を更新してください";render();}},10000);
  }
  function loadHolidays(){
    try{var cached=JSON.parse(localStorage.getItem("yoshimi_jp_holidays_cache_v1")||"null");if(cached&&cached.savedAt>Date.now()-7*86400000){holidays=cached.data||{};renderDateOptions();renderResponse(true);}}
    catch(e){}
    fetch("https://holidays-jp.github.io/api/v1/date.json").then(function(r){if(!r.ok)throw new Error("holiday data unavailable");return r.json();}).then(function(data){holidays=data||{};localStorage.setItem("yoshimi_jp_holidays_cache_v1",JSON.stringify({savedAt:Date.now(),data:holidays}));renderDateOptions();renderResponse(true);}).catch(function(){if(!Object.keys(holidays).length){holidays={};renderDateOptions();renderResponse(true);}});
  }
  function isWeekend(iso){return [0,6].includes(fromISO(iso).getDay());}
  function isDefaultDay(iso){
    return isWeekend(iso)?weekendPracticeDates.has(iso):[3,4].includes(fromISO(iso).getDay())||Boolean(holidays[iso]);
  }
  function syncWeekendPractices(events,failed){
    if(failed.includes("全体"))return;
    weekendPracticeDates=new Set(events.filter(function(event){
      return event.label==="全体"&&!wholeTeamActivityTitle(event)&&window.SMCCalendarAttendance.upcomingKind(event)==="practice";
    }).map(function(event){return window.SMCCalendarAttendance.tokyoDate(event.start);}).filter(isWeekend));
  }
  function defaultEvent(iso){
    return {id:"day_"+iso,date:iso,kind:"",title:holidays[iso]||""};
  }
  function getBoardEvents(){
    var start=fromISO(todayISO()),end=fromISO(maxDate()),events=[];
    for(var date=new Date(start);date<=end;date.setDate(date.getDate()+1)){
      var iso=localISO(date);
      var registered=eventForDate(iso);
      var regular=defaultEvent(iso);
      if(isDefaultDay(iso)&&!excludedHolidays.has(iso)&&!manuallyExcluded(regular)&&!state.events.some(function(event){
        return event.date===iso&&!event.calendarInactive&&(event.id===regular.id||event.kind!=="match");
      })){
        if(isWeekend(iso)||registered.length)regular.kind="practice";
        events.push(regular);
      }
      events.push.apply(events,registered.sort(function(a,b){
        return Number(a.kind==="match")-Number(b.kind==="match")||
          (a.startTime||"").localeCompare(b.startTime||"")||a.title.localeCompare(b.title,"ja");
      }));
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
  function manuallyExcluded(event){return eventVisibility.get(event.id)??Boolean(event.hidden);}
  function eventForDate(iso){
    var active=state.events.filter(function(event){return event.date===iso&&!manuallyExcluded(event)&&!event.calendarInactive;});
    if(!isWeekend(iso))return active;
    if(!calendarMatchesChecked)return [];
    if(weekendPracticeDates.has(iso))return active;
    var nonPractice=active.filter(function(event){return event.kind!=="practice";});
    return nonPractice.some(function(event){return event.id.startsWith("calendar_");})?nonPractice:[];
  }
  function renderHolidaySettings(){
    var list=$("holiday-attendance-list"),today=todayISO(),end=maxDate();
    var focused=document.activeElement?.dataset.holidayDate;
    var dates=Object.keys(holidays).filter(function(date){
      return /^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=today&&date<=end;
    }).sort();
    list.innerHTML=dates.length?dates.map(function(date){
      var excluded=excludedHolidays.has(date);
      var name=dateLabel(date)+" "+holidays[date];
      var action=excluded?"出欠表に戻す":"出欠表から外す";
      return '<div class="holiday-attendance-row"><div><strong>'+esc(name)+'</strong>'+
        (excluded?'<small>自動表示を停止中</small>':"")+'</div>'+
        '<button type="button" class="secondary-button" data-holiday-date="'+date+'" aria-label="'+esc(name+"を"+action)+'"'+
        (holidaySettingsReady&&!savingHoliday?"":" disabled")+'>'+action+'</button></div>';
    }).join(""):'<p class="small-note">今後2か月の祝日を表示します。</p>';
    if(focused)list.querySelector('[data-holiday-date="'+focused+'"]')?.focus({preventScroll:true});
  }
  async function toggleHoliday(date){
    if(!holidaySettingsReady||savingHoliday||!holidays[date]||date<todayISO()||date>maxDate())return;
    var exclude=!excludedHolidays.has(date);
    var list=$("holiday-attendance-list"),status=$("holiday-attendance-status");
    savingHoliday=true;
    status.textContent="祝日の設定を保存中です。";
    renderHolidaySettings();
    try{
      await sharedStore.holidays.save(date,exclude);
      status.textContent=dateLabel(date)+(exclude?"の自動表示を出欠表から外しました。":"の自動表示を出欠表に戻しました。");
    }catch(error){
      status.textContent="祝日の設定を保存できませんでした。通信状態を確認して再度お試しください。";
    }finally{
      savingHoliday=false;
      renderHolidaySettings();
      if(document.activeElement===document.body)list.querySelector('[data-holiday-date="'+date+'"]')?.focus({preventScroll:true});
    }
  }
  function renderDateOptions(){
    renderHolidaySettings();
    var list=$("date-options"),start=fromISO(todayISO()),end=fromISO(maxDate()),parts=[];
    for(var date=new Date(start);date<=end;date.setDate(date.getDate()+1)){
      var iso=localISO(date);if(!isDefaultDay(iso))continue;
      var items=eventForDate(iso),holiday=holidays[iso],weekday=date.getDay(),routine=weekday===3?"通常練習":weekday===4?"低学年練習":"";
      var classes="date-option"+(selectedDate===iso?" selected":"")+(items.length?" has-event":"");
      var tags=(holiday?'<span class="date-option-holiday">'+esc(holiday)+"</span>":"")+(excludedHolidays.has(iso)?"<span>自動表示なし</span>":routine?"<span>"+esc(routine)+"</span>":"")+(items.length?'<span class="date-option-added">登録済み '+items.length+"件</span>":"");
      parts.push('<button type="button" class="'+classes+'" data-date="'+iso+'" aria-pressed="'+(selectedDate===iso?"true":"false")+'"><span class="date-option-date">'+(date.getMonth()+1)+"/"+date.getDate()+"（"+DAY_NAMES[weekday]+'）</span><span class="date-option-tags">'+tags+'</span><span class="date-option-select">'+(selectedDate===iso?"選択中":"選ぶ")+"</span></button>");
    }
    list.innerHTML=parts.length?parts.join(""):'<div class="empty-state">今後2か月以内に対象日がありません。</div>';
    list.querySelectorAll("button[data-date]").forEach(function(btn){btn.addEventListener("click",function(){selectedDate=btn.dataset.date;$("selected-date-label").textContent=dateLabel(selectedDate)+(holidays[selectedDate]?" · "+holidays[selectedDate]:"");$("add-event").disabled=false;renderDateOptions();renderResponse();});});
    $("add-event").disabled=!selectedDate||selectedDate<todayISO()||selectedDate>maxDate()||!isDefaultDay(selectedDate);
    $("selected-date-label").textContent=selectedDate?dateLabel(selectedDate)+(holidays[selectedDate]?" · "+holidays[selectedDate]:""):"日程を選んでください";
  }
  function eventListStatus(event,active){
    if(event.calendarInactive)return "カレンダー対象外";
    if(manuallyExcluded(event))return "出欠表から除外中";
    return active?"出欠受付中":"現在は出欠対象外";
  }
  function renderEventList(){
    var board=getBoardEvents(),active=new Set(board.map(function(event){return event.id;}));
    var days=new Map(groupBoardDays(board).map(function(day){return [day.date,day];}));
    var list=$("event-list"),filter=$("event-list-filter").value;
    var events=state.events.filter(function(event){
      return !filter||(filter==="active"?active.has(event.id):filter==="inactive"?event.calendarInactive:manuallyExcluded(event));
    }).sort(function(a,b){return a.date.localeCompare(b.date)||a.title.localeCompare(b.title,"ja");});
    list.innerHTML=events.map(function(event){
      var accepting=active.has(event.id),excluded=manuallyExcluded(event);
      var c=accepting?countAnswers([event],getPeople(),days.get(event.date)):null;
      var totals=c?'<span class="event-count">参加 <b>'+c.attending+'/'+c.eligible+'</b> ・未定 '+c.maybe+
        '<br>未回答 '+(c.eligible-c.attending-c.maybe-c.absent)+'</span>':"";
      return '<article class="event-card"><button class="event-open" type="button" data-open-event="'+esc(event.id)+'"><strong>'+
        esc(event.title)+'</strong><span class="event-meta">'+dateLabel(event.date)+' · '+eventKindLabel(event)+
        (event.place?' · '+esc(event.place):"")+'</span><span class="kind-badge">'+eventListStatus(event,accepting)+'</span>'+
        (excluded&&event.calendarInactive?'<span class="event-meta">手動でも除外中</span>':"")+'</button>'+totals+
        ((accepting||excluded)?'<button type="button" class="secondary-button event-visibility-button" data-toggle-event="'+esc(event.id)+'"'+
          (!visibilityReady||visibilitySaving?" disabled":"")+'>'+(excluded?"出欠表に戻す":"出欠表から外す")+'</button>':"")+'</article>';
    }).join("")||'<div class="empty-state">条件に合う予定はありません。</div>';
    var archive=$("archive-list");
    if(archive)archive.innerHTML=state.archive.slice().sort(function(a,b){return b.date.localeCompare(a.date);}).map(function(event){
      return '<div class="event-card"><button class="event-open" type="button" data-open-event="'+esc(event.id)+'"><strong>'+
        esc(event.title)+'</strong><span class="event-meta">'+dateLabel(event.date)+' · 過去の予定</span></button></div>';
    }).join("")||'<div class="empty-state">この端末で確認できる過去の予定はありません。</div>';
  }

  function renderSavedEvent(){
    if(!viewedEvent)return;
    var event=state.events.find(function(item){return item.id===viewedEvent.id;})||viewedEvent;
    $("saved-event-title").textContent=eventName(event);
    $("saved-event-info").innerHTML='<p>'+esc(dateLabel(event.date))+'</p>'+matchDetailInfo(event);
    var groups=["players","coaches"];
    $("saved-event-answers").innerHTML=groups.map(function(group){
      var people=getPeople(group).filter(function(person){
        return !eligibility(event,person,group)||Boolean(answerValue(event,person,group)||matchContact(event.id,person.id,group));
      });
      return '<h3>'+(group==="players"?"団員":"コーチ")+'</h3>'+matchAttendanceTable(event,people,group);
    }).join("");
  }
  function showSavedEvent(event){
    viewedEvent=event;
    readStaffCoaches();
    renderSavedEvent();
    $("saved-event-dialog").showModal();
  }
  async function setEventExclusion(event,excluded){
    if(!visibilityReady||visibilitySaving)return false;
    visibilitySaving=true;
    renderEventList();
    var status=$("event-visibility-status");
    try{
      await sharedStore.eventVisibility.save(event.id,excluded);
      eventVisibility.set(event.id,excluded);
      undoVisibility={event:event,excluded:!excluded};
      $("event-visibility-undo").hidden=false;
      status.textContent=excluded?"出欠表から外しました。":event.calendarInactive?
        "手動の除外を解除しました。カレンダーでは現在対象外です。":"出欠表に戻しました。";
      return true;
    }catch(error){
      status.textContent="設定を保存できませんでした。通信状態を確認してもう一度お試しください。";
      return false;
    }finally{
      visibilitySaving=false;
      renderDateOptions();renderEventList();renderResponse(true);refreshSharedMatchSummary();refreshCsvIfOpen();
    }
  }
  function handleEventListClick(event){
    var button=event.target.closest("button[data-open-event],button[data-toggle-event]");
    if(!button)return;
    var id=button.dataset.openEvent||button.dataset.toggleEvent;
    var item=state.events.concat(state.archive).find(function(entry){return entry.id===id;});
    if(!item)return;
    if(button.dataset.toggleEvent){setEventExclusion(item,!manuallyExcluded(item));return;}
    if(getBoardEvents().some(function(entry){return entry.id===id;}))openEvent(id);
    else showSavedEvent(item);
  }
  function coachNameKey(name){
    return String(name||"").normalize("NFKC").replace(/\s+/g,"").replace(/コーチ$/,"");
  }

  function namesFromStaff(records){
    var byName=new Map();
    var rows=Array.isArray(records)?records:Object.values(records||{});
    rows.forEach(function(row){
      if(!row||typeof row.name!=="string")return;
      var names=row.name.split(/[、，,\n]/).map(function(name){return name.trim();}).filter(Boolean);
      names.forEach(function(name){
        var key=coachNameKey(name);
        if(!key||/^(?:未定|調整中|担当なし|なし|[-—ー]+)$/.test(key))return;
        var source="staff_"+encodeURIComponent(String(row.id||key));
        if(names.length>1)source+=":"+encodeURIComponent(key);
        var prior=byName.get(key);
        if(!prior||source<prior.source)byName.set(key,{name:name,key:key,source:source});
      });
    });
    return Array.from(byName.values());
  }

  function linkLocalCoachAnswers(){
    var used=new Set(Object.values(state.coachLinks)),changed=false;
    staffCoaches.forEach(function(coach){
      if(state.coachLinks[coach.source])return;
      var local=state.coaches.find(function(person){return !used.has(person.id)&&coachNameKey(person.name)===coach.key;});
      if(!local)return;
      state.coachLinks[coach.source]=local.id;
      used.add(local.id);
      changed=true;
    });
    if(changed)saveState();
  }

  function readStaffCoaches(){
    if(coachRosterStarted)return;
    coachRosterStarted=true;
    if(typeof dbListen!=="function"){
      coachRosterStatus="コーチ担当を読み込めませんでした。";
      renderResponse(true);
      return;
    }
    dbListen("staff/coach",function(records,info){
      if(info?.authoritative){
        staffCoaches=namesFromStaff(records);
        staffCoachesReady=true;
        linkLocalCoachAnswers();
        coachRosterStatus=staffCoaches.length?"コーチ担当から"+staffCoaches.length+"名を表示":"コーチ担当に登録された名前がありません。";
      }else{
        coachRosterStatus="コーチ担当を確認できませんでした。通信状況を確認して、画面を開き直してください。";
      }
      if(audience==="coaches"){renderEventList();renderResponse(true);}
      renderSavedEvent();refreshCsvIfOpen();
    },null,null);
  }

  function getPeople(group){
    if((group||audience)==="players")return members;
    var linked=staffCoaches.map(function(coach){
      return {id:state.coachLinks[coach.source]||coach.source,name:coach.name,fromStaff:true};
    });
    var linkedIds=new Set(linked.map(function(coach){return coach.id;}));
    return linked.concat(state.coaches.filter(function(coach){return !linkedIds.has(coach.id);}));
  }
  function answerMark(value){return value==="attending"?"○":value==="maybe"?"△":value==="absent"?"×":"";}

  var activeDayEntry=null, dayEntryTrigger=null, activeMatchSummary=null, activeMatchDetailId="";

  function groupBoardDays(events){
    var days=new Map();
    events.forEach(function(event){
      if(!days.has(event.date))days.set(event.date,{date:event.date,practice:[],activities:[],matches:[]});
      var day=days.get(event.date);
      (event.kind==="match"?day.matches:event.kind==="activity"?day.activities:day.practice).push(event);
    });
    return Array.from(days.values());
  }

  function dayEvents(day){return day.practice.concat(day.activities,day.matches);}

  function matchContact(eventId,personId,group){
    group=group||audience;
    return state.answers[eventId]?.[group]?.[personId]?.contact??
      (deviceMode&&group==="players"?state.matchNotes[eventId]?.[personId]:undefined);
  }

  function answerValue(event,person,group){
    return state.answers[event.id]?.[group||audience]?.[person.id]?.value||"";
  }

  function targetGrades(event){
    if(event.targetOverride)return event.targetOverride;
    if(Object.hasOwn(event,"targetGrades"))return event.targetGrades;
    return window.SMCCalendarAttendance.targetGrades("",event.title);
  }

  function normalizedGrade(person){
    return String(person.grade||"").normalize("NFKC").trim().replace(/生$/,"");
  }

  function recruitmentDecision(event,person){
    var decisions=recruitmentRows.get(event.id)?.decisions;
    return decisions&&Object.hasOwn(decisions,person.id)?decisions[person.id]:"default";
  }

  function eligibility(event,person,group){
    if((group||audience)!=="players")return "";
    var grade=normalizedGrade(person);
    if(event.kind==="match"){
      var decision=recruitmentDecision(event,person);
      if(decision==="include")return "";
      if(decision==="exclude")return "招集対象外";
      var grades=targetGrades(event);
      if(!grades)return "対象学年未設定";
      return grades.includes(grade)?"":"対象外";
    }
    if(event.kind==="activity"){
      var activityGrades=targetGrades(event);
      return activityGrades&&!activityGrades.includes(grade)?"対象外":"";
    }
    var weekday=fromISO(event.date).getDay();
    if(weekday===3)return GRADES.slice(0,3).includes(grade)?"":"対象外";
    if(weekday===4)return GRADES.slice(3).includes(grade)?"":"対象外";
    return "";
  }

  function responseRestriction(event,person,day,group){
    group=group||audience;
    return eligibility(event,person,group)||
      (group==="players"&&event.kind!=="match"&&event.kind!=="activity"&&day?.matches.some(function(match){return !eligibility(match,person,group);})?"試合優先":"");
  }

  function canAnswer(event,person,day){
    return !responseRestriction(event,person,day);
  }

  function eligiblePeople(event,people,day){
    return people.filter(function(person){return canAnswer(event,person,day);});
  }

  function needsMatchReview(match,person,day){
    return audience==="players"&&!eligibility(match,person)&&!answerValue(match,person)&&
      day.practice.some(function(practice){return !eligibility(practice,person)&&answerValue(practice,person)==="attending";});
  }

  function countAnswers(events,people,day){
    var total={attending:0,maybe:0,absent:0,eligible:0};
    events.forEach(function(event){
      eligiblePeople(event,people,day).forEach(function(person){
        var value=answerValue(event,person);
        total.eligible++;
        if(ANSWERS.some(function(answer){return answer.value===value;}))total[value]++;
      });
    });
    return total;
  }

  function safeCalendarEventUrl(value){
    try{
      var url=new URL(value);
      if(url.protocol!=="https:"||url.username||url.password)return "";
      if(url.hostname==="calendar.google.com"||
         (url.hostname==="www.google.com"&&url.pathname.startsWith("/calendar/")))return url.href;
    }catch(error){}
    return "";
  }

  function compactDate(date){
    var value=fromISO(date);
    return (value.getMonth()+1)+"/"+value.getDate()+"（"+DAY_NAMES[value.getDay()]+"）";
  }

  function compactTotal(total){
    return "○"+total.attending+"/"+total.eligible+" △"+total.maybe+" ×"+total.absent;
  }

  function matchCategoryLabel(matches){
    var counts=new Map();
    matches.forEach(function(event){
      var category=String(event.category||"").trim()||"その他";
      counts.set(category,(counts.get(category)||0)+1);
    });
    return Array.from(counts).sort(function(a,b){
      return Number(a[0]==="その他")-Number(b[0]==="その他")||a[0].localeCompare(b[0],"ja",{numeric:true});
    }).map(function(entry){
      return entry[0]+(entry[1]>1?"（"+entry[1]+"試合）":"");
    }).join("・");
  }

  function matchCountLabel(total){
    return ["対象 "+total.eligible+"名","参加 "+total.attending,"未定 "+total.maybe,
      "不参加 "+total.absent,"未回答 "+(total.eligible-total.attending-total.maybe-total.absent)]
      .map(function(label){return "<span>"+esc(label)+"</span>";}).join(" ");
  }

  function dayHeading(day,people){
    var heading='<span class="board-date">'+esc(compactDate(day.date))+'<span class="day-calendar-icon" aria-hidden="true">▦</span></span>';
    var totals=countAnswers(dayEvents(day),people,day);
    heading+='<span class="event-count-summary">'+compactTotal(totals)+'</span>';
    var label=dateLabel(day.date)+"の予定を開く。"+(dayEvents(day).length>1?"延べ":"")+"対象"+totals.eligible+"、参加"+totals.attending+"、未定"+totals.maybe+"、不参加"+totals.absent;
    var categories=matchCategoryLabel(day.matches);
    var summary=categories?'<button type="button" class="preview-day-summary" data-match-date="'+esc(day.date)+
      '" aria-haspopup="dialog" aria-label="'+esc(compactDate(day.date)+"の試合集計 "+categories)+'">'+esc(categories)+'</button>':
      '<span class="preview-day-summary-space" aria-hidden="true"></span>';
    if(day.activities.length)heading+='<span class="event-count-summary">'+esc(day.activities.map(function(event){return event.title;}).join("・"))+'</span>';
    return calendarLink(day.date,heading,"day-detail-link","",label)+summary;
  }

  function boardPersonName(person){
    return '<button type="button" class="board-member-name" data-edit-person="'+esc(person.id)+'">'+
      (audience==="players"?'<span class="board-member-grade">'+esc(person.grade||"学年未登録")+'</span> ':"")+
      '<span>'+esc(person.name)+'</span></button>';
  }

  function calendarLink(date,content,className,eventId,label){
    var params=new URLSearchParams({date:date});
    if(eventId)params.set("event",eventId);
    return '<a class="'+className+'" href="calendar.html?'+esc(params)+'" target="_blank" rel="noopener"'+
      (label?' aria-label="'+esc(label)+'"':"")+'>'+content+'</a>';
  }

  function matchCalendarAction(match){
    return match.kind==="match"?calendarLink(match.date,"カレンダーで試合詳細を開く","secondary-button day-details-action",match.id):"";
  }

  function dayButton(day,person){
    var practiceEvents=day.practice.filter(function(event){return canAnswer(event,person,day);});
    var activities=day.activities.filter(function(event){return canAnswer(event,person,day);});
    var practice=practiceEvents.map(function(event){return answerValue(event,person);}).filter(Boolean);
    var activityMarks=activities.map(function(event){return answerMark(answerValue(event,person));}).filter(Boolean).join(" ");
    var eligible=day.matches.filter(function(event){return !eligibility(event,person);});
    var answered=eligible.map(function(event){
      return {label:event.category||"試合",value:answerValue(event,person)};
    }).filter(function(answer){return answer.value;});
    var badges=answered.map(function(answer){
      return '<span class="day-match-chip" data-value="'+esc(answer.value)+'">'+
        esc(answerMark(answer.value)+" "+answer.label)+'</span>';
    }).join("");
    var marks=practice.map(answerMark).join(" ");
    var review=eligible.some(function(match){return needsMatchReview(match,person,day);});
    var reviewBadge=review?'<span class="board-review">要確認</span>':"";
    if(!practiceEvents.length&&!activities.length&&!eligible.length){
      var restrictions=day.matches.map(function(event){return eligibility(event,person);});
      var reason=restrictions.includes("招集対象外")?"招集対象外":restrictions.includes("対象学年未設定")?"対象学年未設定":"対象外";
      return '<span class="board-ineligible">'+reason+'</span>';
    }
    var description=(marks?"練習 "+marks:"")+(activityMarks?" 行事 "+activityMarks:"")+(answered.length?" "+answered.map(function(answer){return answer.label+" "+answerMark(answer.value);}).join("、"):"");
    var cycle=deviceMode&&dayEvents(day).length===1&&day.practice.length===1;
    var style=cycle?"board-mark editable":"board-mark editable day-answer";
    return '<button type="button" class="'+style+'" data-answer-date="'+esc(day.date)+'" data-answer-person="'+esc(person.id)+
      '" data-value="'+esc(practice[0]||"")+'" aria-label="'+esc(person.name+" "+dateLabel(day.date)+" "+(review?"要確認。":"")+(description.trim()||"未回答")+(cycle?"。タップで回答を切り替え":"。出欠を入力"))+'">'+
      (dayEvents(day).length===1&&day.practice.length===1?marks:
        (marks?'<span class="day-practice-mark">'+marks+'</span>':"")+
        (activityMarks?'<span class="day-practice-mark">'+activityMarks+'</span>':"")+reviewBadge+badges)+'</button>';
  }

  function focusDayCell(date,personId){
    var button=$("response-list").querySelector('[data-answer-date="'+CSS.escape(date)+'"][data-answer-person="'+CSS.escape(personId)+'"]');
    if(button)button.focus({preventScroll:true});
  }

  function announceSave(message){
    var status=$("answer-status");
    status.textContent=message;
    status.hidden=false;
  }

  function applySharedAnswers(records,key){
    var answers=Object.create(null), notes=Object.create(null);
    records.forEach(function(row,id){
      var event=row.eventId,group=row.group,person=row.personId;
      if(id!==key(event,group,person))return;
      if(event){
        var groups=answers[event]||=Object.create(null);
        var replies=groups[group]||=Object.create(null);
        replies[person]={value:row.value,contact:row.contact,updatedAt:row.updatedAt?.toDate?.().toISOString()||""};
      }else{
        (notes[group]||=Object.create(null))[person]=row.note;
      }
    });
    Object.assign(state,{answers:answers,notes:notes});
  }

  function requireSharedConnection(){
    if(sharedReady)return true;
    $("shared-attendance-status").textContent="出欠クラウドへの接続を確認中です。通信状態を確認して再度お試しください。";
    return false;
  }
  function startSharedAttendance(){
    import("./attendance-open-store.mjs?v=20261122-open1").then(function(module){
      return module.loadOpenAttendance();
    }).then(function(store){
      sharedStore=store;
      store.eventVisibility.listen(function(records){
        eventVisibility=records;
        visibilityReady=true;
        renderDateOptions();renderEventList();renderResponse(true);refreshSharedMatchSummary();refreshCsvIfOpen();
      },function(){
        visibilityReady=false;
        $("event-visibility-status").textContent="予定の受付設定に接続できません。";
        renderEventList();
      });
      store.holidays.listen(function(excluded){
        excludedHolidays=excluded;
        holidaySettingsReady=true;
        $("holiday-attendance-status").textContent="";
        renderDateOptions();renderResponse(true);
      },function(message){
        holidaySettingsReady=false;
        $("holiday-attendance-status").textContent="祝日設定に接続できません。";
        renderHolidaySettings();
      });
      store.recruitment.listen(function(records){
        recruitmentRows=records;
        recruitmentReady=true;
        renderEventList();renderResponse(true);
        refreshSharedMatchSummary();refreshCsvIfOpen();
      },function(){recruitmentReady=false;refreshSharedMatchSummary();});
      store.listen(function(records){
        sharedRows=records;
        sharedReady=true;
        applySharedAnswers(records,store.key);
        renderSavedEvent();refreshCsvIfOpen();
        $("shared-attendance-status").textContent="出欠を共有しています。名前をタップして入力できます。";
        renderEventList();renderResponse(true);refreshSharedMatchSummary();
      },function(message){
        sharedReady=false;
        $("shared-attendance-status").textContent="出欠クラウドに接続できません。Firebaseの保存先のアクセス設定・通信を確認してください。";
        renderResponse(true);
      });
    }).catch(function(){
      sharedReady=false;
      $("shared-attendance-status").textContent="出欠クラウドを開始できません。通信またはFirebase設定を確認してください。";
      $("holiday-attendance-status").textContent="祝日設定に接続できません。";
      renderResponse(true);
    });
  }

  async function submitEntry(personId,updates,note,form){
    if(deviceMode)return saveDayAnswers(personId,updates,note);
    var status=form.querySelector("[data-entry-status]");
    if(savingShared)return false;
    if(!sharedReady){
      status.textContent="クラウドに接続してから、もう一度保存してください。";
      return false;
    }
    savingShared=true;
    var buttons=Array.from(form.querySelectorAll("button, select")).filter(function(button){return !button.disabled;});
    buttons.forEach(function(button){button.disabled=true;});
    status.textContent="クラウドに保存中…";
    try{
      await sharedStore.save(audience,personId,updates,note,entryBaseline);
      status.textContent="";
      return true;
    }catch(error){
      status.textContent=error.message==="shared-attendance-conflict"
        ?"別の端末で回答が更新されました。入力内容を控え、画面を開き直して最新の回答を確認してください。"
        :"保存できませんでした。通信状態を確認して、もう一度保存してください。";
      return false;
    }finally{
      savingShared=false;
      buttons.forEach(function(button){button.disabled=false;});
    }
  }

  function saveDayAnswers(personId,updates,note){
    if(!deviceMode)return false;
    var timestamp=new Date().toISOString();
    var before=state.answers;
    var beforeNotes=state.notes;
    var answers={...before};
    updates.forEach(function(update){
      var groups={...answers[update.id]};
      var replies={...groups[audience]};
      var previous=replies[personId]||{};
      if(update.contact===undefined&&(previous.value||"")===update.value)return;
      var contact=update.contact===undefined?previous.contact: (update.contact||{});
      if(update.value||contact)replies[personId]={value:update.value,contact:contact,updatedAt:timestamp};
      else delete replies[personId];
      answers[update.id]={...groups,[audience]:replies};
    });
    state.answers=answers;
    if(note!==undefined){
      var notes={...beforeNotes[audience]};
      if(note)notes[personId]=note;
      else delete notes[personId];
      state.notes={...beforeNotes,[audience]:notes};
    }
    if(!saveState()){state.answers=before;state.notes=beforeNotes;return false;}
    return true;
  }

  function eventKindLabel(event){
    return event.kind==="match"?"試合":event.kind==="activity"?"行事":"練習";
  }

  function eventName(event){
    var kind=event.kind==="match"&&event.category?event.category+" 試合":eventKindLabel(event);
    return [kind,event.startTime,event.title].filter(Boolean).join(" · ");
  }

  function openDayEntry(day,person,trigger){
    entryBaseline=sharedRows;
    $("day-entry-form").querySelector("[data-entry-status]").textContent="";
    activeDayEntry={day:day,person:person};
    dayEntryTrigger=trigger;
    $("day-entry-title").innerHTML=calendarLink(day.date,esc(dateLabel(day.date)),"entry-date-link")+"の出欠";
    $("day-entry-person").textContent=person.name;
    $("day-entry-events").innerHTML=renderEntryDay(day,person,false);
    $("day-entry-dialog").showModal();
    $("day-entry-events").parentElement.scrollTop=0;
  }

  function renderEntryDay(day,person,showDate){
    var events=dayEvents(day).filter(function(event){return canAnswer(event,person,day);});
    if(!events.length)return "";
    return '<section class="entry-day">'+
      (showDate?'<h3>'+calendarLink(day.date,esc(dateLabel(day.date)),"entry-date-link")+'</h3>':"")+
      events.map(function(event){
        var match=event.kind==="match",current=answerValue(event,person);
        var title=event.title||eventKindLabel(event);
        var review=match&&needsMatchReview(event,person,day);
        var choices=ANSWERS.concat({value:"",label:"未回答"});
        return '<article class="response-entry-card '+(match?"is-match":"")+'"'+(review?' data-needs-review="true"':"")+'>'+
          '<div class="entry-card-heading"><span class="entry-kind">'+eventKindLabel(event)+'</span><h4>'+esc(title)+'</h4></div>'+
          (event.startTime||event.descriptionTime||event.place?'<p class="entry-card-meta">'+esc([event.startTime||event.descriptionTime,event.place].filter(Boolean).join(" ・ "))+'</p>':"")+
          (review?'<p class="entry-review"><strong>要確認</strong> 練習に○で回答済みです。試合の出欠を入力してください。</p>':"")+
          '<div class="entry-answer-options" role="group" aria-label="'+esc(title+"の出欠")+'">'+choices.map(function(option){
            return '<label><input type="radio" name="answer-'+esc(event.id)+'" value="'+esc(option.value)+'"'+
              (option.value===current?" checked":"")+'><span><b>'+answerMark(option.value)+'</b>'+option.label+'</span></label>';
          }).join("")+'</div>'+
          (match?contactEditor(event,person):"")+
          (event.kind==="activity"?calendarLink(event.date,"カレンダーで行事詳細を開く","secondary-button day-details-action",event.id):matchCalendarAction(event))+'</article>';
      }).join("")+'</section>';
  }

  function contactEditor(event,person){
    var note=matchContact(event.id,person.id)||{};
    var suffix=esc(event.id);
    var choices=[
      {key:"ride",label:"送迎希望",detail:'<label>送迎の区間<select name="rideTrip-'+suffix+'"><option value="">選択（任意）</option>'+
        TRIPS.map(function(trip){return '<option'+(note.rideTrip===trip?" selected":"")+'>'+esc(trip)+'</option>';}).join("")+'</select></label>'},
      {key:"early",label:"早退",detail:'<label>早退の予定時刻（任意）<input type="time" name="earlyTime-'+suffix+'" value="'+esc(note.earlyTime||"")+'"></label>'},
      {key:"late",label:"遅刻・途中参加",detail:'<label>到着の予定時刻（任意）<input type="time" name="lateTime-'+suffix+'" value="'+esc(note.lateTime||"")+'"></label>'},
      {key:"other",label:"その他",detail:""}
    ];
    return '<details class="match-contact"><summary>連絡事項 <span>'+(Object.keys(note).length?"入力済み":"任意")+'</span></summary>'+
      '<input type="hidden" name="contact-'+suffix+'" value="1">'+
      choices.map(function(choice){
        return '<div class="contact-option"><label><input type="checkbox" name="'+choice.key+'-'+suffix+'"'+
          (note[choice.key]?" checked":"")+'>'+choice.label+'</label>'+
          (choice.detail?'<div class="contact-detail">'+choice.detail+'</div>':"")+'</div>';
      }).join("")+
      '<label class="contact-text">補足（任意）<textarea name="message-'+suffix+'" maxlength="160" rows="2" placeholder="例：会場を14時ごろ出発します">'+esc(note.message||"")+'</textarea></label>'+
      '<small class="contact-help">'+(deviceMode?"連絡事項はこの端末に保存します。":"入力した連絡事項はテスト用リンクを開いた人が閲覧できます。")+'</small></details>';
  }

  function readMatchContact(form,id){
    if(!form.has("contact-"+id))return undefined;
    var contact={};
    ["ride","early","late","other"].forEach(function(key){if(form.has(key+"-"+id))contact[key]=true;});
    var trip=form.get("rideTrip-"+id);
    if(contact.ride&&TRIPS.includes(trip))contact.rideTrip=trip;
    ["early","late"].forEach(function(key){
      var time=form.get(key+"Time-"+id);
      if(contact[key]&&/^([01]\d|2[0-3]):[0-5]\d$/.test(time))contact[key+"Time"]=time;
    });
    var message=String(form.get("message-"+id)||"").trim().slice(0,160);
    if(message)contact.message=message;
    return Object.keys(contact).length?contact:null;
  }

  function readEntryUpdates(form,person,days){
    return days.flatMap(function(day){
      return dayEvents(day).filter(function(item){
        return form.has("answer-"+item.id)&&canAnswer(item,person,day);
      }).map(function(item){
        return {id:item.id,value:form.get("answer-"+item.id),contact:readMatchContact(form,item.id)};
      });
    });
  }

  function reportEntrySaved(updates){
    if(!deviceMode){announceSave("クラウドに保存しました。別の端末でも確認できます。");return;}
    var message=updates.some(function(update){return update.contact;})
      ?"この端末に保存しました。コーチには送信されていません。":"回答をこの端末に保存しました。";
    var status=$("answer-status");
    status.textContent=message;
    status.hidden=false;
  }

  function refreshSharedMatchSummary(){
    if(!$("match-summary-dialog").open||!activeMatchSummary)return;
    var summary=activeMatchSummary;
    var current=getBoardEvents().filter(function(event){return event.kind==="match";});
    if(activeMatchDetailId&&!current.some(function(event){return event.id===activeMatchDetailId;})){
      if($("match-detail-dialog").open)$("match-detail-dialog").close();
    }
    if(!current.length){$("match-summary-dialog").close();return;}
    var matches=current.filter(function(event){return event.date===summary.day.date;});
    if(matches.length!==summary.day.matches.length||matches.some(function(event,index){return event.id!==summary.day.matches[index].id;})){
      openMatchSummary(summary.day.date);return;
    }
    $("match-summary-list").querySelectorAll("[data-target-event]").forEach(function(section){
      var event=summary.day.matches.find(function(match){return match.id===section.dataset.targetEvent;});
      if(!event)return;
      section.querySelector(".preview-match-count").innerHTML=matchCountLabel(countAnswers([event],summary.people));
      section.querySelector(".match-target-note").textContent=matchTargetLabel(event);
      var edit=section.querySelector("[data-recruit-event]");
      if(edit)edit.disabled=!recruitmentReady||!members.length;
    });
    refreshMatchDetail();
  }

  function matchTargetLabel(event){
    var grades=targetGrades(event);
    var players=members.filter(function(person){return !eligibility(event,person,"players");}).length;
    var individual=members.filter(function(person){return recruitmentDecision(event,person)==="include";}).length;
    return (grades?"対象学年 "+grades.join("・"):"対象学年未設定")+"／団員 "+players+"名"+
      (individual?"（個別招集 "+individual+"名）":"");
  }

  function normalizeRecruitmentSearch(value){
    return String(value||"").normalize("NFKC").toLowerCase().replace(/\s+/g,"")
      .replace(/[ァ-ヶ]/g,function(character){return String.fromCharCode(character.charCodeAt(0)-96);});
  }

  function filterRecruitment(){
    var query=normalizeRecruitmentSearch($("recruitment-search").value),shown=0;
    $("recruitment-members").querySelectorAll("[data-search]").forEach(function(row){
      row.hidden=!row.dataset.search.includes(query);
      if(!row.hidden)shown++;
    });
    $("recruitment-clear").hidden=!$("recruitment-search").value;
    $("recruitment-result-count").textContent=shown?(query?"該当 "+shown+"名":"全 "+shown+"名"):"一致する選手がいません";
    $("recruitment-results").scrollTop=0;
  }

  function openRecruitment(event){
    if(!recruitmentReady)return;
    var record=recruitmentRows.get(event.id);
    var grades=targetGrades(event)||[];
    recruitmentEdit={event:event,revision:record?.revision||0,initial:new Map(),draft:new Map()};
    $("recruitment-event").textContent=dateLabel(event.date)+" "+eventName(event);
    $("recruitment-search").value="";
    $("recruitment-save-status").textContent="";
    $("recruitment-members").innerHTML=members.map(function(person){
      var decision=recruitmentDecision(event,person);
      var base=grades.includes(normalizedGrade(person));
      var answer=answerValue(event,person,"players");
      var hasRecord=Boolean(answer||matchComment(matchContact(event.id,person.id,"players")));
      recruitmentEdit.initial.set(person.id,decision);
      var alternate=base?"exclude":"include";
      var options=[["default",base?"対象済み":"対象外"],[alternate,base?"招集しない":"個別招集"]];
      if(decision!=="default"&&decision!==alternate)options.push([decision,decision==="include"?"個別招集":"招集しない"]);
      return '<label class="recruitment-member" data-recruit-person="'+esc(person.id)+'" data-search="'+
        esc(normalizeRecruitmentSearch([person.grade,person.name,person.kana].join(" ")))+'"><span>'+
        esc(person.grade+" "+person.name)+(hasRecord?"<small>回答・連絡あり</small>":"")+'</span>'+
        '<select aria-label="'+esc(person.name+"の招集区分")+'">'+options.map(function(option){
          return '<option value="'+option[0]+'"'+(decision===option[0]?" selected":"")+'>'+option[1]+'</option>';
        }).join("")+'</select></label>';
    }).join("");
    updateRecruitmentCount();
    $("recruitment-dialog").showModal();
    fitRecruitmentViewport();
    filterRecruitment();
  }

  function fitRecruitmentViewport(){
    var dialog=$("recruitment-dialog"),viewport=window.visualViewport;
    if(!viewport||!dialog.open)return;
    if(viewport.scale===1&&viewport.height<window.innerHeight-24){
      dialog.style.setProperty("--recruitment-visible-top",Math.max(0,viewport.offsetTop)+6+"px");
      dialog.style.setProperty("--recruitment-visible-height",Math.max(0,viewport.height-12)+"px");
      dialog.classList.add("recruitment-keyboard-open");
    }else{
      dialog.classList.remove("recruitment-keyboard-open");
    }
  }

  function updateRecruitmentCount(){
    var edit=recruitmentEdit;
    var grades=targetGrades(edit.event)||[];
    function total(decisions){
      return members.filter(function(person){
        var decision=decisions.get(person.id);
        return decision==="include"||(decision!=="exclude"&&grades.includes(normalizedGrade(person)));
      }).length;
    }
    $("recruitment-count").textContent="対象 "+total(edit.initial)+"名 → "+total(new Map([...edit.initial,...edit.draft]))+"名";
    $("recruitment-save").disabled=!edit.draft.size||savingRecruitment;
  }

  async function saveRecruitment(event){
    event.preventDefault();
    var edit=recruitmentEdit;
    if(!edit||!edit.draft.size||savingRecruitment)return;
    if(!recruitmentReady){
      $("recruitment-save-status").textContent="クラウドへの接続を確認してください。";
      return;
    }
    var grades=targetGrades(edit.event)||[];
    var recordedRemoval=members.some(function(person){
      if(!edit.draft.has(person.id))return false;
      var next=edit.draft.get(person.id);
      return (next==="exclude"||(next==="default"&&!grades.includes(normalizedGrade(person))))&&
        (answerValue(edit.event,person,"players")||matchComment(matchContact(edit.event.id,person.id,"players")));
    });
    if(recordedRemoval&&!confirm("対象から外す団員に回答または連絡事項があります。記録は保存したまま、集計から外しますか？"))return;
    savingRecruitment=true;
    $("recruitment-close").disabled=true;
    updateRecruitmentCount();
    $("recruitment-save-status").textContent="保存中…";
    try{
      var saved=await sharedStore.recruitment.save(edit.event.id,edit.draft,edit.revision);
      if((recruitmentRows.get(edit.event.id)?.revision||0)<saved.revision)recruitmentRows.set(edit.event.id,saved);
      $("recruitment-dialog").close();
      renderEventList();
      renderResponse(true);
      openMatchSummary(edit.event.date);
    }catch(error){
      $("recruitment-save-status").textContent=error.message==="recruitment-conflict"?
        "別のコーチが更新しました。閉じて最新の招集を確認してください。":"招集を保存できませんでした。通信状態と編集権限をご確認ください。";
    }finally{
      savingRecruitment=false;
      $("recruitment-close").disabled=false;
      updateRecruitmentCount();
    }
  }

  function openMatchSummary(date){
    var days=groupBoardDays(getBoardEvents()).filter(function(day){return day.matches.length;});
    var day=days.find(function(item){return item.date===date;})||days[0];
    if(!day)return;
    var people=getPeople();
    activeMatchSummary={day:day,people:people};
    var select=$("match-summary-date");
    select.innerHTML=days.map(function(item){
      return '<option value="'+esc(item.date)+'">'+esc(compactDate(item.date))+' · '+item.matches.length+'試合</option>';
    }).join("");
    select.value=day.date;
    $("match-summary-list").innerHTML=day.matches.map(function(event){
      var grades=targetGrades(event);
      return '<section class="match-summary-event" data-target-event="'+esc(event.id)+'"><h3>'+esc(eventName(event))+'</h3>'+
        '<div class="preview-match-count">'+matchCountLabel(countAnswers([event],people))+'</div>'+
        '<div class="match-target-note">'+esc(matchTargetLabel(event))+'</div>'+
        '<button type="button" class="secondary-button day-details-action" data-match-detail="'+esc(event.id)+'">試合詳細・出欠一覧</button> '+(!deviceMode?
          '<button type="button" class="secondary-button day-details-action" data-recruit-event="'+esc(event.id)+'"'+
          (recruitmentReady&&members.length?"":" disabled")+'>招集選手を編集</button>':"")+(audience==="coaches"?targetGradeEditor(event,grades):"")+'</section>';
    }).join("");
    var dialog=$("match-summary-dialog");
    if(!dialog.open){
      dialog.showModal();
      $("match-summary-list").parentElement.scrollTop=0;
    }
  }

  function matchDetailInfo(event){
    var time=[event.startTime,event.endTime].filter(Boolean).join("〜")||event.descriptionTime;
    var place=String(event.place||"").trim();
    var description=window.SMCCalendarAttendance.descriptionLinks(event.description).map(function(part){
      return part.href?'<a href="'+esc(part.href)+'" target="_blank" rel="noopener noreferrer">'+esc(part.text)+'</a>':esc(part.text);
    }).join("");
    var map="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(place);
    return (time||place?'<dl class="match-detail-fields">'+
      (time?'<dt>時間</dt><dd>'+esc(time)+'</dd>':"")+
      (place?'<dt>会場</dt><dd><a href="'+esc(map)+'" target="_blank" rel="noopener noreferrer">'+esc(place)+'</a></dd>':"")+
      '</dl>':"")+
      (description?'<div class="match-detail-description">'+description+'</div>':"")+
      (!time&&!place&&!description?'<p>追加の予定情報は登録されていません。</p>':"");
  }

  function refreshMatchDetail(){
    if(!activeMatchDetailId||!activeMatchSummary)return;
    var event=state.events.find(function(item){return item.id===activeMatchDetailId;})||
      activeMatchSummary.day.matches.find(function(item){return item.id===activeMatchDetailId;});
    if(!event)return;
    $("match-detail-title").textContent=eventName(event);
    $("match-detail-date").textContent=dateLabel(event.date);
    $("match-detail-info").innerHTML=matchDetailInfo(event);
    var players=members.filter(function(person){return !eligibility(event,person,"players");});
    $("match-detail-attendance").innerHTML=
      (audience==="coaches"?'<h3>コーチの出欠</h3>'+matchAttendanceTable(event,eligiblePeople(event,getPeople()),"coaches")+
        '<h3>団員の出欠一覧</h3>':"")+
      (players.length?matchAttendanceTable(event,players,"players"):"<p>対象の団員がいません。</p>");
  }

  function showMatchDetailTab(selected){
    $("match-detail-tabs").querySelectorAll('[role="tab"]').forEach(function(tab){
      var active=tab===selected;
      tab.setAttribute("aria-selected",String(active));
      tab.tabIndex=active?0:-1;
      $(tab.getAttribute("aria-controls")).hidden=!active;
    });
    $("match-detail-scroll").scrollTop=0;
  }

  function openMatchDetail(event){
    activeMatchDetailId=event.id;
    refreshMatchDetail();
    showMatchDetailTab($("match-detail-info-tab"));
    $("match-detail-dialog").showModal();
    $("match-detail-scroll").scrollTop=0;
  }

  function matchAttendanceTable(event,people,group){
    var answers=ANSWERS.concat({value:"",label:"未回答"});
    var totals=answers.map(function(answer){
      var count=people.filter(function(person){return answerValue(event,person,group)===answer.value;}).length;
      return '<tr class="match-attendance-total"><th scope="row">'+esc((answerMark(answer.value)+" "+answer.label).trim())+
        '</th><td>'+count+'人</td><td></td></tr>';
    }).join("");
    var rows=people.map(function(person){
      var value=answerValue(event,person,group);
      var label=answers.find(function(answer){return answer.value===value;})?.label||"未回答";
      var grade=group==="players"&&person.grade?'<span class="match-attendance-grade">'+esc(person.grade)+'</span>':"";
      var invite=group==="players"&&recruitmentDecision(event,person)==="include"?'<span class="recruitment-badge">個別招集</span>':"";
      return '<tr><th scope="row" class="match-attendance-name">'+grade+(grade?" ":"")+esc(person.name)+invite+
        '</th><td data-value="'+esc(value)+'" aria-label="'+esc(label)+'">'+esc(answerMark(value)?answerMark(value)+" "+label:label)+'</td>'+
        '<td>'+esc(matchComment(matchContact(event.id,person.id,group))||"—")+'</td></tr>';
    }).join("");
    return '<div class="match-attendance-wrap"><table class="match-attendance-table has-comments"><thead><tr><th scope="col">参加者</th>'+
      '<th scope="col" aria-label="出欠 '+esc(dateLabel(event.date))+'">出欠</th>'+
      '<th scope="col">コメント・連絡事項</th></tr></thead><tbody>'+totals+'</tbody><tbody>'+rows+'</tbody></table></div>';
  }

  function matchComment(note){
    return matchContactLabels(note).concat(note?.message||"").filter(Boolean).join("・");
  }

  function matchContactLabels(note){
    if(!note)return [];
    return [
      note.ride&&("送迎希望"+(note.rideTrip?"（"+note.rideTrip+"）":"")),
      note.early&&("早退"+(note.earlyTime?"（"+note.earlyTime+"）":"")),
      note.late&&("遅刻・途中参加"+(note.lateTime?"（"+note.lateTime+"）":"")),
      note.other&&"その他"
    ].filter(Boolean);
  }

  function targetGradeEditor(event,grades){
    var fields=GRADES.map(function(grade){
      return '<label><input type="checkbox" value="'+esc(grade)+'"'+(grades?.includes(grade)?" checked":"")+'>'+esc(grade)+'</label>';
    }).join("");
    return '<details class="match-target-editor"><summary>団員の対象学年を変更</summary>'+
      '<div class="match-target-fields">'+fields+'</div><div class="match-target-buttons">'+
      '<button type="button" class="secondary-button" data-target-action="save">対象学年を保存</button>'+
      (event.targetOverride?'<button type="button" class="secondary-button" data-target-action="auto">自動判定に戻す</button>':"")+
      '</div></details>';
  }

  function renderResponse(preserveScroll){
    var panel=$("response-panel"),rows=$("response-list"),oldBoard=rows.querySelector(".attendance-board-scroll");
    var savedTop=preserveScroll&&oldBoard?oldBoard.scrollTop:0,savedLeft=preserveScroll&&oldBoard?oldBoard.scrollLeft:0;
    var people=getPeople(),days=groupBoardDays(getBoardEvents());
    $("board-toolbar").hidden=true;
    panel.hidden=false;
    $("response-title").textContent="参加予定【"+(audience==="players"?"団員用":"コーチ用")+"】";
    $("response-summary").textContent=deviceMode?"この端末の試作回答を表示しています。":
      "試合・練習の出欠とコメントをクラウドで共有します。";
    // Do not silently disable the input button when a session link is missing.
    // Clicking it explains how to reconnect without overwriting old answers.
    $("entry-mode-button").disabled=!getPeople().length||!sharedReady;
    $("entry-mode-icon").disabled=$("entry-mode-button").disabled;
    $("coach-roster-status").textContent=coachRosterStatus;
    $("coach-roster-status").hidden=audience!=="coaches";
    $("coach-editor").hidden=!deviceMode||audience!=="coaches";
    var filters=$("grade-filters");
    filters.hidden=audience!=="players";
    if(audience==="players"){
      var counts=new Map();
      people.forEach(function(person){counts.set(person.grade,(counts.get(person.grade)||0)+1);});
      var grades=["すべて"].concat(GRADES.filter(function(grade){return counts.has(grade);}));
      var filterMarkup=grades.map(function(grade){
        var active=selectedGrade===grade;
        return '<button type="button" class="filter-chip'+(active?" active":"")+'" data-grade="'+esc(grade)+
          '" aria-pressed="'+active+'">'+esc(grade)+'（'+(grade==="すべて"?people.length:counts.get(grade))+'）</button>';
      }).join("");
      if(filters.innerHTML!==filterMarkup){
        var scroll=filters.scrollLeft;
        filters.innerHTML=filterMarkup;
        filters.scrollLeft=scroll;
      }
      if(selectedGrade!=="すべて")people=people.filter(function(person){return person.grade===selectedGrade;});
    }
    $("respondent-count").textContent=people.length+"名";
    if(!deviceMode&&!sharedReady&&people.length){
      $("entry-mode-help").textContent="クラウドの接続を確認中です。";
    }

    $("entry-mode-button").textContent=deviceMode?"試作回答を入力する":"出欠を入力する";
    $("entry-mode-help").textContent=deviceMode?"この端末に保存します。":"クラウドに回答を保存します。";
    if(!people.length){
      rows.innerHTML='<div class="empty-state">'+(audience==="players"?esc(rosterState)+"。":esc(coachRosterStatus))+"</div>";
      return;
    }
    if(!days.length){rows.innerHTML='<div class="empty-state">表示できる日程がありません。</div>';return;}

    $("open-match-summary").hidden=!days.some(function(day){return day.matches.length;});
    var head,body;
    if(transposeBoard){
      head='<thead><tr><th class="event-col" scope="col">日付</th>'+people.map(function(person){
        return '<th class="rotated-person" scope="col">'+boardPersonName(person)+'</th>';
      }).join("")+'</tr></thead><tbody>';
      body=days.map(function(day){
        return '<tr><th class="event-col" scope="row" data-board-date="'+esc(day.date)+'">'+dayHeading(day,people)+'</th>'+
          people.map(function(person){return '<td>'+dayButton(day,person)+'</td>';}).join("")+'</tr>';
      }).join("");
    }else{
      head='<thead><tr><th class="person-col" scope="col">参加者</th>'+days.map(function(day){
        return '<th scope="col" data-board-date="'+esc(day.date)+'">'+dayHeading(day,people)+'</th>';
      }).join("")+'</tr></thead><tbody>';
      body=people.map(function(person){
        var note=state.notes[audience]?.[person.id]||"";
        return '<tr><th class="person-col" scope="row">'+boardPersonName(person)+
          (note?'<span class="board-comment" title="'+esc(note)+'">'+esc(note)+'</span>':"")+'</th>'+
          days.map(function(day){return '<td>'+dayButton(day,person)+'</td>';}).join("")+'</tr>';
      }).join("");
    }
    $("board-toolbar").hidden=false;
    $("board-status").textContent=transposeBoard?"日付が縦":"名前が縦";
    $("transpose-board").setAttribute("aria-pressed",String(transposeBoard));
    rows.innerHTML='<div class="attendance-board-scroll" role="region" aria-label="出欠一覧、上下左右にスクロール" tabindex="0"><table class="attendance-board'+(transposeBoard?" is-transposed":"")+'">'+head+body+'</tbody></table></div>';
    var newBoard=rows.querySelector(".attendance-board-scroll");
    if(preserveScroll){newBoard.scrollTop=savedTop;newBoard.scrollLeft=savedLeft;}
    var daysByDate=new Map(days.map(function(day){return [day.date,day];}));
    var peopleById=new Map(people.map(function(person){return [person.id,person];}));
    rows.querySelectorAll("[data-edit-person]").forEach(function(btn){
      btn.addEventListener("click",function(){
        if(requireSharedConnection())openAttendanceForm(btn.dataset.editPerson);
      });
    });
    rows.querySelectorAll("[data-answer-date]").forEach(function(btn){
      btn.addEventListener("click",function(){
        var day=daysByDate.get(btn.dataset.answerDate),person=peopleById.get(btn.dataset.answerPerson);
        if(!deviceMode){if(requireSharedConnection())openDayEntry(day,person,btn);return;}
        if(dayEvents(day).length!==1||day.practice.length!==1){openDayEntry(day,person,btn);return;}
        var event=day.practice[0];
        var next={attending:"maybe",maybe:"absent",absent:"","":"attending"}[answerValue(event,person)];
        if(!saveDayAnswers(person.id,[{id:event.id,value:next}]))return;
        renderEventList();renderResponse(true);
        $("answer-status").textContent="回答を保存しました。"+(answerMark(next)||"未回答");
        focusDayCell(day.date,person.id);
      });
    });
    rows.querySelectorAll("[data-match-date]").forEach(function(btn){
      btn.addEventListener("click",function(){openMatchSummary(btn.dataset.matchDate);});
    });
    rows.querySelectorAll("[data-edit-coach]").forEach(function(btn){btn.addEventListener("click",function(){var coach=state.coaches.find(function(c){return c.id===btn.dataset.editCoach;});if(!coach)return;var name=prompt("コーチ名を入力してください",coach.name);if(name!==null&&name.trim()){coach.name=name.trim();saveState();render();}});});rows.querySelectorAll("[data-remove-coach]").forEach(function(btn){btn.addEventListener("click",function(){var coach=state.coaches.find(function(c){return c.id===btn.dataset.removeCoach;});if(coach&&confirm(coach.name+"さんを試作リストから削除しますか？")){state.coaches=state.coaches.filter(function(c){return c.id!==coach.id;});saveState();render();}});});
  }

  function openAttendanceForm(personId){
    var people=getPeople(),select=$("entry-person");
    select.innerHTML='<option value="">名前を選択してください</option>'+people.map(function(person){
      var label=(audience==="players"?(person.grade||"学年未登録")+" · ":"")+person.name;
      return '<option value="'+esc(person.id)+'">'+esc(label)+'</option>';
    }).join("");
    select.value=personId||"";
    renderAttendanceFormEvents();
    $("attendance-dialog").showModal();
    $("attendance-form-events").parentElement.scrollTop=0;
  }

  function renderAttendanceFormEvents(){
    var root=$("attendance-form-events");
    entryBaseline=sharedRows;
    $("attendance-form").querySelector("[data-entry-status]").textContent="";
    var person=getPeople().find(function(item){return item.id===$("entry-person").value;});
    $("save-attendance").disabled=!person;
    $("entry-general-note").hidden=!person;
    $("entry-comment").value=person?(state.notes[audience]?.[person.id]||""):"";
    if(!person){root.replaceChildren();return;}
    var days=groupBoardDays(getBoardEvents());
    var needsReview=days.some(function(day){
      return day.matches.some(function(match){return needsMatchReview(match,person,day);});
    });
    root.innerHTML=(needsReview?'<button type="button" class="entry-review-jump" id="jump-entry-review">要確認の試合へ移動 ↓</button>':"")+
      days.map(function(day){return renderEntryDay(day,person,true);}).join("");
  }

  async function saveAttendanceForm(event){
    event.preventDefault();
    var person=getPeople().find(function(item){return item.id===$("entry-person").value;});
    if(!person){alert("入力する人を選び直してください。");return;}
    var form=new FormData(event.currentTarget);
    var updates=readEntryUpdates(form,person,groupBoardDays(getBoardEvents()));
    var note=$("entry-comment").value.trim().slice(0,80);
    if(!await submitEntry(person.id,updates,note,event.currentTarget))return;
    $("attendance-dialog").close();
    renderEventList();renderResponse(true);
    reportEntrySaved(updates);
  }

  function openEvent(id){
    selectedEventId=id;
    var event=getBoardEvents().find(function(item){return item.id===id;});
    render();
    var column=event&&document.querySelector('[data-board-date="'+CSS.escape(event.date)+'"]');
    if(column)column.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
    else $("response-panel").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function render(){renderDateOptions();renderEventList();renderResponse();}
  function addEvent(){if(!selectedDate||!isDefaultDay(selectedDate)){alert("一覧に表示されている対象日を選んでください。");return;}$("dialog-date").textContent=dateLabel(selectedDate)+(holidays[selectedDate]?" · "+holidays[selectedDate]:"");$("event-title").value=fromISO(selectedDate).getDay()===3?"通常練習":fromISO(selectedDate).getDay()===4?"低学年練習":"";$("event-place").value="";$("event-dialog").showModal();}
  function csvEvents(){
    var active=getBoardEvents(),activeIds=new Set(active.map(function(event){return event.id;}));
    var known=new Map(state.archive.concat(pastDefaultEvents(),state.events,active).map(function(event){return [event.id,event];}));
    return Array.from(known.values()).sort(function(a,b){
      return a.date.localeCompare(b.date)||(a.title||"").localeCompare(b.title||"","ja");
    }).map(function(event){
      var status=event.calendarInactive?"inactive":manuallyExcluded(event)?"excluded":activeIds.has(event.id)?"active":
        event.date<todayISO()?"past":"other";
      return {...event,kind:event.kind||"practice",title:event.title||eventKindLabel(event),kindLabel:eventKindLabel(event),
        status:status,statusLabel:status==="past"?"過去の予定":eventListStatus(event,status==="active")};
    });
  }
  async function openCsv(){
    var form=$("csv-form");
    form.reset();
    form.elements.namedItem("group").value=audience;
    form.elements.namedItem("grade").value=audience==="players"&&selectedGrade!=="すべて"?selectedGrade:"";
    $("csv-dialog").showModal();
    refreshCsv();
    try{
      csvModule=await import("./attendance-preview-csv.mjs?v=20261122-16");
      refreshCsvIfOpen();
    }catch(error){
      $("csv-status").textContent="CSVの画面を読み込めませんでした。ページを開き直してください。";
    }
  }
  function refreshCsvIfOpen(){
    if($("csv-dialog")?.open)refreshCsv();
  }
  function refreshCsv(){
    var form=$("csv-form"),fields=form.elements,status=$("csv-status"),button=$("csv-download");
    var field=function(name){return fields.namedItem(name);};
    var format=field("format").value,period=field("period").value,group=field("group").value;
    var includesCoaches=group!=="players",events=csvEvents();
    form.querySelectorAll("[data-csv-period]").forEach(function(label){label.hidden=!label.dataset.csvPeriod.split(" ").includes(period);});
    $("csv-from-label").textContent=period==="date"?"日付":"開始日";
    field("answer").disabled=format==="summary"||format==="roster";
    field("grade").disabled=group==="coaches";
    field("comments").disabled=format==="summary"||format==="contact";
    var states=["active"];
    if(period!=="current")states.push("past");
    if(field("excluded").checked)states.push("excluded");
    if(field("inactive").checked)states.push("inactive");
    var eventField=field("eventId"),previous=eventField.value;
    var eventOptions=events.filter(function(event){return states.includes(event.status);});
    var optionsHtml=eventOptions.map(function(event){
      return '<option value="'+esc(event.id)+'">'+esc(event.date+" "+event.title+" · "+event.statusLabel)+'</option>';
    }).join("");
    if(eventField.innerHTML!==optionsHtml){
      eventField.innerHTML=optionsHtml;
      if(eventOptions.some(function(event){return event.id===previous;}))eventField.value=previous;
    }
    var options={
      format:format,groups:group==="both"?["players","coaches"]:[group],states:states,
      eventId:period==="event"?eventField.value:"",
      from:period==="current"?todayISO():period==="date"||period==="range"?field("from").value:"",
      to:period==="current"?maxDate():period==="range"?field("to").value:period==="date"?field("from").value:"",
      kind:field("kind").value,category:field("category").value,grade:field("grade").value,
      answer:field("answer").disabled?"":field("answer").value,
      comments:!field("comments").disabled&&field("comments").checked
    };
    button.disabled=true;
    if(includesCoaches)readStaffCoaches();
    if(!csvModule||(!deviceMode&&!sharedReady)){
      status.textContent="出欠データを読み込み中です。";return null;
    }
    if((includesCoaches&&!staffCoachesReady)||(group!=="coaches"&&!rosterState.startsWith("名簿から"))){
      status.textContent="対象の名簿を確認できるまでお待ちください。";return null;
    }
    if((period==="date"&&!options.from)||(period==="range"&&(!options.from||!options.to||options.from>options.to))){
      status.textContent="有効な日付を指定してください。";return null;
    }
    if(period==="event"&&!options.eventId){status.textContent="選べる予定がありません。";return null;}
    var days=new Map(groupBoardDays(events.filter(function(event){return event.status==="active"||event.status==="past";}))
      .map(function(day){return [day.date,day];}));
    var rows=csvModule.buildAttendanceRows(events,options,function(event,personGroup){
      return getPeople(personGroup).map(function(person){
        var answer=state.answers[event.id]?.[personGroup]?.[person.id]||{};
        var contact=matchContact(event.id,person.id,personGroup);
        return {...person,value:answer.value,updatedAt:answer.updatedAt,contact:contact,contactText:matchComment(contact),
          note:state.notes[personGroup]?.[person.id],restricted:responseRestriction(event,person,days.get(event.date),personGroup)};
      });
    });
    var count=rows.length-1;
    status.textContent=csvModule.formatNames[format]+" "+count+"件"+(count?"":"。条件に合う記録がありません。");
    button.disabled=!count;
    if(!count)return null;
    var targets={players:"団員",coaches:"コーチ",both:"団員・コーチ"};
    var periodLabel=period==="all"?"全期間":period==="event"?eventOptions.find(function(event){return event.id===options.eventId;}).date:
      period==="current"?todayISO()+"〜"+maxDate():options.from+(options.to!==options.from?"〜"+options.to:"");
    return {rows:rows,name:"吉見SMC_"+csvModule.formatNames[format]+"_"+targets[group]+"_"+periodLabel+".csv"};
  }
  function downloadCsv(event){
    event.preventDefault();
    var file=refreshCsv();
    if(!file)return;
    var blob=new Blob([csvModule.encodeAttendanceCsv(file.rows)],{type:"text/csv;charset=utf-8"});
    var url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=file.name;
    document.body.append(link);link.click();link.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
  function wholeTeamActivityTitle(event){
    if(event.label!=="全体")return "";
    var title=event.title.normalize("NFKC").trim();
    if(event.kind!=="event"&&!/スポ(?:少|ーツ少年団)\s*(?:の\s*)?マラソン/.test(title))return "";
    // Keep a cancellation of the activity itself, removing only the cancelled practice clause.
    return title.replace(/^(?:【(?:全体)?練習中止】\s*|(?:全体|通常)?練習(?:は|を)?\s*中止(?:となり|になり|して|で|し|[、。・])\s*)/,"").trim();
  }

  function calendarAttendanceEvent(event){
    if(!event.sourceId)return null;
    var activityTitle=wholeTeamActivityTitle(event);
    if(!activityTitle&&!/^U(?:[7-9]|1[0-2])$/.test(event.label))return null;
    var timed=/T/.test(event.start);
    var start=timed?new Date(event.start):null;
    if(start&&isNaN(start.getTime()))return null;
    var date=start?new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",dateStyle:"short"}).format(start):event.start;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<todayISO()||date>maxDate())return null;
    var clock=new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
    var time=start?clock.format(start):"";
    var end=timed&&event.end?new Date(event.end):null;
    var displayTitle=activityTitle||event.title;
    return {
      id:"calendar_"+encodeURIComponent(event.sourceId),date:date,startTime:time,
      endTime:end&&!isNaN(end.getTime())?clock.format(end):"",descriptionTime:event.descriptionTime||"",
      description:event.description||"",
      kind:activityTitle?"activity":"match",status:event.status,category:event.label,title:displayTitle,place:event.location||"",
      calendarUrl:safeCalendarEventUrl(event.url),
      targetGrades:window.SMCCalendarAttendance.targetGrades(event.description,displayTitle)
    };
  }

  function isAutomaticMatch(match){
    var title=match.title.normalize("NFKC");
    var isMatch=/試合|大会|交流戦|対抗戦|招待|カップ|リーグ|トレマ|フェス|マッチ|\b(?:TM|TRM|CUP|LEAGUE)\b|[vV][sS][.．]/i.test(title);
    return isMatch||!/練習|トレーニング|会議|総会|説明会|保護者会|審判講習|予備日/.test(title);
  }

  function calendarMatchUnavailable(match){
    if(window.SMCCalendarAttendance.upcomingKind(match)==="cancelled")return true;
    return isWeekend(match.date)&&/運動会|体育祭|^年末年始$|年末年始休|休団|休業|会議|説明会|予備日/.test(match.title.normalize("NFKC"));
  }

  function syncCalendarAttendance(matches,restore,failed){
    var events=new Map(state.events.map(function(event){return [event.id,event];}));
    var archived=new Set(state.archive.map(function(event){return event.id;}));
    var resumed=new Set(),changed=false;
    if(failed){
      var received=new Set(matches.filter(function(match){return !calendarMatchUnavailable(match);}).map(function(match){return match.id;}));
      events.forEach(function(event,id){
        if(id.startsWith("calendar_")&&!event.calendarInactive&&!failed.includes(event.category)&&!received.has(id)){
          events.set(id,{...event,calendarInactive:true});
          changed=true;
        }
      });
    }
    matches.forEach(function(match){
      if(calendarMatchUnavailable(match))return;
      var previous=events.get(match.id);
      if(!restore&&!previous&&match.kind==="match"&&!isAutomaticMatch(match))return;
      var hidden=previous?.hidden&&!restore;
      if(previous&&!previous.calendarInactive&&Boolean(previous.hidden)===Boolean(hidden)&&
        ["date","startTime","endTime","descriptionTime","description","title","place","category","calendarUrl","kind"].every(function(key){return previous[key]===match[key];})&&
        JSON.stringify(previous.targetGrades)===JSON.stringify(match.targetGrades))return;
      events.set(match.id,{...match,...(hidden?{hidden:true}:{}),...(previous?.targetOverride?{targetOverride:previous.targetOverride}:{})});
      if(archived.has(match.id))resumed.add(match.id);
      changed=true;
    });
    if(!changed)return true;

    var previousEvents=state.events,previousArchive=state.archive;
    state.events=Array.from(events.values());
    if(resumed.size)state.archive=previousArchive.filter(function(event){return !resumed.has(event.id);});
    if(saveState())return true;
    state.events=previousEvents;
    state.archive=previousArchive;
    return false;
  }

  function setupCalendarMatchPicker(){
    var dialog=$("calendar-match-dialog"),list=$("calendar-match-list"),status=$("calendar-match-status");
    var category=$("calendar-match-category"),refresh=$("refresh-calendar-matches"),syncStatus=$("calendar-sync-status");
    var matches=[],failed=[],loading=false,loaded=false;

    function renderMatches(){
      var visible=matches.filter(function(match){return !calendarMatchUnavailable(match)&&(!category.value||match.category===category.value);});
      list.replaceChildren();
      if(loading){status.textContent="カレンダーを読み込んでいます…";return;}
      var message=visible.length?visible.length+"件の予定。試合をタップすると、出欠表の該当日に移動します。":"2か月以内の予定がありません。";
      if(failed.length)message+=" "+failed.join("・")+"は読み込めませんでした。";
      status.textContent=message;

      visible.forEach(function(match){
        var active=state.events.find(function(event){return event.id===match.id;});
        var button=document.createElement("button");
        button.type="button";
        button.className="calendar-match-choice secondary-button";
        var when=document.createElement("span");
        when.textContent=dateLabel(match.date)+(match.startTime?" "+match.startTime:"")+" / "+match.category;
        var title=document.createElement("strong");
        title.textContent=match.title;
        button.append(when,title);
        if(match.place){
          var place=document.createElement("span");
          place.textContent=match.place;
          button.append(place);
        }
        var action=document.createElement("span");
        action.className="calendar-match-action";
        action.textContent=active&&manuallyExcluded(active)?"出欠表に戻す":active?"追加済み・出欠表を開く":"出欠表に追加";
        button.append(action);
        button.addEventListener("click",async function(){
          if(active&&manuallyExcluded(active)&&!await setEventExclusion(active,false))return;
          if(!syncCalendarAttendance([match],true))return;
          dialog.close();
          openEvent(match.id);
        });
        list.append(button);
      });
    }

    function requestMatches(){
      if(loading)return;
      if(dialog.dataset.calendarReady!=="true"){
        syncStatus.textContent=status.textContent="カレンダーを読み込めませんでした。ページを開き直してください。";
        return;
      }
      loading=true;
      syncStatus.textContent="カレンダーを読み込み中…";
      refresh.disabled=true;
      renderMatches();
      dialog.dispatchEvent(new Event("smc-calendar-request"));
    }
    dialog.addEventListener("smc-calendar-result",function(event){
      failed=event.detail.failed;
      syncWeekendPractices(event.detail.events,failed);
      calendarMatchesChecked=true;
      var linked=event.detail.events.map(calendarAttendanceEvent).filter(Boolean).sort(function(a,b){
        return a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime,"ja")||a.category.localeCompare(b.category,"ja",{numeric:true});
      });
      matches=linked.filter(function(event){return event.kind==="match";});
      var saved=syncCalendarAttendance(linked,false,failed);
      var active=linked.filter(function(event){
        return state.events.some(function(item){return item.id===event.id&&!manuallyExcluded(item)&&!item.calendarInactive;});
      });
      var activities=active.filter(function(event){return event.kind==="activity";}).length;
      syncStatus.textContent=!saved?"カレンダーの予定を保存できませんでした。":
        "カレンダー連携："+(active.length-activities)+"件の試合"+(activities?"・"+activities+"件の行事":"")+
        (failed.length?"（"+failed.join("・")+"は取得できませんでした）":"");
      renderDateOptions();renderEventList();renderResponse(true);
      refreshMatchDetail();
      refreshSharedMatchSummary();refreshCsvIfOpen();
      loading=false;
      loaded=true;
      refresh.disabled=false;
      renderMatches();
    });
    $("open-calendar-matches").addEventListener("click",function(){
      dialog.showModal();
      if(!loaded)requestMatches();
      else renderMatches();
    });
    category.addEventListener("change",renderMatches);
    refresh.addEventListener("click",requestMatches);
    document.addEventListener("visibilitychange",function(){if(!document.hidden)requestMatches();});
    if(dialog.dataset.calendarReady==="true"||document.readyState==="complete")requestMatches();
    else window.addEventListener("load",requestMatches,{once:true});
  }

  function init(){
    $("event-list-filter").addEventListener("change",renderEventList);
    $("event-visibility-undo").addEventListener("click",function(){
      if(undoVisibility)setEventExclusion(undoVisibility.event,undoVisibility.excluded);
    });
    $("saved-event-dialog").addEventListener("close",function(){viewedEvent=null;});
    $("event-list").addEventListener("click",handleEventListClick);
    $("csv-form").addEventListener("input",refreshCsv);
    $("csv-form").addEventListener("submit",downloadCsv);
    $("csv-close").addEventListener("click",function(){$("csv-dialog").close();});
    ["attendance-dialog","day-entry-dialog"].forEach(function(id){
      $(id).addEventListener("cancel",function(event){if(savingShared)event.preventDefault();});
    });
    $("shared-attendance-status").hidden=deviceMode;
    $("holiday-attendance-status").textContent="祝日の設定を読み込み中です。";
    $("holiday-attendance-list").addEventListener("click",function(event){
      var button=event.target.closest("button[data-holiday-date]");
      if(button)toggleHoliday(button.dataset.holidayDate);
    });
    // Read-only roster and coach names are independent of Firestore share tokens.
    // Never create replacement people or write over the original roster.
    readRoster();
    readStaffCoaches();
    if(!deviceMode)startSharedAttendance();
    $("reset-demo").hidden=!deviceMode;
    movePastEvents();
    setupCalendarMatchPicker();
    $("recruitment-search").addEventListener("input",function(event){
      if(!event.isComposing)filterRecruitment();
    });
    $("recruitment-search").addEventListener("compositionend",filterRecruitment);
    $("recruitment-clear").addEventListener("click",function(){
      var input=$("recruitment-search");
      input.value="";
      input.focus({preventScroll:true});
      filterRecruitment();
    });
    $("recruitment-members").addEventListener("change",function(event){
      var row=event.target.closest("[data-recruit-person]");
      if(!row)return;
      var id=row.dataset.recruitPerson;
      if(event.target.value===recruitmentEdit.initial.get(id))recruitmentEdit.draft.delete(id);
      else recruitmentEdit.draft.set(id,event.target.value);
      updateRecruitmentCount();
    });
    $("recruitment-form").addEventListener("submit",saveRecruitment);
    $("recruitment-close").addEventListener("click",function(){$("recruitment-dialog").close();});
    $("recruitment-dialog").addEventListener("cancel",function(event){if(savingRecruitment)event.preventDefault();});
    window.visualViewport?.addEventListener("resize",fitRecruitmentViewport);
    window.visualViewport?.addEventListener("scroll",fitRecruitmentViewport);
    $("match-detail-tabs").addEventListener("click",function(event){
      var tab=event.target.closest('[role="tab"]');
      if(tab)showMatchDetailTab(tab);
    });
    $("match-detail-tabs").addEventListener("keydown",function(event){
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      var tabs=Array.from(event.currentTarget.querySelectorAll('[role="tab"]'));
      var index=tabs.indexOf(event.target);
      if(index<0)return;
      event.preventDefault();
      var selected=tabs[event.key==="Home"?0:event.key==="End"?tabs.length-1:(index+1)%tabs.length];
      showMatchDetailTab(selected);
      selected.focus();
    });
    $("match-detail-dialog").addEventListener("close",function(){activeMatchDetailId="";});
    $("match-summary-list").addEventListener("click",function(event){
      var detail=event.target.closest("[data-match-detail]");
      if(detail&&activeMatchSummary){
        var match=activeMatchSummary.day.matches.find(function(item){return item.id===detail.dataset.matchDetail;});
        if(match)openMatchDetail(match);
        return;
      }
      var recruit=event.target.closest("[data-recruit-event]");
      if(recruit&&activeMatchSummary){
        var selectedMatch=activeMatchSummary.day.matches.find(function(match){return match.id===recruit.dataset.recruitEvent;});
        if(selectedMatch)openRecruitment(selectedMatch);
        return;
      }
      var button=event.target.closest("[data-target-action]");
      if(!button||audience!=="coaches")return;
      var card=button.closest("[data-target-event]");
      var match=state.events.find(function(item){return item.id===card.dataset.targetEvent;});
      if(!match)return;
      var previous=match.targetOverride;
      if(button.dataset.targetAction==="auto")delete match.targetOverride;
      else{
        var grades=Array.from(card.querySelectorAll("input:checked"),function(input){return input.value;});
        if(!grades.length){alert("対象学年を1つ以上選んでください。");return;}
        match.targetOverride=grades;
      }
      if(!saveState()){
        if(previous)match.targetOverride=previous;
        else delete match.targetOverride;
        return;
      }
      renderEventList();renderResponse(true);
      openMatchSummary(match.date);
    });
    $("attendance-form-events").addEventListener("click",function(event){
      if(event.target.id!=="jump-entry-review")return;
      var card=event.currentTarget.querySelector("[data-needs-review]");
      if(card){
        card.scrollIntoView({block:"start",behavior:"smooth"});
        card.querySelector('input[type="radio"]').focus({preventScroll:true});
      }
    });
    $("grade-filters").addEventListener("click",function(event){
      var button=event.target.closest("[data-grade]");
      if(!button||button.dataset.grade===selectedGrade)return;
      selectedGrade=button.dataset.grade;
      renderResponse();
      $("grade-filters").querySelector('[data-grade="'+CSS.escape(selectedGrade)+'"]')?.focus({preventScroll:true});
    });
    $("open-match-summary").addEventListener("click",function(){openMatchSummary($("match-summary-date").value);});
    $("match-summary-date").addEventListener("change",function(event){openMatchSummary(event.target.value);});
    $("day-entry-form").addEventListener("submit",async function(event){
      event.preventDefault();
      if(!activeDayEntry)return;
      var entry=activeDayEntry,form=new FormData(event.currentTarget);
      var days=groupBoardDays(getBoardEvents()).filter(function(day){return day.date===entry.day.date;});
      var updates=readEntryUpdates(form,entry.person,days);
      if(!await submitEntry(entry.person.id,updates,undefined,event.currentTarget))return;
      $("day-entry-dialog").close();
      renderEventList();renderResponse(true);
      reportEntrySaved(updates);
      focusDayCell(entry.day.date,entry.person.id);
    });
    $("cancel-day-entry").addEventListener("click",function(){$("day-entry-dialog").close();});
    $("day-entry-dialog").addEventListener("close",function(){
      if(dayEntryTrigger&&dayEntryTrigger.isConnected)dayEntryTrigger.focus({preventScroll:true});
      activeDayEntry=null;
      dayEntryTrigger=null;
    });
    document.querySelectorAll(".audience-tab").forEach(function(btn){btn.addEventListener("click",function(){audience=btn.dataset.audience;if(audience==="coaches")readStaffCoaches();selectedGrade="すべて";document.querySelectorAll(".audience-tab").forEach(function(tab){var active=tab===btn;tab.classList.toggle("active",active);tab.setAttribute("aria-pressed",active?"true":"false");});render();});});
    $("add-event").addEventListener("click",addEvent);$("cancel-event").addEventListener("click",function(){$("event-dialog").close();});$("event-form").addEventListener("submit",function(e){e.preventDefault();var title=$("event-title").value.trim();if(!title)return;if(selectedDate<todayISO()||selectedDate>maxDate()||!isDefaultDay(selectedDate)){alert("今日から2か月先までの対象日を一覧から選んでください。");return;}var kind=$("event-kind").value,dayId=defaultEvent(selectedDate).id;
      var reuseDay=kind==="practice"&&!eventForDate(selectedDate).some(function(event){return event.id===dayId||event.kind==="practice";});
      var id=reuseDay?dayId:"demo_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7);state.events.push({id:id,date:selectedDate,kind:$("event-kind").value,title:title,place:$("event-place").value.trim(),createdAt:new Date().toISOString()});saveState();$("event-dialog").close();openEvent(id);});
    $("entry-mode-button").addEventListener("click",function(){if(!requireSharedConnection())return;if(getPeople().length){openAttendanceForm("");return;}if(audience==="coaches"&&!state.coaches.length){$("coach-local-editor").open=true;$("coach-editor").scrollIntoView({behavior:"smooth",block:"center"});$("coach-name-input").focus({preventScroll:true});return;}});$("entry-mode-icon").addEventListener("click",function(){$("entry-mode-button").click();});$("transpose-board").addEventListener("click",function(){transposeBoard=!transposeBoard;renderResponse();});$("cancel-attendance").addEventListener("click",function(){$("attendance-dialog").close();});$("attendance-form").addEventListener("submit",saveAttendanceForm);$("entry-person").addEventListener("change",renderAttendanceFormEvents);$("export-csv").addEventListener("click",openCsv);$("reset-demo").addEventListener("click",function(){if(!confirm("この端末に保存した試作の予定・回答・コーチ名をすべて削除しますか？団員名簿は変更されません。"))return;state={events:[],archive:[],coaches:[],coachLinks:{},answers:{},notes:{},matchNotes:{}};selectedEventId="";selectedDate="";localStorage.removeItem(STORAGE_KEY);render();});$("add-coach").addEventListener("click",function(){var input=$("coach-name-input"),name=input.value.trim();if(!name){input.focus();return;}if(getPeople().some(function(c){return coachNameKey(c.name)===coachNameKey(name);})){alert("同じ名前がすでに登録されています。");return;}state.coaches.push({id:"coach_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6),name:name});input.value="";saveState();render();});
    var archiveSection=document.createElement("section");archiveSection.className="panel archived-panel";archiveSection.innerHTML='<details><summary>過去の予定（試作データ）</summary><div id="archive-list" class="event-list"></div><p class="small-note">日付が過ぎた予定は一覧から自動で移し、試作版の回答記録はCSV出力用にこの端末へ残しています。</p></details>';$("event-panel").after(archiveSection);
    $("archive-list").addEventListener("click",handleEventListClick);
    render();loadHolidays();
  }
  document.addEventListener("DOMContentLoaded",init);
})();
