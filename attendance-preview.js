(function(){
  "use strict";
  var STORAGE_KEY="yoshimi_smc_attendance_preview_v1";
  var GRADES=["6年","5年","4年","3年","2年","1年","年長"];
  var DAY_NAMES=["日","月","火","水","木","金","土"];
  var ANSWERS=[{value:"attending",label:"参加"},{value:"maybe",label:"未定"},{value:"absent",label:"不参加"}];
  var TRIPS=["行きのみ","帰りのみ","往復"];
  var deviceMode=false;
  var params=new URLSearchParams(location.search);
  var calendarView=params.has("calendar-attendance")?{
    id:params.get("calendar-attendance"),date:params.get("date")||""
  }:null;
  var syncedCalendarEvents=[];
  var state=loadState(),members=[],rosterState="読み込み中",holidays={},audience="players",selectedDate="",selectedEventId="",selectedGrade="すべて",transposeBoard=false;
  var staffCoaches=[],staffCoachesReady=false,coachRosterStarted=false,coachRosterStatus="コーチ担当を読み込み中…";
  var previewRosterStarted=false, sharedStore, sharedRows=new Map(), sharedReady=false, savingShared=false, entryBaseline;
  if(!deviceMode){state.answers={};state.matchNotes={};state.notes={};state.coaches=[];state.coachLinks={};}
  var weekendPracticeDates=new Set(), calendarMatchesChecked=false;
  var seasonPeriod=null, seasonReady=false, savingSeason=false, calendarSyncResult=null;
  var SEASON_CACHE="yoshimi_attendance_season_period";
  try{seasonPeriod=validSeasonPeriod(JSON.parse(localStorage.getItem(SEASON_CACHE)||"null"));}catch(error){}
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
    function consume(db){if(started)return;started=true;db.ref("members_v2").once("value").then(function(snapshot){var raw=snapshot.val()||{},list=[];Object.keys(raw).forEach(function(id){var m=raw[id];if(m&&String(m.name||"").trim()){list.push({id:String(m.id||id),name:String(m.name).trim(),kana:String(m.kana||""),grade:String(m.grade||"未設定"),gender:m.gender==="f"||m.gender==="m"?m.gender:""});}});members=list.sort(function(a,b){var ga=GRADES.indexOf(a.grade),gb=GRADES.indexOf(b.grade);if(ga<0)ga=99;if(gb<0)gb=99;return ga-gb||String(a.kana||a.name).localeCompare(String(b.kana||b.name),"ja");});rosterState="名簿から"+members.length+"名を読み込みました";$("roster-status").textContent="✓ "+rosterState+"（読み取り専用）";render();renderSavedEvent();refreshCsvIfOpen();familyDirectoryChanged();}).catch(function(){rosterState="団員名簿を読み込めませんでした。通信状態をご確認ください";$("roster-status").textContent="⚠ "+rosterState;render();});}
    if(window.FIREBASE_READY&&window.FIREBASE_DB)consume(window.FIREBASE_DB);else if(typeof window.onFirebaseReady==="function")window.onFirebaseReady(consume);else{rosterState="名簿の読み込み機能を利用できません";render();}
    window.setTimeout(function(){if(!started){rosterState="名簿の読み込みに時間がかかっています。画面を更新してください";render();}},10000);
  }
  function loadHolidays(){
    try{var cached=JSON.parse(localStorage.getItem("yoshimi_jp_holidays_cache_v1")||"null");if(cached&&cached.savedAt>Date.now()-7*86400000){holidays=cached.data||{};renderHolidaySettings();renderEventList();renderResponse(true);}}
    catch(e){}
    fetch("https://holidays-jp.github.io/api/v1/date.json").then(function(r){if(!r.ok)throw new Error("holiday data unavailable");return r.json();}).then(function(data){holidays=data||{};localStorage.setItem("yoshimi_jp_holidays_cache_v1",JSON.stringify({savedAt:Date.now(),data:holidays}));renderHolidaySettings();renderEventList();renderResponse(true);}).catch(function(){if(!Object.keys(holidays).length){holidays={};renderHolidaySettings();renderEventList();renderResponse(true);}});
  }
  function isWeekend(iso){return [0,6].includes(fromISO(iso).getDay());}
  function validSeasonPeriod(value){
    var validDate=function(date){
      return typeof date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&localISO(fromISO(date))===date;
    };
    return validDate(value?.start)&&validDate(value?.end)&&value.start<=value.end?
      {start:value.start,end:value.end}:null;
  }

  function isSeasonDate(iso){
    return Boolean(seasonPeriod&&iso>=seasonPeriod.start&&iso<=seasonPeriod.end);
  }

  function isDefaultDay(iso){
    if(isSeasonDate(iso))return false;
    return Boolean(holidays[iso])||(isWeekend(iso)?weekendPracticeDates.has(iso):[3,4].includes(fromISO(iso).getDay()));
  }
  function syncWeekendPractices(events,failed){
    if(failed.includes("全体"))return;
    weekendPracticeDates=new Set(events.filter(function(event){
      return event.label==="全体"&&!wholeTeamActivityTitle(event)&&window.SMCCalendarAttendance.upcomingKind(event)==="practice";
    }).map(function(event){return window.SMCCalendarAttendance.tokyoDate(event.start);}).filter(isWeekend));
  }
  function defaultEvent(iso){
    var day={id:"day_"+iso,date:iso,kind:"",title:""};
    return holidays[iso]?{...day,kind:"activity",holidayAvailability:true,title:"祝日・試合に備えた出欠確認"}:day;
  }
  function getBoardEvents(){
    var start=fromISO(todayISO()),end=fromISO(maxDate()),events=[];
    for(var date=new Date(start);date<=end;date.setDate(date.getDate()+1)){
      var iso=localISO(date);
      var registered=eventForDate(iso);
      var regular=defaultEvent(iso);
      if(isDefaultDay(iso)&&!excludedHolidays.has(iso)&&!manuallyExcluded(regular)&&!state.events.some(function(event){
        return event.date===iso&&!event.calendarInactive&&!event.seasonOnly&&(event.id===regular.id||event.kind!=="match");
      })){
        if(regular.holidayAvailability){
          var confirmedMatch=registered.some(function(event){return event.kind==="match";});
          var priorAnswers=Object.values(state.answers[regular.id]||{}).some(function(replies){
            return Object.values(replies).some(function(answer){return Boolean(answer.value||Object.keys(answer.contact||{}).length);});
          });
          if(!confirmedMatch||priorAnswers)events.push({...regular,holidayReference:confirmedMatch});
        }else{
          if(isWeekend(iso)||registered.length)regular.kind="practice";
          events.push(regular);
        }
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
    var seasonal=isSeasonDate(iso);
    var active=state.events.filter(function(event){
      if(event.date!==iso||manuallyExcluded(event)||event.calendarInactive)return false;
      if(seasonal)return event.id.startsWith("calendar_");
      return !event.seasonOnly;
    });
    if(seasonal||!isWeekend(iso))return active;
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
      renderHolidaySettings();renderEventList();
      if(document.activeElement===document.body)list.querySelector('[data-holiday-date="'+date+'"]')?.focus({preventScroll:true});
    }
  }
  function eventListStatus(event,active){
    if(event.calendarInactive)return "カレンダー対象外";
    if(manuallyExcluded(event))return "出欠表から除外中";
    return active?(event.holidayReference?"試合決定前の回答・参照のみ":"出欠受付中"):"現在は出欠対象外";
  }
  function scheduleDays(board,filter){
    var active=new Set(board.map(function(event){return event.id;}));
    var saved=new Map(state.events.concat(board).map(function(event){return [event.id,event];}));
    var groups=new Map();
    var today=todayISO(),end=maxDate();
    function canAdd(date){return date>=today&&date<=end&&isDefaultDay(date);}
    saved.forEach(function(event){
      if(event.seasonOnly&&!isSeasonDate(event.date))return;
      if(filter==="active"&&!active.has(event.id))return;
      if(filter==="excluded"&&!manuallyExcluded(event))return;
      if(filter==="inactive"&&!event.calendarInactive)return;
      if(!groups.has(event.date))groups.set(event.date,{date:event.date,canAdd:canAdd(event.date),events:[]});
      groups.get(event.date).events.push(event);
    });
    if(!filter){
      for(var day=fromISO(today),last=fromISO(end);day<=last;day.setDate(day.getDate()+1)){
        var date=localISO(day);
        if(!groups.has(date)&&canAdd(date))groups.set(date,{date:date,canAdd:true,events:[]});
      }
    }
    return Array.from(groups.values()).sort(function(a,b){return a.date.localeCompare(b.date);});
  }

  function scheduleEventTitle(event){
    if(event.title)return event.title;
    var weekday=fromISO(event.date).getDay();
    return weekday===4?"低学年練習":weekday===3?"通常練習":eventKindLabel(event);
  }

  function renderEventList(){
    var board=getBoardEvents(),active=new Set(board.map(function(event){return event.id;}));
    var stored=new Set(state.events.map(function(event){return event.id;}));
    var days=new Map(groupBoardDays(board).map(function(day){return [day.date,day];}));
    var people=getPeople(),list=$("event-list"),filter=$("event-list-filter").value;
    list.innerHTML=scheduleDays(board,filter).map(function(day){
      var heading='<div class="schedule-day-heading"><h3><time datetime="'+esc(day.date)+'">'+esc(compactDate(day.date))+'</time></h3>'+
        (day.canAdd?'<button type="button" class="secondary-button" data-add-date="'+esc(day.date)+'" aria-label="'+
          esc(dateLabel(day.date)+"に予定を追加")+'">＋ 予定を追加</button>':"")+'</div>';
      var entries=day.events.map(function(event){
        var accepting=active.has(event.id),excluded=manuallyExcluded(event);
        var c=accepting&&sharedReady?countAnswers([event],people,days.get(event.date)):null;
        var totals=c?'<span class="schedule-event-count">'+esc(compactCountText(c))+'</span>':"";
        var info=[eventKindLabel(event),event.startTime,eventListStatus(event,accepting)];
        if(excluded&&event.calendarInactive)info.push("手動でも除外中");
        var control=stored.has(event.id)&&(accepting||excluded)?
          '<button type="button" class="secondary-button event-visibility-button" data-toggle-event="'+esc(event.id)+'"'+
          (!visibilityReady||visibilitySaving?" disabled":"")+'>'+(excluded?"出欠表に戻す":"出欠表から外す")+'</button>':"";
        return '<article class="schedule-event"><button class="event-open" type="button" data-open-event="'+esc(event.id)+'"><strong>'+
          esc(scheduleEventTitle(event))+'</strong><span class="event-meta">'+esc(info.filter(Boolean).join(" · "))+'</span></button>'+
          totals+control+'</article>';
      }).join("")||'<p class="small-note">出欠表に表示する予定はありません。</p>';
      return '<section class="schedule-day" data-schedule-date="'+esc(day.date)+'">'+heading+entries+'</section>';
    }).join("")||'<div class="empty-state">条件に合う予定はありません。</div>';
    $("archive-list").innerHTML=state.archive.slice().sort(function(a,b){return b.date.localeCompare(a.date);}).map(function(event){
      return '<div class="event-card"><button class="event-open" type="button" data-open-event="'+esc(event.id)+'"><strong>'+
        esc(scheduleEventTitle(event))+'</strong><span class="event-meta">'+esc(dateLabel(event.date))+'</span></button></div>';
    }).join("")||'<p class="small-note">この端末で確認できる過去の予定はありません。</p>';
  }
  function compactCountText(total){
    return "参加 "+total.attending+(audience==="coaches"?"":"/"+total.eligible)+" · 未定 "+total.maybe+" · 不参加 "+total.absent;
  }

  function renderSavedEvent(){
    if(!viewedEvent)return;
    var event=state.events.find(function(item){return item.id===viewedEvent.id;})||viewedEvent;
    $("saved-event-title").textContent=scheduleEventTitle(event);
    $("saved-event-open-board").hidden=!getBoardEvents().some(function(item){return item.id===event.id;});
    $("saved-event-info").innerHTML='<p>'+esc(dateLabel(event.date))+'</p>'+
      (event.holidayAvailability?'<p>'+ (event.holidayReference?
        "試合決定前に回答した内容です。確定した試合の出欠は、試合の欄で確認・入力してください。":
        "試合が入る場合に備えた事前の出欠確認です。")+'</p>':matchDetailInfo(event));
    var groups=["players","coaches"];
    var day=groupBoardDays(getBoardEvents().filter(function(item){return item.date===event.date;}))[0];
    $("saved-event-answers").innerHTML=groups.map(function(group){
      var people=getPeople(group).filter(function(person){
        return !eligibility(event,person,group)||Boolean(answerValue(event,person,group)||matchContact(event.id,person.id,group));
      });
      return '<h3>'+(group==="players"?"団員":"コーチ")+'</h3>'+matchAttendanceTable(event,people,group,day);
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
      renderHolidaySettings();renderEventList();renderResponse(true);refreshSharedMatchSummary();refreshCsvIfOpen();
    }
  }
  function handleEventListClick(event){
    var button=event.target.closest("button[data-open-event],button[data-toggle-event],button[data-add-date]");
    if(!button)return;
    if(button.dataset.addDate){addEvent(button.dataset.addDate);return;}
    var id=button.dataset.openEvent||button.dataset.toggleEvent;
    var item=state.events.concat(state.archive,getBoardEvents()).find(function(entry){return entry.id===id;});
    if(!item)return;
    if(button.dataset.toggleEvent){setEventExclusion(item,!manuallyExcluded(item));return;}
    showSavedEvent(item);
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
        coachRosterStatus=staffCoaches.length?"":"コーチ担当に登録された名前がありません。";
      }else{
        coachRosterStatus="コーチ担当を確認できませんでした。通信状況を確認して、画面を開き直してください。";
      }
      if(audience==="coaches"||calendarView){renderEventList();renderResponse(true);}
      renderSavedEvent();refreshCsvIfOpen();
      familyDirectoryChanged();
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
  function filterPeopleByGrade(people){
    return audience==="players"&&selectedGrade!=="すべて"?
      people.filter(function(person){return person.grade===selectedGrade;}):people;
  }
  function answerMark(value){return value==="attending"?"○":value==="maybe"?"△":value==="absent"?"×":"";}

  var activeDayEntry=null, dayEntryTrigger=null, activeMatchSummary=null, activeAttendanceDetail=null;

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
    if(event.targetGrades)return event.targetGrades;
    return window.SMCCalendarAttendance.targetGrades(event.description,event.title);
  }

  function normalizedGrade(person){
    return String(person.grade||"").normalize("NFKC").trim().replace(/生$/,"");
  }

  function recruitmentDecision(event,person){
    var decisions=recruitmentRows.get(event.id)?.decisions;
    return decisions&&Object.hasOwn(decisions,person.id)?decisions[person.id]:"default";
  }

  function isGirlsMatch(event){
    return window.SMCCalendarAttendance.girlsOnly(event.description,event.title);
  }

  function matchGenderRestriction(event,person){
    if(!isGirlsMatch(event)||person.gender==="f")return "";
    return person.gender==="m"?"対象外":"対象要確認";
  }

  function matchRestriction(event,person,decision){
    if(decision==="exclude")return "招集対象外";
    if(decision!=="include"){
      var grades=targetGrades(event);
      if(!grades)return "対象学年未設定";
      if(!grades.includes(normalizedGrade(person)))return "対象外";
    }
    return matchGenderRestriction(event,person);
  }

  function eligibility(event,person,group){
    if((group||audience)!=="players")return "";
    if(event.kind==="match")return matchRestriction(event,person,recruitmentDecision(event,person));
    var grade=normalizedGrade(person);
    if(event.kind==="activity"||event.seasonOnly){
      var grades=targetGrades(event);
      return grades&&!grades.includes(grade)?"対象外":"";
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

  function attendanceValue(event,person,day,group){
    group=group||audience;
    if(group==="coaches"&&event.kind!=="match"&&event.kind!=="activity"&&day?.matches.some(function(match){
      return answerValue(match,person,group)==="attending";
    }))return "absent";
    return answerValue(event,person,group);
  }

  function countCoaches(events,people,day){
    var total={attending:0,maybe:0,absent:0,eligible:people.length};
    people.forEach(function(person){
      var values=events.map(function(event){return attendanceValue(event,person,day,"coaches");});
      var answer=ANSWERS.find(function(option){return values.includes(option.value);});
      if(answer)total[answer.value]++;
    });
    return total;
  }

  function countAnswers(events,people,day){
    var total={attending:0,maybe:0,absent:0,eligible:0};
    events.forEach(function(event){
      eligiblePeople(event,people,day).forEach(function(person){
        var value=attendanceValue(event,person,day);
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

  function attendanceMark(value){
    return value?'<i class="attendance-mark" data-mark="'+esc(value)+'" aria-hidden="true"></i>':"";
  }

  function compactCountMarks(total){
    return '<span class="count-yes">'+attendanceMark("attending")+total.attending+'</span>'+
      '<span class="count-maybe">'+attendanceMark("maybe")+total.maybe+'</span>'+
      '<span class="count-no">'+attendanceMark("absent")+total.absent+'</span>';
  }

  function responseCountText(total){
    return "参加 "+total.attending+"人、未定 "+total.maybe+"人、不参加 "+total.absent+"人";
  }

  function targetCountText(total,eventCount){
    return "対象 "+(eventCount>1?"延べ":"")+total.eligible+"人";
  }

  function targetCountLine(text){
    return '<span class="board-target-count" aria-hidden="true">'+esc(text)+'</span>';
  }

  function matchCategory(event){
    return String(event.category||"").trim()||"その他";
  }

  function matchCategories(matches){
    var grouped=new Map();
    matches.forEach(function(event){
      var name=matchCategory(event);
      if(!grouped.has(name))grouped.set(name,[]);
      grouped.get(name).push(event);
    });
    return new Map(Array.from(grouped).sort(function(a,b){
      var ageA=Number(/^U(\d+)$/.exec(a[0])?.[1]||0);
      var ageB=Number(/^U(\d+)$/.exec(b[0])?.[1]||0);
      return ageB-ageA||Number(a[0]==="その他")-Number(b[0]==="その他")||
        a[0].localeCompare(b[0],"ja",{numeric:true});
    }));
  }

  function categoryCountButton(day,category,matches,people){
    if(!matches)return '<span class="category-count-empty" aria-label="試合なし">—</span>';
    var coaches=audience==="coaches";
    var total=coaches?countCoaches(matches,people,day):countAnswers(matches,people,day);
    var target=coaches?"":targetCountText(total,matches.length);
    var unanswered=total.eligible-total.attending-total.maybe-total.absent;
    var multiple=matches.length>1?(coaches?"":"延べ・")+matches.length+"試合　":"";
    var ready=deviceMode||sharedReady;
    var label=compactDate(day.date)+" "+category+"の試合集計。"+(ready?
      multiple+(coaches?responseCountText(total):target+"、"+responseCountText(total)+"、未回答 "+unanswered+"人"):"集計待ち");
    return '<button type="button" class="category-count-button" data-match-date="'+esc(day.date)+
      '" data-match-category="'+esc(category)+'" aria-haspopup="dialog" aria-label="'+esc(label)+'">'+
      (ready?'<span class="category-count-values" aria-hidden="true">'+compactCountMarks(total)+'</span>'+(target?targetCountLine(target):""):
      '<span class="category-count-empty">集計待ち</span>')+'</button>';
  }

  function categorySummaryRows(days,byDate,people){
    var categories=matchCategories(days.flatMap(function(day){return day.matches;}));
    return Array.from(categories.keys(),function(category){
      var title=category==="その他"?"その他の試合":category+"試合";
      return '<tr class="category-count-row"><th class="person-col" scope="row">'+esc(title)+'</th>'+
        days.map(function(day){return '<td>'+categoryCountButton(day,category,byDate.get(day.date).get(category),people)+'</td>';}).join("")+'</tr>';
    }).join("");
  }

  function activityCountButtons(day,people){
    return day.activities.map(function(event){
      var title=scheduleEventTitle(event)+(event.holidayReference?"（参照のみ）":"");
      var ready=deviceMode||sharedReady;
      var total=countAnswers([event],people,day);
      var target=audience==="coaches"?"":targetCountText(total,1);
      var label=title+"の出欠集計。"+(ready?
        (target?target+"、":"")+responseCountText(total)+(target?"、未回答 "+
          (total.eligible-total.attending-total.maybe-total.absent)+"人":""):"集計待ち");
      return '<button type="button" class="category-count-button" data-activity-summary="'+esc(event.id)+
        '" aria-haspopup="dialog" aria-label="'+esc(label)+'"><span class="activity-count-title">'+esc(title)+'</span>'+
        (ready?'<span class="category-count-values" aria-hidden="true">'+compactCountMarks(total)+'</span>'+(target?targetCountLine(target):""):
          '<span class="category-count-empty">集計待ち</span>')+'</button>';
    }).join("");
  }

  function activitySummaryRow(days,people){
    if(!days.some(function(day){return day.activities.length;}))return "";
    var title=days.some(function(day){return day.activities.some(function(event){return event.holidayAvailability;});})?"行事・祝日":"行事";
    return '<tr class="category-count-row"><th class="person-col" scope="row">'+title+'</th>'+
      days.map(function(day){return '<td>'+(activityCountButtons(day,people)||
        '<span class="category-count-empty" aria-label="行事なし">—</span>')+'</td>';}).join("")+'</tr>';
  }

  function matchCountLabel(total){
    var labels=["参加 "+total.attending,"未定 "+total.maybe,"不参加 "+total.absent];
    if(audience!=="coaches"){
      labels.unshift("対象 "+total.eligible+"名");
      labels.push("未回答 "+(total.eligible-total.attending-total.maybe-total.absent));
    }
    return labels.map(function(label){return "<span>"+esc(label)+"</span>";}).join(" ");
  }

  function dayHeading(day,people){
    var date=calendarLink(day.date,'<span class="board-date">'+esc(compactDate(day.date))+'</span>',"day-detail-link","",dateLabel(day.date)+"の予定を開く");
    var label=dateLabel(day.date)+"の練習出欠一覧。";
    if(!day.practice.length){
      return '<div class="board-day-heading">'+date+targetCountLine("練習なし")+'</div>';
    }
    var coaches=audience==="coaches";
    var total=coaches?countCoaches(day.practice,people,day):countAnswers(day.practice,people,day);
    var target=coaches?"":"練習 "+targetCountText(total,day.practice.length);
    var ready=deviceMode||sharedReady;
    label+=ready?(target?target+"、":"練習の集計。")+responseCountText(total):"練習の集計待ち";
    var count='<span class="event-count-summary" aria-hidden="true">'+(ready?compactCountMarks(total):"集計待ち")+'</span>';
    return '<div class="board-day-heading">'+date+
      '<button type="button" class="category-count-button practice-count-button" data-practice-date="'+esc(day.date)+
      '" aria-haspopup="dialog" aria-label="'+esc(label)+'">'+count+
      (ready&&target?targetCountLine(target):"")+'</button></div>';
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

  function coachDayMark(day,person){
    var answers=day.matches.concat(day.practice,day.activities.filter(function(event){return !event.holidayReference;})).map(function(event){
      return {event:event,value:attendanceValue(event,person,day)};
    });
    for(var value of ["attending","absent","maybe"]){
      var answer=answers.find(function(item){
        return item.value===value&&(value!=="absent"||item.event.kind!=="match");
      });
      if(answer)return answer;
    }
    return {value:""};
  }

  function dayButton(day,person){
    if(audience==="coaches"){
      var mark=coachDayMark(day,person);
      var category=mark.event?.kind==="match"?(mark.event.category||"試合"):"";
      var label=mark.event?(category||eventKindLabel(mark.event))+" "+answerMark(mark.value):"出欠を確認";
      return '<button type="button" class="board-mark editable day-answer" data-answer-date="'+esc(day.date)+
        '" data-answer-person="'+esc(person.id)+'" data-value="'+esc(mark.value)+'" aria-label="'+
        esc(person.name+" "+dateLabel(day.date)+" "+label+"。出欠を入力")+'">'+
        attendanceMark(mark.value)+(category?'<span class="coach-mark-category">'+esc(category)+'</span>':"")+'</button>';
    }
    var practiceEvents=day.practice.filter(function(event){return canAnswer(event,person,day);});
    var activities=day.activities.filter(function(event){return !event.holidayReference&&canAnswer(event,person,day);});
    var practice=practiceEvents.map(function(event){return attendanceValue(event,person,day);}).filter(Boolean);
    var activityValues=activities.map(function(event){return answerValue(event,person);}).filter(Boolean);
    var activityMarks=activityValues.map(answerMark).join(" ");
    var eligible=day.matches.filter(function(event){return !eligibility(event,person);});
    var answered=eligible.map(function(event){
      return {label:event.category||"試合",value:answerValue(event,person)};
    }).filter(function(answer){return answer.value;});
    var badges=answered.map(function(answer){
      return '<span class="day-match-chip" data-value="'+esc(answer.value)+'">'+
        attendanceMark(answer.value)+esc(answer.label)+'</span>';
    }).join("");
    var marks=practice.map(answerMark).join(" ");
    var practiceSymbols=practice.map(attendanceMark).join(" ");
    var review=eligible.some(function(match){return needsMatchReview(match,person,day);});
    var reviewBadge=review?'<span class="board-review">要確認</span>':"";
    if(!practiceEvents.length&&!activities.length&&!eligible.length){
      var restrictions=day.matches.map(function(event){return eligibility(event,person);});
      var reason=restrictions.includes("招集対象外")?"招集対象外":restrictions.includes("対象学年未設定")?"対象学年未設定":restrictions.includes("対象要確認")?"対象要確認":"対象外";
      return '<span class="board-ineligible">'+reason+'</span>';
    }
    var description=(marks?"練習 "+marks:"")+(activityMarks?" 行事 "+activityMarks:"")+(answered.length?" "+answered.map(function(answer){return answer.label+" "+answerMark(answer.value);}).join("、"):"");
    var cycle=deviceMode&&dayEvents(day).length===1&&day.practice.length===1;
    var style=cycle?"board-mark editable":"board-mark editable day-answer";
    return '<button type="button" class="'+style+'" data-answer-date="'+esc(day.date)+'" data-answer-person="'+esc(person.id)+
      '" data-value="'+esc(practice[0]||"")+'" aria-label="'+esc(person.name+" "+dateLabel(day.date)+" "+(review?"要確認。":"")+(description.trim()||"未回答")+(cycle?"。タップで回答を切り替え":"。出欠を入力"))+'">'+
      (dayEvents(day).length===1&&day.practice.length===1?practiceSymbols:
        (marks?'<span class="day-practice-mark">'+practiceSymbols+'</span>':"")+
        (activityMarks?'<span class="day-practice-mark">'+activityValues.map(attendanceMark).join(" ")+'</span>':"")+reviewBadge+badges)+'</button>';
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
  function updateSeasonInputs(){
    var form=$("year-end-form");
    form.elements.start.value=seasonPeriod?.start||"";
    form.elements.end.value=seasonPeriod?.end||"";
  }

  function applySeasonPeriod(period){
    var previous=seasonPeriod;
    seasonPeriod=validSeasonPeriod(period);
    try{localStorage.setItem(SEASON_CACHE,JSON.stringify(seasonPeriod));}catch(error){}
    if(previous?.start!==seasonPeriod?.start||previous?.end!==seasonPeriod?.end||!seasonReady)updateSeasonInputs();
    seasonReady=true;
    $("year-end-save").disabled=savingSeason;
    $("year-end-status").textContent=seasonPeriod?"設定中："+dateLabel(seasonPeriod.start)+"〜"+dateLabel(seasonPeriod.end):"特別期間は未設定です。";
    renderEventList();renderResponse(true);refreshSharedMatchSummary();refreshCsvIfOpen();
    renderCalendarSyncStatus();
  }

  async function saveSeasonPeriod(event){
    event.preventDefault();
    if(!seasonReady||savingSeason)return;
    var fields=event.currentTarget.elements;
    var input={start:fields.start.value,end:fields.end.value};
    var period=validSeasonPeriod(input);
    var status=$("year-end-status");
    if(!period&&(input.start||input.end)){
      status.textContent="開始日と終了日を入力し、終了日は開始日以降にしてください。";
      return;
    }
    savingSeason=true;
    $("year-end-save").disabled=true;
    fields.start.disabled=fields.end.disabled=true;
    status.textContent="設定を保存中…";
    try{
      await sharedStore.season.save(period);
      applySeasonPeriod(period);
    }catch(error){
      status.textContent="設定をクラウドに保存できませんでした。入力は残っています。";
    }finally{
      savingSeason=false;
      fields.start.disabled=fields.end.disabled=false;
      $("year-end-save").disabled=!seasonReady;
    }
  }

  function startSharedAttendance(){
    import("./attendance-open-store.mjs?v=20261123-cloud-family1").then(function(module){
      return module.loadOpenAttendance();
    }).then(function(store){
      sharedStore=store;
      if(!calendarView)store.families.listen(function(records){
        familyRecords=records;
        familyDirectoryState="ready";
        familyDirectoryChanged();
      },function(){
        familyDirectoryState="failed";
        familyDirectoryChanged();
      });
      store.eventVisibility.listen(function(records){
        eventVisibility=records;
        visibilityReady=true;
        renderHolidaySettings();renderEventList();renderResponse(true);refreshSharedMatchSummary();refreshCsvIfOpen();
      },function(){
        visibilityReady=false;
        $("event-visibility-status").textContent="予定の受付設定に接続できません。";
        renderEventList();
      });
      store.holidays.listen(function(excluded){
        excludedHolidays=excluded;
        holidaySettingsReady=true;
        $("holiday-attendance-status").textContent="";
        renderHolidaySettings();renderEventList();renderResponse(true);
      },function(message){
        holidaySettingsReady=false;
        $("holiday-attendance-status").textContent="祝日設定に接続できません。";
        renderHolidaySettings();
      });
      store.season.listen(applySeasonPeriod,function(){
        seasonReady=false;
        $("year-end-save").disabled=true;
        $("year-end-status").textContent="年末年始の設定に接続できません。";
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
        $("shared-attendance-status").textContent="出欠を共有しています。";
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
      $("year-end-status").textContent="年末年始の設定に接続できません。";
      renderResponse(true);
    });
  }

  var entryConflicts=new Map();
  function resetEntrySave(form){
    entryConflicts=new Map();
    form.querySelector("[data-entry-status]").textContent="";
    form.querySelector('button[type="submit"]').textContent="回答を保存";
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
    var controls=Array.from(form.elements).filter(function(control){return !control.disabled;});
    controls.forEach(function(control){control.disabled=true;});
    var submit=form.querySelector('button[type="submit"]');
    var priorConflicts=entryConflicts;
    status.textContent="クラウドに保存中…";
    var waiting=setTimeout(function(){
      if(entryConflicts===priorConflicts)status.textContent="クラウドの応答を待っています。入力内容はこの画面に残っています。";
    },6000);
    try{
      var conflicts=await sharedStore.save(audience,personId,updates,note,entryBaseline,priorConflicts);
      if(entryConflicts!==priorConflicts)return false;
      entryConflicts=conflicts;
      if(conflicts.size){
        status.textContent="同じ出欠や連絡事項に別の更新がありました。入力した内容を優先する場合は「入力内容で上書き」を押してください。";
        submit.textContent="入力内容で上書き";
        return false;
      }
      status.textContent="";
      return true;
    }catch(error){
      if(entryConflicts!==priorConflicts)return false;
      var denied=/permission.denied/i.test(error?.code||error?.message||"");
      status.textContent=denied
        ?"クラウドの書き込み権限を確認できませんでした。入力内容はこの画面に残っています。"
        :"一部またはすべての保存を確認できませんでした。入力内容はこの画面に残っています。もう一度保存してください。";
      return false;
    }finally{
      clearTimeout(waiting);
      savingShared=false;
      controls.forEach(function(control){control.disabled=false;});
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
      var value=update.value??previous.value??"";
      if(update.contact===undefined&&(previous.value||"")===value)return;
      var contact=update.contact===undefined?previous.contact: (update.contact||{});
      if(value||contact)replies[personId]={value:value,contact:contact,updatedAt:timestamp};
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
    return event.holidayAvailability?"祝日":event.kind==="match"?"試合":event.kind==="activity"?"行事":"練習";
  }

  function eventName(event){
    return [attendanceEventTitle(event),event.startTime].filter(Boolean).join(" · ");
  }

  function attendanceEventTitle(event){
    var title=scheduleEventTitle(event);
    var category=event.category;
    var titleCategory=title.normalize("NFKC").toUpperCase().match(/\bU(?:[7-9]|1[0-2])\b/g)||[];
    var kind=event.kind==="match"&&category?category+" 試合":eventKindLabel(event);
    if(category&&titleCategory.includes(category))return title;
    if(event.kind!=="match"||title.normalize("NFKC").trim()===kind)return title;
    return [kind,title].filter(Boolean).join(" · ");
  }

  function openDayEntry(day,person,trigger){
    entryBaseline=sharedRows;
    resetEntrySave($("day-entry-form"));
    activeDayEntry={day:day,person:person};
    dayEntryTrigger=trigger;
    $("day-entry-title").innerHTML=calendarLink(day.date,esc(dateLabel(day.date)),"entry-date-link")+"の出欠";
    $("day-entry-person").textContent=person.name;
    $("day-entry-events").innerHTML=renderEntryDay(day,person,false);
    $("day-entry-dialog").showModal();
    $("day-entry-events").parentElement.scrollTop=0;
  }

  function renderEntryDay(day,person,showDate){
    var events=dayEvents(day).filter(function(event){return !event.holidayReference&&canAnswer(event,person,day);});
    if(!events.length)return "";
    return '<section class="entry-day">'+
      (showDate?'<h3>'+calendarLink(day.date,esc(dateLabel(day.date)),"entry-date-link")+'</h3>':"")+
      events.map(function(event){
        var match=event.kind==="match",current=answerValue(event,person);
        var practice=!match&&event.kind!=="activity";
        var title=event.title||eventKindLabel(event);
        var coachPractice=audience==="coaches"&&!match&&event.kind!=="activity"&&day.matches.length>0;
        var practiceLocked=coachPractice&&day.matches.some(function(item){return answerValue(item,person)==="attending";});
        var review=match&&needsMatchReview(event,person,day);
        var choices=ANSWERS.concat({value:"",label:"未回答"});
        return '<article class="response-entry-card '+(match?"is-match":"")+'"'+(review?' data-needs-review="true"':"")+'>'+
          '<div class="entry-card-heading"><span class="entry-kind">'+eventKindLabel(event)+'</span><h4>'+esc(title)+'</h4></div>'+
          (event.startTime||event.descriptionTime||event.place?'<p class="entry-card-meta">'+esc([event.startTime||event.descriptionTime,event.place].filter(Boolean).join(" ・ "))+'</p>':"")+
          (review?'<p class="entry-review"><strong>要確認</strong> 練習に○で回答済みです。試合の出欠を入力してください。</p>':"")+
          (coachPractice?'<p class="entry-review" data-coach-practice-note role="status"'+
            (practiceLocked?"":" hidden")+'><strong>× 不参加</strong> 同じ日の試合に参加するため、練習は自動で不参加になります。</p>':"")+
          '<div class="entry-answer-options" role="group" aria-label="'+esc(title+"の出欠")+'"'+
            (coachPractice?' data-coach-practice'+(practiceLocked?" hidden":""):"")+'>'+choices.map(function(option){
            return '<label><input type="radio" name="answer-'+esc(event.id)+'" value="'+esc(option.value)+'"'+
              (option.value===current?" checked":"")+'><span>'+attendanceMark(option.value)+option.label+'</span></label>';
          }).join("")+'</div>'+
          (match?'<p class="match-optional-note">出欠だけで保存できます。遅刻・早退など、伝えておきたいことがある場合は「連絡事項（任意）」に入力してください。</p>'+
            contactEditor(event,person):(practice||event.holidayAvailability?contactEditor(event,person):""))+
          (event.kind==="activity"&&!event.holidayAvailability?calendarLink(event.date,"カレンダーで行事詳細を開く","secondary-button day-details-action",event.id):matchCalendarAction(event))+'</article>';
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
    return '<details class="match-contact"><summary>連絡事項（任意）'+(Object.keys(note).length?' <span>入力済み</span>':"")+'</summary>'+
      '<input type="hidden" name="contact-'+suffix+'" value="1">'+
      choices.map(function(choice){
        return '<div class="contact-option"><label><input type="checkbox" name="'+choice.key+'-'+suffix+'"'+
          (note[choice.key]?" checked":"")+'>'+choice.label+'</label>'+
          (choice.detail?'<div class="contact-detail">'+choice.detail+'</div>':"")+'</div>';
      }).join("")+
      '<label class="contact-text">補足（任意）<textarea name="message-'+suffix+'" maxlength="160" rows="2" placeholder="例：到着は9:30ごろです">'+esc(note.message||"")+'</textarea></label>'+
      '<small class="contact-help">'+(deviceMode?"連絡事項はこの端末に保存します。":"入力した連絡事項はこの出欠テストにアクセスできる人が閲覧できます。")+'</small></details>';
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

  function updateCoachPracticeOptions(event){
    if(audience!=="coaches"||!event.target.matches('.is-match input[type="radio"]'))return;
    var day=event.target.closest(".entry-day");
    var locked=Boolean(day.querySelector('.is-match input[value="attending"]:checked'));
    day.querySelectorAll("[data-coach-practice]").forEach(function(options){options.hidden=locked;});
    day.querySelectorAll("[data-coach-practice-note]").forEach(function(note){note.hidden=!locked;});
  }

  function readEntryUpdates(form,person,days){
    return days.flatMap(function(day){
      var coachMatch=audience==="coaches"&&day.matches.some(function(match){
        return (form.get("answer-"+match.id)??answerValue(match,person))==="attending";
      });
      return dayEvents(day).flatMap(function(item){
        if(item.holidayReference||!form.has("answer-"+item.id)||!canAnswer(item,person,day))return [];
        var contact=readMatchContact(form,item.id);
        var locked=coachMatch&&day.practice.includes(item);
        if(locked&&contact===undefined)return [];
        return [{id:item.id,value:locked?undefined:form.get("answer-"+item.id),contact:contact}];
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
    refreshMatchDetail();
    if(!$("match-summary-dialog").open||!activeMatchSummary)return;
    var summary=activeMatchSummary;
    var current=getBoardEvents().filter(function(event){return event.kind==="match";});
    if(!current.length){$("match-summary-dialog").close();return;}
    var matches=current.filter(function(event){
      return event.date===summary.day.date&&(!summary.category||matchCategory(event)===summary.category);
    });
    if(matches.length!==summary.day.matches.length||matches.some(function(event,index){return event.id!==summary.day.matches[index].id;})){
      openMatchSummary(summary.day.date,summary.category);return;
    }
    $("match-summary-list").querySelectorAll("[data-target-event]").forEach(function(section){
      var event=summary.day.matches.find(function(match){return match.id===section.dataset.targetEvent;});
      if(!event)return;
      section.querySelector(".preview-match-count").innerHTML=matchCountLabel(countAnswers([event],summary.people));
      var targetNote=section.querySelector(".match-target-note");
      if(targetNote)targetNote.textContent=matchTargetLabel(event);
    });
  }

  function matchTargetLabel(event){
    var grades=targetGrades(event);
    var individual=members.filter(function(person){
      return recruitmentDecision(event,person)==="include"&&!eligibility(event,person,"players");
    }).length;
    return (grades?"対象学年 "+grades.join("・"):"対象学年未設定")+(isGirlsMatch(event)?"／女子のみ":"")+
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
    recruitmentEdit={event:event,revision:record?.revision||0,initial:new Map(),draft:new Map()};
    $("recruitment-event").textContent=dateLabel(event.date)+" "+eventName(event);
    $("recruitment-search").value="";
    $("recruitment-save-status").textContent="";
    $("recruitment-members").innerHTML=members.map(function(person){
      var decision=recruitmentDecision(event,person);
      var restriction=matchRestriction(event,person,"default");
      var base=!restriction;
      var answer=answerValue(event,person,"players");
      var hasRecord=Boolean(answer||matchComment(matchContact(event.id,person.id,"players")));
      recruitmentEdit.initial.set(person.id,decision);
      var alternate=base?"exclude":"include";
      var genderRestriction=matchGenderRestriction(event,person);
      var options=[["default",base?"対象済み":restriction]];
      if(!genderRestriction)options.push([alternate,base?"招集しない":"個別招集"]);
      if(!options.some(function(option){return option[0]===decision;})){
        options.push([decision,decision==="include"?(genderRestriction?"個別招集（対象外）":"個別招集"):"招集しない"]);
      }
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
    function total(decisions){
      return members.filter(function(person){
        return !matchRestriction(edit.event,person,decisions.get(person.id));
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
    var recordedRemoval=members.some(function(person){
      if(!edit.draft.has(person.id))return false;
      var next=edit.draft.get(person.id);
      return matchRestriction(edit.event,person,next)&&
        (answerValue(edit.event,person,"players")||matchComment(matchContact(edit.event.id,person.id,"players")));
    });
    if(recordedRemoval&&!confirm("対象から外す団員に回答または連絡事項があります。記録は保存したまま、集計から外しますか？"))return;
    savingRecruitment=true;
    $("recruitment-close").disabled=true;
    updateRecruitmentCount();
    $("recruitment-save-status").textContent="保存中…";
    var saved;
    try{
      saved=await sharedStore.recruitment.save(edit.event.id,new Map(edit.draft),edit.revision);
    }catch(error){
      var code=error?.code||error?.message||"";
      $("recruitment-save-status").textContent=code==="recruitment-conflict"?
        "別の端末で招集が変更されました。最新の内容を確認してから、再度選択してください。":
        /permission.denied/i.test(code)?"クラウドの書き込み権限を確認できません。選択内容はこの画面に残っています。":
          "招集の保存を確認できませんでした。選択内容はこの画面に残っています。もう一度保存してください。";
      return;
    }finally{
      savingRecruitment=false;
      $("recruitment-close").disabled=false;
      updateRecruitmentCount();
    }
    if((recruitmentRows.get(edit.event.id)?.revision||0)<saved.revision)recruitmentRows.set(edit.event.id,saved);
    $("recruitment-dialog").close();
    renderEventList();
    renderResponse(true);
    refreshSharedMatchSummary();
    announceSave("招集をクラウドに保存しました。");
  }

  function openMatchSummary(date,category){
    var days=groupBoardDays(getBoardEvents()).filter(function(day){return day.matches.length;});
    var day=days.find(function(item){return item.date===date;})||days[0];
    if(!day)return;
    var people=getPeople();
    if(category){
      var filtered=day.matches.filter(function(event){return matchCategory(event)===category;});
      if(filtered.length){
        day={...day,matches:filtered};
        people=filterPeopleByGrade(people);
      }else category="";
    }
    activeMatchSummary={day:day,people:people,category:category||""};
    $("match-summary-title").textContent=category?category+"の試合集計":"試合集計";
    var select=$("match-summary-date");
    select.innerHTML=days.map(function(item){
      return '<option value="'+esc(item.date)+'">'+esc(compactDate(item.date))+' · '+item.matches.length+'試合</option>';
    }).join("");
    select.value=day.date;
    $("match-summary-list").innerHTML=day.matches.map(function(event){
      var grades=targetGrades(event);
      return '<section class="match-summary-event" data-target-event="'+esc(event.id)+'"><h3>'+esc(eventName(event))+'</h3>'+
        '<div class="preview-match-count">'+matchCountLabel(countAnswers([event],people))+'</div>'+
        (audience==="coaches"?"":'<div class="match-target-note">'+esc(matchTargetLabel(event))+'</div>')+
        '<button type="button" class="secondary-button day-details-action" data-match-detail="'+esc(event.id)+'">出欠一覧を開く</button>'+
        (audience==="coaches"?targetGradeEditor(event,grades):"")+'</section>';
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

  function detailChoices(day,kind,category){
    return kind==="match"?day.matches.filter(function(event){return !category||matchCategory(event)===category;}):day.practice;
  }

  function refreshMatchDetail(){
    var detail=activeAttendanceDetail;
    if(!detail)return;
    var day=groupBoardDays(getBoardEvents().filter(function(event){return event.date===detail.date;}))[0];
    var events=day?detailChoices(day,detail.kind,detail.category):[];
    if(detail.eventId)events=events.filter(function(event){return event.id===detail.eventId;});
    if(!events.length){$("match-detail-dialog").close();return;}
    var event=events.length===1?events[0]:null;
    var match=event?.kind==="match";
    $("match-detail-date").textContent=dateLabel(detail.date);
    $("match-detail-tabs").hidden=!match;
    $("match-detail-recruit-tab").disabled=deviceMode||!recruitmentReady||!members.length;
    $("match-detail-choices").hidden=Boolean(event);
    $("match-detail-title").textContent=event?attendanceEventTitle(event):"出欠を確認する予定を選択";
    if(!event){
      $("match-detail-choices").innerHTML=events.map(function(item){
        return '<button type="button" class="secondary-button" data-detail-choice="'+esc(item.id)+'">'+
          esc([item.startTime||item.descriptionTime,attendanceEventTitle(item)].filter(Boolean).join(" · "))+'</button>';
      }).join("");
      $("match-detail-attendance").hidden=true;
      $("match-detail-info").hidden=true;
      $("match-detail-return").hidden=true;
      return;
    }
    detail.eventId=event.id;
    var showInfo=match&&detail.showInfo;
    $("match-detail-info").hidden=!showInfo;
    $("match-detail-attendance").hidden=showInfo;
    $("match-detail-return").hidden=!showInfo;
    $("match-detail-info-tab").setAttribute("aria-expanded",String(showInfo));
    if(showInfo){
      $("match-detail-info").innerHTML=matchDetailInfo(event);
      return;
    }
    var table=function(group,people){
      people=people.filter(function(person){return !responseRestriction(event,person,day,group);});
      return people.length?matchAttendanceTable(event,people,group,day):"<p>対象者がいません。</p>";
    };
    var current=getPeople();
    if(detail.board&&audience==="players")current=filterPeopleByGrade(current);
    $("match-detail-attendance").innerHTML=match&&audience==="coaches"?
      '<h3>コーチの出欠</h3>'+table("coaches",current)+'<h3>団員の出欠</h3>'+table("players",members):
      table(audience,current);
  }

  function openAttendanceDetail(date,kind,category,eventId,trigger){
    activeAttendanceDetail={date:date,kind:kind,category:category,eventId:eventId,trigger:trigger,
      board:Boolean(trigger?.matches("[data-practice-date], [data-match-date]")),showInfo:false};
    $("match-detail-dialog").showModal();
    refreshMatchDetail();
    $("match-detail-scroll").scrollTop=0;
  }

  function matchAttendanceTable(event,people,group,day){
    var answers=ANSWERS.concat({value:"",label:"未回答"});
    var totals=(group==="coaches"?ANSWERS:answers).map(function(answer){
      var count=people.filter(function(person){return attendanceValue(event,person,day,group)===answer.value;}).length;
      return '<tr class="match-attendance-total"><th scope="row">'+esc((answerMark(answer.value)+" "+answer.label).trim())+
        '</th><td>'+count+'人</td><td></td></tr>';
    }).join("");
    var rows=people.map(function(person){
      var value=attendanceValue(event,person,day,group);
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

  function calendarAttendanceSelection(day,id){
    if(!day)return;
    var event=dayEvents(day).find(function(item){return item.id===id;});
    if(event||isSeasonDate(day.date))return event;
    // Outside the special schedule, ordinary whole-team practices share the date record.
    var practices=syncedCalendarEvents.filter(function(item){
      return item.date===day.date&&item.kind==="practice"&&item.calendarLabel==="全体"&&!calendarMatchUnavailable(item);
    });
    if(practices.length===1&&practices[0].id===id&&!manuallyExcluded(practices[0])){
      return day.practice.find(function(item){return item.id==="day_"+day.date;});
    }
  }

  function renderCalendarAttendance(){
    var status=$("calendar-attendance-status"), rows=$("calendar-attendance-people");
    var date=calendarView.date;
    if(!calendarView.id||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<todayISO()||date>maxDate()){
      status.textContent="この予定は現在の出欠確認の対象期間外です。";
      return;
    }
    if(!calendarMatchesChecked||!sharedReady||!visibilityReady||!seasonReady||
      !staffCoachesReady||!rosterState.startsWith("名簿から")){
      rows.replaceChildren();
      status.textContent=calendarView.delayed?"出欠の読み込みに時間がかかっています。閉じてから開き直してください。":"出欠を読み込み中です。";
      return;
    }
    var day=groupBoardDays(getBoardEvents().filter(function(event){return event.date===date;}))[0];
    var event=calendarAttendanceSelection(day,calendarView.id);
    if(!event){
      rows.replaceChildren();
      $("calendar-attendance-title").textContent="出欠一覧";
      status.textContent=calendarSyncResult?.failed.length?
        "一部の予定を取得できませんでした。予定の取得後にもう一度開いてください。":
        "この予定の出欠は集計していません。";
      return;
    }
    if(event.kind==="match"&&!recruitmentReady){
      rows.replaceChildren();
      status.textContent=calendarView.delayed?"招集情報を読み込めません。閉じてから開き直してください。":"招集情報を読み込み中です。";
      return;
    }
    $("calendar-attendance-title").textContent=attendanceEventTitle(event)+"の出欠一覧";
    status.textContent=dateLabel(date);
    rows.innerHTML=["players","coaches"].map(function(group){
      var people=getPeople(group).filter(function(person){return !responseRestriction(event,person,day,group);});
      return "<section><h2>"+(group==="players"?"団員":"コーチ")+"</h2>"+
        (people.length?matchAttendanceTable(event,people,group,day):"<p>対象者がいません。</p>")+"</section>";
    }).join("");
  }

  function renderResponse(preserveScroll){
    if(calendarView){renderCalendarAttendance();return;}
    var panel=$("response-panel"),rows=$("response-list"),oldBoard=rows.querySelector(".attendance-board-scroll");
    var savedTop=preserveScroll&&oldBoard?oldBoard.scrollTop:0,savedLeft=preserveScroll&&oldBoard?oldBoard.scrollLeft:0;
    var people=getPeople(),days=groupBoardDays(getBoardEvents());
    $("board-toolbar").hidden=true;
    panel.hidden=false;
    $("response-title").textContent="参加予定【"+(audience==="players"?"団員用":"コーチ用")+"】";
    $("attendance-guide-name").textContent=audience==="players"?"お子さんの名前":"ご自身の名前";
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
      people=filterPeopleByGrade(people);
    }
    $("respondent-count").textContent=audience==="coaches"?"":people.length+"名";
    $("respondent-count").hidden=audience==="coaches";
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
    var categoriesByDate=new Map(days.map(function(day){return [day.date,matchCategories(day.matches)];}));
    if(transposeBoard){
      head='<thead><tr><th class="event-col" scope="col">日付</th>'+people.map(function(person){
        return '<th class="rotated-person" scope="col">'+boardPersonName(person)+'</th>';
      }).join("")+'</tr></thead><tbody>';
      body=days.map(function(day){
        var categoryRows=Array.from(categoriesByDate.get(day.date),function(entry){
          return '<div class="category-count-transposed"><span>'+esc(entry[0])+'</span>'+
            categoryCountButton(day,entry[0],entry[1],people)+'</div>';
        }).join("");
        return '<tr><th class="event-col" scope="row" data-board-date="'+esc(day.date)+'">'+dayHeading(day,people)+activityCountButtons(day,people)+categoryRows+'</th>'+
          people.map(function(person){return '<td>'+dayButton(day,person)+'</td>';}).join("")+'</tr>';
      }).join("");
    }else{
      head='<thead><tr><th class="person-col" scope="col">参加者</th>'+days.map(function(day){
        return '<th scope="col" data-board-date="'+esc(day.date)+'">'+dayHeading(day,people)+'</th>';
      }).join("")+'</tr></thead><tbody>';
      body=activitySummaryRow(days,people)+categorySummaryRows(days,categoriesByDate,people)+people.map(function(person){
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
    // iOS: keep horizontal position stable when the gesture starts on the
    // sticky name column. Vertical scrolling remains native for both columns.
    var lockLeft=null,unlockNameGesture=function(){lockLeft=null;};
    newBoard.addEventListener("touchstart",function(event){
      lockLeft=event.target.closest("th.person-col,th.event-col")?newBoard.scrollLeft:null;
    },{passive:true});
    newBoard.addEventListener("touchmove",function(){
      if(lockLeft!==null&&newBoard.scrollLeft!==lockLeft)newBoard.scrollLeft=lockLeft;
    },{passive:true});
    newBoard.addEventListener("scroll",function(){
      if(lockLeft!==null&&newBoard.scrollLeft!==lockLeft)newBoard.scrollLeft=lockLeft;
    },{passive:true});
    newBoard.addEventListener("touchend",unlockNameGesture,{passive:true});
    newBoard.addEventListener("touchcancel",unlockNameGesture,{passive:true});
    var daysByDate=new Map(days.map(function(day){return [day.date,day];}));
    var peopleById=new Map(people.map(function(person){return [person.id,person];}));
    rows.querySelectorAll("[data-edit-person]").forEach(function(btn){
      btn.addEventListener("click",function(){
        enterSelectedPerson(btn.dataset.editPerson);
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
    rows.querySelectorAll("[data-activity-summary]").forEach(function(btn){
      btn.addEventListener("click",function(){
        var activity=getBoardEvents().find(function(event){return event.id===btn.dataset.activitySummary;});
        if(activity)showSavedEvent(activity);
      });
    });
    rows.querySelectorAll("[data-practice-date], [data-match-date]").forEach(function(btn){
      btn.addEventListener("click",function(){
        var date=btn.dataset.practiceDate||btn.dataset.matchDate;
        openAttendanceDetail(date,btn.dataset.practiceDate?"practice":"match",btn.dataset.matchCategory,"",btn);
      });
    });
    rows.querySelectorAll("[data-edit-coach]").forEach(function(btn){btn.addEventListener("click",function(){var coach=state.coaches.find(function(c){return c.id===btn.dataset.editCoach;});if(!coach)return;var name=prompt("コーチ名を入力してください",coach.name);if(name!==null&&name.trim()){coach.name=name.trim();saveState();render();}});});rows.querySelectorAll("[data-remove-coach]").forEach(function(btn){btn.addEventListener("click",function(){var coach=state.coaches.find(function(c){return c.id===btn.dataset.removeCoach;});if(coach&&confirm(coach.name+"さんを試作リストから削除しますか？")){state.coaches=state.coaches.filter(function(c){return c.id!==coach.id;});saveState();render();}});});
  }

  var FAMILY_KEY="yoshimi_smc_family_entry_v1";
  var family=null, familyRecords=new Map(), familyDirectoryState="loading";

  function familyIds(record){return new Set(typeof record?.members==="string"?record.members.split("\n").filter(Boolean):[]);}

  function familyKey(group,id){return group+":"+id;}

  function selectedFamily(){
    try{
      var ids=JSON.parse(localStorage.getItem(FAMILY_KEY)||"[]");
      return new Set(Array.isArray(ids)?ids:[]);
    }catch(error){return new Set();}
  }

  function familyRoster(){
    return ["players","coaches"].flatMap(function(group){
      return getPeople(group).map(function(person){return {group:group,person:person,key:familyKey(group,person.id)};});
    });
  }

  function inFamilyGroup(group,action){
    var previous=audience;
    audience=group;
    try{return action();}
    finally{audience=previous;}
  }

  function familyLabel(member){
    return [member.group==="coaches"?"コーチ":member.person.grade,member.person.name].filter(Boolean).join(" ");
  }

  function renderFamilyPicker(){
    var area=$("family-picker-people");
    var checked=family.id?familyIds(family.record):selectedFamily();
    area.querySelectorAll("input[name=family-person]").forEach(function(input){
      if(input.checked)checked.add(input.value);
      else checked.delete(input.value);
    });
    var roster=familyRoster();
    $("family-clear-people").hidden=!family.record;
    $("family-picker-save").disabled=familyDirectoryState!=="ready"||!staffCoachesReady||
      !rosterState.startsWith("名簿から");
    $("family-clear-people").disabled=$("family-picker-save").disabled;
    area.innerHTML=["players","coaches"].map(function(group){
      var people=roster.filter(function(member){return member.group===group;});
      return '<fieldset><legend>'+(group==="players"?"団員":"コーチ")+'</legend>'+
        (people.map(function(member){
          return '<label><input type="checkbox" name="family-person" value="'+esc(member.key)+'"'+
            (checked.has(member.key)?" checked":"")+'><span>'+esc(familyLabel(member))+'</span></label>';
        }).join("")||'<p class="small-note">名簿を確認中です。</p>')+'</fieldset>';
    }).join("");
  }

  function familyControlData(section){
    var data=new FormData();
    section.querySelectorAll("[data-family-field]").forEach(function(field){
      if(field.disabled||(["radio","checkbox"].includes(field.type)&&!field.checked))return;
      data.append(field.dataset.familyField,field.value);
    });
    return data;
  }

  function familyUpdates(section,member,day){
    return inFamilyGroup(member.group,function(){
      return readEntryUpdates(familyControlData(section),member.person,[day]);
    });
  }

  function familyChanged(update,baseline){
    if(update.value!==undefined&&(baseline?.value||"")!==update.value)return true;
    if(update.contact===undefined)return false;
    var old=baseline?.contact||{},next=update.contact||{};
    return Object.keys(old).length!==Object.keys(next).length||Object.keys(next).some(function(key){return old[key]!==next[key];});
  }

  function familyBulkCandidates(eventId){
    return family.members.flatMap(function(member,index){
      var section=$("family-entries").children[index];
      var inputs=Array.from(section.querySelectorAll('input[type="radio"]')).filter(function(input){
        return input.dataset.familyField==="answer-"+eventId&&!input.closest("[data-coach-practice][hidden]");
      });
      return inputs.length?[{member:member,inputs:inputs}]:[];
    });
  }

  function renderFamilyBulk(){
    $("family-bulk-actions").innerHTML=dayEvents(family.day).filter(function(event){return !event.holidayReference;}).map(function(event){
      var candidates=familyBulkCandidates(event.id);
      if(candidates.length<2)return "";
      return '<section class="family-bulk-event"><strong>'+esc(scheduleEventTitle(event))+'</strong><p>'+
        esc(candidates.map(function(item){return familyLabel(item.member);}).join("・"))+'</p>'+
        ANSWERS.map(function(answer){
          return '<button type="button" class="secondary-button" data-family-event="'+esc(event.id)+'" data-family-value="'+
            esc(answer.value)+'">まとめて'+answerMark(answer.value)+'</button>';
        }).join(" ")+'</section>';
    }).join("");
  }

  function renderFamilyDay(){
    var select=$("family-date");
    var days=groupBoardDays(getBoardEvents());
    family.day=days.find(function(day){return day.date===select.value;})||days[0];
    family.baseline=sharedRows;
    family.confirmed=new Map();
    family.dirty=false;
    $("family-status").textContent="";
    $("family-entries").innerHTML="";
    $("family-bulk-actions").innerHTML="";
    $("family-save").disabled=!family.day;
    if(!family.day){$("family-status").textContent="入力できる予定がありません。";return;}
    select.value=family.day.date;
    family.members.forEach(function(member,index){
      var section=document.createElement("section");
      section.className="family-person";
      section.innerHTML='<h3>'+esc(familyLabel(member))+'</h3>'+inFamilyGroup(member.group,function(){
        return renderEntryDay(family.day,member.person,false)||'<p class="small-note">対象の予定はありません。</p>';
      });
      section.querySelectorAll("[name]").forEach(function(input){
        input.dataset.familyField=input.name;
        input.name="family-"+index+"-"+input.name;
      });
      section.addEventListener("change",function(event){
        family.dirty=true;
        if(member.group==="coaches"&&event.target.matches('.is-match input[type="radio"]')){
          inFamilyGroup(member.group,function(){updateCoachPracticeOptions(event);});
          renderFamilyBulk();
        }
      });
      section.addEventListener("input",function(){family.dirty=true;});
      $("family-entries").append(section);
    });
    renderFamilyBulk();
  }

  function showFamilyEntry(ids){
    family.members=familyRoster().filter(function(member){return ids.has(member.key);});
    var showEntry=family.members.length>0;
    $("family-picker").hidden=showEntry;
    $("family-entry").hidden=!showEntry;
    $("family-save").hidden=!showEntry;
    if(!showEntry){renderFamilyPicker();return;}
    $("family-date").innerHTML=groupBoardDays(getBoardEvents()).map(function(day){
      return '<option value="'+esc(day.date)+'">'+esc(dateLabel(day.date))+'</option>';
    }).join("");
    renderFamilyDay();
  }

  function enterSelectedPerson(personId){
    if(!requireSharedConnection())return;
    var key=familyKey(audience,personId);
    var roster=familyRoster();
    var choices=[...familyRecords].filter(function(item){return familyIds(item[1]).has(key);})
      .map(function(item){
        var ids=familyIds(item[1]);
        return {id:item[0],names:roster.filter(function(member){return ids.has(member.key);}).map(familyLabel)};
      }).filter(function(item){return item.names.length>=2;});
    if(familyDirectoryState!=="ready"||!choices.length){openAttendanceForm(personId);return;}
    var dialog=$("family-choice-dialog"), actions=$("family-choice-actions");
    $("family-choice-person").textContent=getPeople().find(function(person){return person.id===personId;})?.name||"";
    actions.replaceChildren();
    function addChoice(label,description,action){
      var button=document.createElement("button");
      button.type="button";
      button.className="secondary-button";
      button.textContent=label;
      if(description){
        var names=document.createElement("span");
        names.textContent=description;
        button.append(names);
      }
      button.onclick=function(){
        dialog.close();
        action();
      };
      actions.append(button);
    }
    addChoice("この人だけ入力","",function(){openAttendanceForm(personId);});
    choices.forEach(function(choice){
      addChoice("家族まとめて入力",choice.names.join("・"),function(){openFamilyEntry(choice.id);});
    });
    dialog.showModal();
  }

  function familyDirectoryChanged(){
    if(!$("family-entry-dialog").open||$("family-picker").hidden||family.saving)return;
    renderFamilyPicker();
    if(familyDirectoryState==="failed")$("family-status").textContent="家族登録に接続できません。時間をおいて開き直してください。";
    else if(familyDirectoryState==="ready"&&staffCoachesReady&&rosterState.startsWith("名簿から")&&
      $("family-status").dataset.loading==="true"){
      $("family-status").textContent="";
      delete $("family-status").dataset.loading;
    }
  }

  function openFamilyEntry(id){
    if(!requireSharedConnection())return;
    var record=id?familyRecords.get(id):null;
    if(id&&!record){
      openFamilyEntry();
      $("family-status").textContent="この家族登録は解除されています。";
      return;
    }
    family={id:id||"",record:record,members:[],dirty:false,saving:false};
    $("family-picker-people").replaceChildren();
    var status=$("family-status");
    status.textContent="";
    delete status.dataset.loading;
    $("family-entry-dialog").showModal();
    if(record){showFamilyEntry(familyIds(record));return;}
    showFamilyEntry(new Set());
    if($("family-picker-save").disabled){
      status.dataset.loading="true";
      status.textContent="名簿と家族登録を確認しています。";
    }
    familyDirectoryChanged();
  }

  async function saveFamilyRegistration(remove){
    if(family.saving||$("family-picker-save").disabled)return;
    var ids=new Set(new FormData($("family-picker")).getAll("family-person"));
    if(!remove&&ids.size<2){
      $("family-status").textContent="家族の名前を2人以上選んでください。";
      return;
    }
    if(remove&&!confirm("この家族登録を解除しますか？保存済みの出欠は引き続き表示されます。"))return;
    var matching=!family.record&&!remove&&[...familyRecords].find(function(item){
      var existing=familyIds(item[1]);
      return existing.size===ids.size&&[...ids].every(function(id){return existing.has(id);});
    });
    if(matching){
      family.id=matching[0];
      family.record=matching[1];
      showFamilyEntry(ids);
      $("family-status").textContent="登録済みの家族を開きました。";
      return;
    }
    family.id=family.id||sharedStore.families.newId();
    family.saving=true;
    var controls=[...$("family-picker").querySelectorAll("button,input"),$("family-close")].filter(function(control){return !control.disabled;});
    controls.forEach(function(control){control.disabled=true;});
    $("family-status").textContent="クラウドに保存しています…";
    try{
      family.record=await sharedStore.families.save(family.id,remove?[]:ids,family.record?.revision||0);
      if(remove){
        familyRecords.delete(family.id);
        family.id="";
      }else{
        familyRecords.set(family.id,family.record);
        showFamilyEntry(ids);
      }
      try{localStorage.removeItem(FAMILY_KEY);}catch(error){}
      $("family-status").textContent=remove?"家族登録を解除しました。":"家族をクラウドに登録しました。";
    }catch(error){
      if(error.message==="family-conflict"){
        family.record=familyRecords.get(family.id)||null;
        $("family-status").textContent="別の端末で家族登録が変更されました。閉じて、登録を開き直してください。";
        controls=controls.filter(function(control){return control.id==="family-close";});
      }else $("family-status").textContent="家族をクラウドに保存できませんでした。通信状況を確認し、もう一度お試しください。";
    }finally{
      family.saving=false;
      controls.forEach(function(control){control.disabled=false;});
      if(remove&&family.record===null){
        $("family-picker-people").replaceChildren();
        renderFamilyPicker();
      }
    }
  }

  function familyCanDiscard(){
    return !family?.saving&&(!family?.dirty||confirm("保存していない家族分の入力を破棄しますか？"));
  }

  function applyFamilyBulk(button){
    var value=button.dataset.familyValue;
    var candidates=familyBulkCandidates(button.dataset.familyEvent);
    var changed=candidates.filter(function(item){return item.inputs.find(function(input){return input.checked;})?.value!==value;});
    if(changed.length&&!confirm(changed.map(function(item){return familyLabel(item.member);}).join("・")+
      " の回答を "+answerMark(value)+" にしますか？"))return;
    changed.forEach(function(item){
      var radio=item.inputs.find(function(input){return input.value===value;});
      radio.checked=true;
      radio.dispatchEvent(new Event("change",{bubbles:true}));
    });
  }

  async function saveFamily(){
    if(!family?.day||family.saving||savingShared||!sharedReady)return;
    var currentDay=groupBoardDays(getBoardEvents()).find(function(day){return day.date===family.day.date;});
    var status=$("family-status");
    var activeEvents=currentDay&&dayEvents(currentDay).filter(function(event){return !event.holidayReference;});
    var originalEvents=dayEvents(family.day).filter(function(event){return !event.holidayReference;});
    if(!activeEvents||originalEvents.some(function(event){return !activeEvents.some(function(item){return item.id===event.id;});})){
      status.textContent="予定が変更されました。入力はこの画面に残っています。最新の予定を出欠表で確認してください。";
      return;
    }
    var jobs=family.members.flatMap(function(member,index){
      var section=$("family-entries").children[index];
      return familyUpdates(section,member,currentDay).flatMap(function(update){
        var key=sharedStore.key(update.id,member.group,member.person.id);
        return familyChanged(update,family.baseline.get(key))?[{member:member,key:key,update:update}]:[];
      });
    });
    if(!jobs.length){status.textContent="変更した回答はありません。";return;}
    if(family.confirmed.size&&!confirm("前回確認した別の端末の変更を、今回の入力で上書きしますか？"))return;
    family.saving=true;
    var controls=Array.from($("family-entry-dialog").querySelectorAll("button,input,select,textarea"))
      .filter(function(input){return !input.disabled;});
    controls.forEach(function(input){input.disabled=true;});
    status.textContent="家族分の回答を保存中…";
    var results=await Promise.allSettled(jobs.map(function(job){
      return sharedStore.save(job.member.group,job.member.person.id,[job.update],undefined,family.baseline,family.confirmed);
    }));
    var failed=[],conflicts=new Map();
    family.baseline=new Map(family.baseline);
    results.forEach(function(result,index){
      var job=jobs[index];
      if(result.status==="fulfilled"&&!result.value.size){
        var previous=family.baseline.get(job.key)||{};
        family.baseline.set(job.key,{...previous,
          value:job.update.value??previous.value,contact:job.update.contact===undefined?previous.contact:job.update.contact});
        return;
      }
      var title=dayEvents(currentDay).find(function(event){return event.id===job.update.id;});
      failed.push(familyLabel(job.member)+"｜"+scheduleEventTitle(title)+(result.status==="fulfilled"?"（別の端末で変更あり）":"（保存できませんでした）"));
      if(result.status==="fulfilled")result.value.forEach(function(fields,key){conflicts.set(key,fields);});
    });
    family.confirmed=conflicts;
    family.saving=false;
    family.dirty=Boolean(failed.length);
    controls.forEach(function(input){input.disabled=false;});
    if(failed.length){
      status.textContent=(jobs.length-failed.length)+"件保存しました。次の入力はこの画面に残っています。\n"+failed.join("\n");
      return;
    }
    $("family-entry-dialog").close();
    renderEventList();renderResponse(true);
    announceSave("家族分の回答をクラウドに保存しました。");
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
    resetEntrySave($("attendance-form"));
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
  function render(){renderHolidaySettings();renderEventList();renderResponse();}
  function addEvent(date){selectedDate=date;if(!selectedDate||selectedDate<todayISO()||selectedDate>maxDate()||!isDefaultDay(selectedDate)){alert("一覧に表示されている対象日を選んでください。");return;}$("dialog-date").textContent=dateLabel(selectedDate)+(holidays[selectedDate]?" · "+holidays[selectedDate]:"");$("event-title").value=fromISO(selectedDate).getDay()===3?"通常練習":fromISO(selectedDate).getDay()===4?"低学年練習":"";$("event-place").value="";$("event-dialog").showModal();}
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
        return {...person,value:attendanceValue(event,person,days.get(event.date),personGroup),updatedAt:answer.updatedAt,contact:contact,contactText:matchComment(contact),
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
    var title=event.title.normalize("NFKC").trim();
    var kind=window.SMCCalendarAttendance.upcomingKind(event);
    var ageGroup=/^U(?:[7-9]|1[0-2])$/.test(event.label);
    var isPractice=!activityTitle&&(event.label==="全体"||ageGroup)&&kind==="practice";
    var newYearActivity=!activityTitle&&!isPractice&&(event.label==="全体"||ageGroup)&&
      (/初蹴り/.test(title)&&!hasMatchTitle(title)||event.kind==="event");
    var wholeTeamGirlsMatch=event.label==="全体"&&isGirlsMatch(event)&&hasMatchTitle(title)&&
      !/会議|総会|説明会|保護者会|審判講習/.test(title);
    var seasonMatch=event.label==="全体"&&!wholeTeamGirlsMatch&&!activityTitle&&!isPractice&&!newYearActivity&&
      (event.kind==="match"||event.kind==="tournament"||hasMatchTitle(title))&&!/会議|総会|説明会|保護者会|審判講習/.test(title);
    if(!activityTitle&&!newYearActivity&&!isPractice&&!wholeTeamGirlsMatch&&!seasonMatch&&!ageGroup)return null;
    var category=(wholeTeamGirlsMatch||seasonMatch)?title.match(/\bU(?:[7-9]|1[0-2])\b/i)?.[0].toUpperCase()||"その他":event.label;
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
      kind:activityTitle||newYearActivity?"activity":isPractice?"practice":"match",
      seasonOnly:isPractice||newYearActivity||seasonMatch,status:event.status,category:category,calendarLabel:event.label,title:displayTitle,place:event.location||"",
      calendarUrl:safeCalendarEventUrl(event.url),
      targetGrades:window.SMCCalendarAttendance.targetGrades(event.description,displayTitle)
    };
  }

  function hasMatchTitle(title){
    return /試合|大会|新人戦|選手権|交流戦|対抗戦|招待|カップ|リーグ|トレマ|フェス|マッチ|\b(?:TM|TRM|CUP|LEAGUE)\b|[vV][sS][.．]/i.test(title);
  }

  function isAutomaticMatch(match){
    var title=match.title.normalize("NFKC");
    return hasMatchTitle(title)||!/練習|トレーニング|会議|総会|説明会|保護者会|審判講習/.test(title);
  }

  function calendarMatchUnavailable(match){
    if(window.SMCCalendarAttendance.upcomingKind(match)==="cancelled")return true;
    var title=match.title.normalize("NFKC");
    if(/^(?:【)?(?:練習|活動|年末年始)?(?:休み|休業|休団)(?:】)?(?:$|[（(\s])/i.test(title))return true;
    if(/予備日/.test(title)&&!(match.kind==="match"&&hasMatchTitle(title)))return true;
    return isWeekend(match.date)&&/運動会|体育祭|^年末年始$|年末年始休|休団|休業|会議|説明会/.test(title);
  }

  function syncCalendarAttendance(matches,restore,failed){
    var events=new Map(state.events.map(function(event){return [event.id,event];}));
    var archived=new Set(state.archive.map(function(event){return event.id;}));
    var resumed=new Set(),changed=false;
    if(failed){
      var received=new Set(matches.filter(function(match){return !calendarMatchUnavailable(match);}).map(function(match){return match.id;}));
      events.forEach(function(event,id){
        if(id.startsWith("calendar_")&&!event.calendarInactive&&!failed.includes(event.calendarLabel||event.category)&&!received.has(id)){
          events.set(id,{...event,calendarInactive:true});
          changed=true;
        }
      });
    }
    matches.forEach(function(match){
      if(calendarMatchUnavailable(match))return;
      var previous=events.get(match.id);
      if(!restore&&!previous&&match.kind==="match"&&!match.seasonOnly&&!isAutomaticMatch(match))return;
      var hidden=previous?.hidden&&!restore;
      if(previous&&!previous.calendarInactive&&Boolean(previous.hidden)===Boolean(hidden)&&
        ["date","startTime","endTime","descriptionTime","description","title","place","category","calendarLabel","calendarUrl","kind","seasonOnly"].every(function(key){return previous[key]===match[key];})&&
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

  function renderCalendarSyncStatus(){
    if(!calendarSyncResult)return;
    var totals={match:0,activity:0,practice:0};
    getBoardEvents().forEach(function(event){if(event.id.startsWith("calendar_")&&Object.hasOwn(totals,event.kind))totals[event.kind]++;});
    var failed=calendarSyncResult.failed;
    $("calendar-sync-status").textContent=!calendarSyncResult.saved?"カレンダーの予定を保存できませんでした。":
      "カレンダー連携："+totals.match+"件の試合"+(totals.activity?"・"+totals.activity+"件の行事":"")+
      (totals.practice?"・"+totals.practice+"件の練習":"")+
      (failed.length?"（"+failed.join("・")+"の取得に失敗。前回取得した予定を表示しています）":"");
  }

  function setupCalendarMatchPicker(){
    var dialog=$("calendar-match-dialog"),list=$("calendar-match-list"),status=$("calendar-match-status");
    var category=$("calendar-match-category"),refresh=$("refresh-calendar-matches"),syncStatus=$("calendar-sync-status");
    var matches=[],failed=[],loading=false,loaded=false;

    function renderMatches(){
      var visible=matches.filter(function(match){return (!match.seasonOnly||isSeasonDate(match.date))&&!calendarMatchUnavailable(match)&&(!category.value||match.category===category.value);});
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
      syncedCalendarEvents=linked;
      var saved=syncCalendarAttendance(linked,false,failed);
      calendarSyncResult={saved:saved,failed:failed};
      renderCalendarSyncStatus();
      renderHolidaySettings();renderEventList();renderResponse(true);
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
    if(calendarView){
      document.body.classList.add("calendar-attendance-embedded");
      $("calendar-attendance-view").hidden=false;
      window.setTimeout(function(){calendarView.delayed=true;renderCalendarAttendance();},12000);
      readRoster();
      readStaffCoaches();
      startSharedAttendance();
      setupCalendarMatchPicker();
      loadHolidays();
      renderCalendarAttendance();
      return;
    }
    updateSeasonInputs();
    $("year-end-form").addEventListener("submit",saveSeasonPeriod);
    $("open-family-entry").addEventListener("click",function(){openFamilyEntry();});
    $("family-picker").addEventListener("submit",function(event){
      event.preventDefault();
      saveFamilyRegistration(false);
    });
    $("family-clear-people").addEventListener("click",function(){saveFamilyRegistration(true);});
    $("family-edit-people").addEventListener("click",function(){
      if(!familyCanDiscard())return;
      family.dirty=false;
      $("family-picker-people").replaceChildren();
      $("family-picker").hidden=false;
      $("family-entry").hidden=true;
      $("family-save").hidden=true;
      $("family-status").textContent="";
      renderFamilyPicker();
    });
    $("family-date").addEventListener("change",function(event){
      if(familyCanDiscard())renderFamilyDay();
      else event.currentTarget.value=family.day.date;
    });
    $("family-bulk-actions").addEventListener("click",function(event){
      var button=event.target.closest("[data-family-event]");
      if(button)applyFamilyBulk(button);
    });
    $("family-save").addEventListener("click",saveFamily);
    $("family-close").addEventListener("click",function(){
      if(familyCanDiscard())$("family-entry-dialog").close();
    });
    $("family-entry-dialog").addEventListener("cancel",function(event){
      if(!familyCanDiscard())event.preventDefault();
    });
    $("event-list-filter").addEventListener("change",renderEventList);
    $("event-visibility-undo").addEventListener("click",function(){
      if(undoVisibility)setEventExclusion(undoVisibility.event,undoVisibility.excluded);
    });
    $("saved-event-dialog").addEventListener("close",function(){viewedEvent=null;});
    $("saved-event-open-board").addEventListener("click",function(){
      if(!viewedEvent)return;
      var id=viewedEvent.id;
      $("saved-event-dialog").close();
      openEvent(id);
    });
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
    $("match-detail-info-tab").addEventListener("click",function(){
      if(!activeAttendanceDetail)return;
      activeAttendanceDetail.showInfo=true;
      refreshMatchDetail();
      $("match-detail-scroll").scrollTop=0;
      $("match-detail-return").focus();
    });
    $("match-detail-return").addEventListener("click",function(){
      if(!activeAttendanceDetail)return;
      activeAttendanceDetail.showInfo=false;
      refreshMatchDetail();
      $("match-detail-scroll").scrollTop=0;
      $("match-detail-info-tab").focus();
    });
    $("match-detail-recruit-tab").addEventListener("click",function(){
      var match=getBoardEvents().find(function(item){return item.id===activeAttendanceDetail?.eventId;});
      if(!match)return;
      activeAttendanceDetail.showInfo=false;
      refreshMatchDetail();
      openRecruitment(match);
    });
    $("match-detail-choices").addEventListener("click",function(event){
      var button=event.target.closest("[data-detail-choice]");
      if(!button||!activeAttendanceDetail)return;
      activeAttendanceDetail.eventId=button.dataset.detailChoice;
      refreshMatchDetail();
      $("match-detail-scroll").scrollTop=0;
      $("match-detail-title").focus();
    });
    $("match-detail-dialog").addEventListener("close",function(){
      var trigger=activeAttendanceDetail?.trigger;
      activeAttendanceDetail=null;
      if(trigger&&!trigger.isConnected){
        var key=trigger.dataset;
        if(key.practiceDate)trigger=$("response-list").querySelector('[data-practice-date="'+CSS.escape(key.practiceDate)+'"]');
        if(key.matchDate)trigger=$("response-list").querySelector('[data-match-date="'+CSS.escape(key.matchDate)+
          '"][data-match-category="'+CSS.escape(key.matchCategory)+'"]');
        if(key.matchDetail)trigger=$("match-summary-list").querySelector('[data-match-detail="'+CSS.escape(key.matchDetail)+'"]');
      }
      trigger?.focus({preventScroll:true});
    });
    $("match-summary-list").addEventListener("click",function(event){
      var detail=event.target.closest("[data-match-detail]");
      if(detail&&activeMatchSummary){
        var match=activeMatchSummary.day.matches.find(function(item){return item.id===detail.dataset.matchDetail;});
        if(match)openAttendanceDetail(match.date,"match",activeMatchSummary.category,match.id,detail);
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
    $("attendance-form-events").addEventListener("change",updateCoachPracticeOptions);
    $("day-entry-events").addEventListener("change",updateCoachPracticeOptions);
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
    $("cancel-event").addEventListener("click",function(){$("event-dialog").close();});$("event-form").addEventListener("submit",function(e){e.preventDefault();var title=$("event-title").value.trim();if(!title)return;if(selectedDate<todayISO()||selectedDate>maxDate()||!isDefaultDay(selectedDate)){alert("今日から2か月先までの対象日を一覧から選んでください。");return;}var kind=$("event-kind").value,dayId=defaultEvent(selectedDate).id;
      var reuseDay=kind==="practice"&&!eventForDate(selectedDate).some(function(event){return event.id===dayId||event.kind==="practice";});
      var id=reuseDay?dayId:"demo_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7);state.events.push({id:id,date:selectedDate,kind:$("event-kind").value,title:title,place:$("event-place").value.trim(),createdAt:new Date().toISOString()});saveState();$("event-dialog").close();openEvent(id);});
    $("entry-mode-button").addEventListener("click",function(){if(!requireSharedConnection())return;if(getPeople().length){openAttendanceForm("");return;}if(audience==="coaches"&&!state.coaches.length){$("coach-local-editor").open=true;$("coach-editor").scrollIntoView({behavior:"smooth",block:"center"});$("coach-name-input").focus({preventScroll:true});return;}});$("entry-mode-icon").addEventListener("click",function(){$("entry-mode-button").click();});$("transpose-board").addEventListener("click",function(){transposeBoard=!transposeBoard;renderResponse();});$("cancel-attendance").addEventListener("click",function(){$("attendance-dialog").close();});$("attendance-form").addEventListener("submit",saveAttendanceForm);$("entry-person").addEventListener("change",renderAttendanceFormEvents);$("export-csv").addEventListener("click",openCsv);$("reset-demo").addEventListener("click",function(){if(!confirm("この端末に保存した試作の予定・回答・コーチ名をすべて削除しますか？団員名簿は変更されません。"))return;state={events:[],archive:[],coaches:[],coachLinks:{},answers:{},notes:{},matchNotes:{}};selectedEventId="";selectedDate="";localStorage.removeItem(STORAGE_KEY);render();});$("add-coach").addEventListener("click",function(){var input=$("coach-name-input"),name=input.value.trim();if(!name){input.focus();return;}if(getPeople().some(function(c){return coachNameKey(c.name)===coachNameKey(name);})){alert("同じ名前がすでに登録されています。");return;}state.coaches.push({id:"coach_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6),name:name});input.value="";saveState();render();});
    $("archive-list").addEventListener("click",handleEventListClick);
    render();loadHolidays();
  }
  document.addEventListener("DOMContentLoaded",init);
})();
