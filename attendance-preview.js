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
    id:params.get("calendar-attendance"),date:params.get("date")||"",
    parentHeader:window.parent!==window&&params.get("calendar-dialog")==="1"
  }:null;
  var sharedMatchLink=params.has("match")?{id:params.get("match"),date:params.get("date")||""}:null;
  var refreshLineComposer=null;
  var syncedCalendarEvents=[];
  var state=loadState(),members=[],rosterState="読み込み中",holidays={},audience="players",selectedDate="",selectedEventId="",selectedGrade="すべて",transposeBoard=false;
  var staffCoaches=[],staffCoachesReady=false,coachRosterStarted=false,coachRosterStatus="コーチ担当を読み込み中…";
  var previewRosterStarted=false, sharedStore, sharedRows=new Map(), sharedReady=false, savingShared=false, entryBaseline;
  if(!deviceMode){state.answers={};state.matchNotes={};state.notes={};state.coaches=[];state.coachLinks={};}
  var weekendPracticeDates=new Set(), calendarMatchesChecked=false;
  var seasonPeriod=null, seasonReady=false, savingSeason=false, calendarSyncResult=null;
  var practiceTransfers=new Set(), transferringPractice=false;
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
  function maxDate(today=todayISO()){var date=fromISO(today);return localISO(new Date(date.getFullYear(),date.getMonth()+3,0));}
  function movePastEvents(){var today=todayISO(),active=[];state.events.forEach(function(event){if(event.date<today){event.archivedAt=new Date().toISOString();state.archive.push(event);}else active.push(event);});if(active.length!==state.events.length){state.events=active;saveState();}}
  function readRoster(){
    if(previewRosterStarted)return;
    previewRosterStarted=true;
    var started=false;
    function consume(db){if(started)return;started=true;db.ref("members_v2").once("value").then(function(snapshot){var raw=snapshot.val()||{},list=[];Object.keys(raw).forEach(function(id){var m=raw[id];if(m&&String(m.name||"").trim()){list.push({id:String(m.id||id),name:String(m.name).trim(),kana:String(m.kana||""),grade:String(m.grade||"未設定"),gender:m.gender==="f"||m.gender==="m"?m.gender:""});}});members=list.sort(function(a,b){var ga=GRADES.indexOf(a.grade),gb=GRADES.indexOf(b.grade);if(ga<0)ga=99;if(gb<0)gb=99;return ga-gb||String(a.kana||a.name).localeCompare(String(b.kana||b.name),"ja");});rosterState="名簿から"+members.length+"名を読み込みました";$("roster-status").textContent="✓ "+rosterState+"（読み取り専用）";render();renderSavedEvent();refreshSharedMatchSummary();refreshCsvIfOpen();familyDirectoryChanged();}).catch(function(){rosterState="団員名簿を読み込めませんでした。通信状態をご確認ください";$("roster-status").textContent="⚠ "+rosterState;render();});}
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
    }).join(""):'<p class="small-note">今月から翌々月末までの祝日を表示します。</p>';
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

  function openCoachRegistration(){
    $("add-coach-form").reset();
    $("add-coach-status").textContent="";
    $("add-coach-dialog").showModal();
    $("new-coach-name").focus();
  }

  async function saveCoachRegistration(event){
    event.preventDefault();
    var form=event.currentTarget, input=$("new-coach-name"), status=$("add-coach-status");
    var name=input.value.trim().replace(/\s*コーチ$/,"").trim();
    if(!name||/[、，,\r\n]/.test(name)||!namesFromStaff([{name:name}]).length){
      status.textContent="登録するコーチ1人の名前を入力してください。";
      return;
    }
    var controls=Array.from(form.elements);
    if($("save-new-coach").disabled)return;
    controls.forEach(function(control){control.disabled=true;});
    status.textContent="担当フォルダに保存しています…";
    try{
      var result=await window.SMCCoachRoster.add(window.FIREBASE_DB,name);
      staffCoaches=namesFromStaff(result.rows);
      staffCoachesReady=true;
      linkLocalCoachAnswers();
      coachRosterStatus="";
      var coach=getPeople("coaches").find(function(person){return coachNameKey(person.name)===coachNameKey(name);});
      if(!coach)throw new Error("coach-not-found");
      renderResponse(true);
      $("add-coach-dialog").close();
      announceSave(result.saved?"コーチ名を出欠一覧と担当フォルダに追加しました。":"同じ名前が登録済みです。登録済みの名前で出欠を入力できます。");
      if(sharedReady)openAttendanceForm(coach.id);
    }catch(error){
      status.textContent="担当フォルダに保存できませんでした。通信状態を確認して、もう一度お試しください。";
    }finally{
      controls.forEach(function(control){control.disabled=false;});
    }
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
      if(audience==="coaches"||calendarView)renderEventList();
      renderResponse(true);
      renderSavedEvent();refreshSharedMatchSummary();refreshCsvIfOpen();
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

  var activeDayEntry=null, dayEntryTrigger=null, activeAttendanceDetail=null;

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
  function inputDayEvents(day){return day.matches.concat(day.practice,day.activities);}

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

  function cancelledMatchPracticeUpdates(days, cancelled, roster, hasPracticeAnswer){
    var matchesByDate=new Map();
    cancelled.forEach(function(match){
      if(!matchesByDate.has(match.date))matchesByDate.set(match.date,[]);
      matchesByDate.get(match.date).push(match);
    });
    return days.flatMap(function(day){
      var matches=matchesByDate.get(day.date);
      if(!matches||day.practice.length!==1)return [];
      var practice=day.practice[0];
      return Object.entries(roster).flatMap(function([group,people]){
        return people.flatMap(function(person){
          if(hasPracticeAnswer(practice,person,group)||responseRestriction(practice,person,day,group)||
            (group==="coaches"&&day.matches.some(function(match){return answerValue(match,person,group)==="attending";})))return [];
          var values=new Set(matches.map(function(match){return answerValue(match,person,group);}).filter(Boolean));
          if(values.size!==1)return [];
          return [{group:group,personId:person.id,id:practice.id,value:values.values().next().value}];
        });
      });
    });
  }

  async function transferCancelledMatchAnswers(){
    if(transferringPractice||!sharedReady||!visibilityReady||!seasonReady||!recruitmentReady||
      !calendarSyncResult?.saved||calendarSyncResult.failed.length)return;
    var cancelled=state.events.filter(function(event){
      return event.kind==="match"&&event.id.startsWith("calendar_")&&event.calendarInactive&&!manuallyExcluded(event);
    });
    if(!cancelled.length)return;
    var baseline=sharedRows, sync=calendarSyncResult;
    var jobs=cancelledMatchPracticeUpdates(groupBoardDays(getBoardEvents()),cancelled,
      {players:members,coaches:getPeople("coaches")},function(event,person,group){
        return baseline.has(sharedStore.key(event.id,group,person.id));
      }).filter(function(job){
        return !practiceTransfers.has(sharedStore.key(job.id,job.group,job.personId));
      });
    if(!jobs.length)return;
    transferringPractice=true;
    var saved=0,failed=0;
    try{
      for(var start=0;start<jobs.length&&sharedReady&&calendarSyncResult===sync;start+=8){
        await Promise.all(jobs.slice(start,start+8).map(async function(job){
          var key=sharedStore.key(job.id,job.group,job.personId);
          practiceTransfers.add(key);
          try{
            if(!sharedRows.has(key)){
              var conflicts=await sharedStore.save(job.group,job.personId,[{id:job.id,value:job.value}],undefined,baseline);
              if(!conflicts.size)saved++;
            }
          }catch(error){failed++;}
        }));
      }
    }finally{
      transferringPractice=false;
      if(failed)announceSave("練習の出欠 "+saved+"件を引き継ぎました。"+failed+"件は保存できなかったため、ページを開き直すと再試行します。");
      else if(saved)announceSave("カレンダーから消えた試合の出欠を、同じ日の練習に "+saved+"件引き継ぎました。");
      if(calendarSyncResult!==sync)void transferCancelledMatchAnswers();
    }
  }

  function canAnswer(event,person,day){
    return !responseRestriction(event,person,day);
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

  function countAnswers(events,people,day,group=audience){
    var total={attending:0,maybe:0,absent:0,eligible:0};
    events.forEach(function(event){
      people.filter(function(person){return !responseRestriction(event,person,day,group);}).forEach(function(person){
        var value=attendanceValue(event,person,day,group);
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

  function roleName(group){
    return group==="coaches"?"コーチ":"団員";
  }

  function eventCountButtons(day,events,people,kind,showTitle){
    return events.map(function(event){
      var title=attendanceEventTitle(event)+(event.holidayReference?"（参照のみ）":"");
      var caption=showTitle||events.length>1;
      var shortTitle=event.holidayAvailability?(event.holidayReference?"祝日出欠（参考）":"祝日出欠"):title;
      return '<div class="event-role-counts">'+(caption?'<span class="activity-count-title" title="'+esc(title)+'">'+esc(shortTitle)+'</span>':"")+
        ["players","coaches"].map(function(group){
          var roster=group===audience?people:getPeople(group);
          var ready=(deviceMode||sharedReady)&&(roster.length||
            (group==="coaches"?staffCoachesReady:rosterState.startsWith("名簿から")));
          var total=countAnswers([event],roster,day,group);
          var label=title+"の"+roleName(group)+"の出欠集計。"+(ready?
            (group==="players"?"対象 "+total.eligible+"人、":"")+responseCountText(total):"集計待ち");
          return '<button type="button" class="category-count-button role-count-button" data-count-event="'+esc(event.id)+
            '" data-count-date="'+esc(day.date)+'" data-count-kind="'+kind+'" data-count-group="'+group+
            '" aria-haspopup="dialog" aria-label="'+esc(label)+'"><span class="role-count-label">'+roleName(group)+'</span>'+
            '<span class="category-count-values" aria-hidden="true">'+(ready?compactCountMarks(total):"集計待ち")+'</span></button>';
        }).join("")+'</div>';
    }).join("");
  }

  function scheduleSummaryGroup(label,counts){
    return '<div class="board-schedule-group"><span class="board-schedule-label">'+esc(label)+'</span>'+counts+'</div>';
  }

  function scheduleCellSummary(day,people){
    var matchGroups=Array.from(matchCategories(day.matches),function(entry){
      var category=entry[0],matches=entry[1];
      return scheduleSummaryGroup(category==="その他"?"その他の試合":category+" 試合",
        eventCountButtons(day,matches,people,"match",false));
    });
    var activities=day.activities.map(function(event){
      var holiday=event.holidayAvailability;
      var label=holiday?(event.holidayReference?"祝日出欠（参考）":"祝日出欠"):"行事";
      return scheduleSummaryGroup(label,eventCountButtons(day,[event],people,"activity",!holiday));
    });
    return matchGroups.concat(activities).join("");
  }

  function scheduleSummaryRow(days,people){
    if(!days.some(function(day){return day.matches.length||day.activities.length;}))return "";
    return '<tr class="board-schedule-summary"><th class="person-col" scope="row">予定</th>'+
      days.map(function(day){
        var counts=scheduleCellSummary(day,people);
        return counts?'<td class="board-schedule-cell">'+counts+'</td>':'<td aria-label="試合・行事・祝日の出欠予定なし"></td>';
      }).join("")+'</tr>';
  }

  function dayHeading(day,people,showSummary=true){
    var date=calendarLink(day.date,calendarIcon+'<span class="board-date">'+esc(compactDate(day.date))+'</span>',"day-detail-link","",dateLabel(day.date)+"の予定を開く");
    if(!showSummary)return '<div class="board-day-heading">'+date+'</div>';
    var counts=eventCountButtons(day,day.practice,people,"practice",false)||
      '<span class="category-count-empty" aria-label="練習なし">—</span>';
    return '<div class="board-day-heading">'+date+
      (transposeBoard?'<span class="board-practice-label">練習の出欠</span>':"")+counts+'</div>';
  }

  function boardPersonName(person){
    var note=transposeBoard?"":state.notes[audience]?.[person.id];
    return '<button type="button" class="board-member-name" data-edit-person="'+esc(person.id)+'">'+
      (audience==="players"?'<span class="board-member-grade">'+esc(person.grade||"学年未登録")+'</span> ':"")+
      '<span>'+esc(person.name)+'</span>'+
      (note?'<span class="board-comment" title="'+esc(note)+'">'+esc(note)+'</span>':"")+'</button>';
  }

  var calendarIcon='<svg class="attendance-calendar-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true" focusable="false"><rect x="2" y="3.5" width="12" height="10.5" rx="1.5"/><path d="M5 2v3M11 2v3M2 7h12"/></svg>';

  function entryCalendarDate(date){
    return calendarLink(date,calendarIcon+'<span>'+esc(dateLabel(date))+'</span>',"entry-date-link");
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
    var status=$(calendarView?"calendar-attendance-save":"answer-status");
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
    import("./attendance-open-store.mjs?v=20261123-attendance-list2").then(function(module){
      return module.loadOpenAttendance();
    }).then(function(store){
      sharedStore=store;
      store.families.listen(function(records){
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

  async function submitEntry(personId,updates,note,form,group=audience){
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
      var conflicts=await sharedStore.save(group,personId,updates,note,entryBaseline,priorConflicts);
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

  function openDayEntry(day,person,trigger,group=audience,eventId=""){
    entryBaseline=sharedRows;
    resetEntrySave($("day-entry-form"));
    activeDayEntry={day:day,person:person,group:group,eventId:eventId};
    dayEntryTrigger=trigger;
    var selected=dayEvents(day).find(function(event){return event.id===eventId;});
    if(selected)$("day-entry-title").textContent=attendanceEventTitle(selected)+"の出欠";
    else $("day-entry-title").innerHTML=entryCalendarDate(day.date)+"の出欠";
    $("day-entry-person").textContent=person.name;
    $("day-entry-events").innerHTML=inFamilyGroup(group,function(){return renderEntryDay(day,person,false,eventId);});
    $("day-entry-dialog").showModal();
    $("day-entry-events").parentElement.scrollTop=0;
  }

  function renderEntryDay(day,person,showDate,eventId){
    var events=editableDayEvents(day,person,audience,eventId);
    if(!events.length)return "";
    return '<section class="entry-day">'+
      (showDate?'<h3>'+entryCalendarDate(day.date)+'</h3>':"")+
      events.map(function(event){
        var match=event.kind==="match",current=answerValue(event,person);
        var title=event.title||eventKindLabel(event);
        var eventHeading=match?calendarLink(event.date,calendarIcon+'<span>'+esc(title)+'</span>',"entry-match-link",event.id,title+"の詳細をカレンダーで開く"):esc(title);
        var coachPractice=audience==="coaches"&&!match&&event.kind!=="activity"&&day.matches.length>0;
        var practiceLocked=coachPractice&&day.matches.some(function(item){return answerValue(item,person)==="attending";});
        var review=match&&needsMatchReview(event,person,day);
        var choices=ANSWERS.concat({value:"",label:"未回答"});
        return '<article class="response-entry-card '+(match?"is-match":"")+'"'+(review?' data-needs-review="true"':"")+'>'+
          '<div class="entry-card-heading"><span class="entry-kind">'+eventKindLabel(event)+'</span><h4>'+eventHeading+'</h4></div>'+
          (event.startTime||event.descriptionTime||event.place?'<p class="entry-card-meta">'+esc([event.startTime||event.descriptionTime,event.place].filter(Boolean).join(" ・ "))+'</p>':"")+
          (review?'<p class="entry-review"><strong>要確認</strong> 練習に○で回答済みです。試合の出欠を入力してください。</p>':"")+
          (coachPractice?'<p class="entry-review" data-coach-practice-note role="status"'+
            (practiceLocked?"":" hidden")+'><strong>× 不参加</strong> 同じ日の試合に参加するため、練習は自動で不参加になります。</p>':"")+
          '<div class="entry-answer-options" role="group" aria-label="'+esc(title+"の出欠")+'"'+
            (coachPractice?' data-coach-practice'+(practiceLocked?" hidden":""):"")+'>'+choices.map(function(option){
            return '<label><input type="radio" name="answer-'+esc(event.id)+'" value="'+esc(option.value)+'"'+
              (option.value===current?" checked":"")+'><span>'+attendanceMark(option.value)+option.label+'</span></label>';
          }).join("")+'</div>'+
          (match?'<p class="match-optional-note">出欠だけで保存できます。遅刻・早退など、伝えておきたいことがある場合は「連絡事項（任意）」に入力してください。</p>':"")+contactEditor(event,person)+
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

  function readEntryUpdates(form,person,days,{renderedOnly=false}={}){
    return days.flatMap(function(day){
      var coachMatch=audience==="coaches"&&day.matches.some(function(match){
        return (form.get("answer-"+match.id)??answerValue(match,person))==="attending";
      });
      return dayEvents(day).flatMap(function(item){
        if(item.holidayReference||!form.has("answer-"+item.id)||(!renderedOnly&&!canAnswer(item,person,day)))return [];
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
    if($("match-summary-dialog").open)renderMatchSummary();
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

  function renderMatchSummary(){
    var days=groupBoardDays(getBoardEvents()).filter(function(day){return day.matches.length;});
    var list=$("match-summary-list"),status=$("match-summary-status");
    status.hidden=Boolean(days.length);
    status.textContent=days.length?"":!calendarMatchesChecked?
      ($("calendar-sync-status").textContent||"カレンダーを読み込んでいます…"):
      calendarSyncResult?.failed.length?"予定を取得できませんでした。時間をおいてご確認ください。":"出欠の受付期間内に試合はありません。";
    var markup=days.map(function(day){
      return '<section class="match-overview-day"><h3>'+esc(dateLabel(day.date))+'</h3>'+
        day.matches.map(function(event){
          var time=[event.startTime,event.endTime].filter(Boolean).join("〜")||event.descriptionTime;
          var metadata=[time,event.place].filter(Boolean).join(" · ");
          return '<article class="match-summary-event" data-target-event="'+esc(event.id)+'"><h4>'+esc(attendanceEventTitle(event))+'</h4>'+
            (metadata?'<p class="match-overview-meta">'+esc(metadata)+'</p>':"")+
            (audience==="players"?'<p class="match-overview-meta match-target-note"></p>':"")+
            '<div class="match-overview-counts"></div>'+
            '<button type="button" class="secondary-button day-details-action" data-match-detail="'+esc(event.id)+
              '" data-match-date="'+esc(day.date)+'" aria-haspopup="dialog">予定詳細</button>'+
            (audience==="coaches"?targetGradeEditor(event,targetGrades(event)):"")+'</article>';
        }).join("")+'</section>';
    }).join("");
    if(list.matchMarkup!==markup){
      list.innerHTML=markup;
      list.matchMarkup=markup;
    }
    var people=getPeople();
    var cards=list.querySelectorAll("[data-target-event]");
    var index=0;
    days.forEach(function(day){
      day.matches.forEach(function(event){
        var card=cards[index++];
        var target=card.querySelector(".match-target-note");
        if(target)target.textContent=matchTargetLabel(event);
        var counts=card.querySelector(".match-overview-counts");
        var markup=eventCountButtons(day,[event],people,"match",false);
        if(counts.matchMarkup===markup)return;
        var focusedGroup=counts.contains(document.activeElement)?document.activeElement.dataset.countGroup:null;
        counts.innerHTML=markup;
        counts.matchMarkup=markup;
        if(focusedGroup)counts.querySelector('[data-count-group="'+focusedGroup+'"]')?.focus({preventScroll:true});
      });
    });
  }

  function openMatchSummary(){
    renderMatchSummary();
    $("match-summary-dialog").showModal();
    $("match-summary-list").parentElement.scrollTop=0;
    $("match-summary-title").focus({preventScroll:true});
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
    return kind==="match"?day.matches.filter(function(event){return !category||matchCategory(event)===category;}):kind==="activity"?day.activities:day.practice;
  }

  function refreshMatchDetail(){
    var detail=activeAttendanceDetail;
    if(!detail)return;
    var day=groupBoardDays(getBoardEvents().filter(function(event){return event.date===detail.date;}))[0];
    var events=day?detailChoices(day,detail.kind,detail.category):[];
    if(detail.eventId)events=events.filter(function(event){return event.id===detail.eventId;});
    if(!events.length){
      if(detail.sharedLink)showSharedMatchStatus("この試合は削除されたか、出欠の受付を終了しました。");
      $("match-detail-dialog").close();
      return;
    }
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
    renderEventParticipants($("match-detail-attendance"),event,day);
  }

  function openAttendanceDetail(date,kind,category,eventId,trigger,group=audience,showInfo=false){
    activeAttendanceDetail={date:date,kind:kind,category:category,eventId:eventId,trigger:trigger,
      showInfo:showInfo};
    $("match-detail-attendance").dataset.activeGroup=group;
    $("match-detail-dialog").showModal();
    refreshMatchDetail();
    $("match-detail-scroll").scrollTop=0;
  }

  function editableDayEvents(day,person,group,eventId){
    return inputDayEvents(day).filter(function(event){
      return (!eventId||event.id===eventId)&&!event.holidayReference&&!responseRestriction(event,person,day,group);
    });
  }

  function renderEventParticipants(root,event,day){
    root.dataset.eventId=event.id;
    root.dataset.eventDate=event.date;
    var groups=["players","coaches"];
    var markup='<div class="attendance-role-tabs" role="tablist" aria-label="参加者の区分">'+groups.map(function(group){
      var id=root.id+"-"+group;
      return '<button type="button" role="tab" id="'+id+'-tab" data-attendance-role="'+group+
        '" aria-controls="'+id+'-panel">'+roleName(group)+'</button>';
    }).join("")+'</div>'+groups.map(function(group){
      var id=root.id+"-"+group;
      var people=getPeople(group).filter(function(person){return !responseRestriction(event,person,day,group);});
      var ready=group==="coaches"?staffCoachesReady:rosterState.startsWith("名簿から");
      return '<section role="tabpanel" id="'+id+'-panel" aria-labelledby="'+id+'-tab">'+
        (people.length||ready?matchAttendanceTable(event,people,group,day,true):
          "<p>"+esc(group==="coaches"?coachRosterStatus:rosterState)+"</p>")+"</section>";
    }).join("");
    var focused=root.contains(document.activeElement)?document.activeElement.dataset.attendanceRole:"";
    if(root.renderedAttendance!==markup||!root.childElementCount){
      root.innerHTML=markup;
      root.renderedAttendance=markup;
    }else focused="";
    selectAttendanceRole(root,root.dataset.activeGroup||"players");
    if(focused)root.querySelector('[data-attendance-role="'+focused+'"]')?.focus({preventScroll:true});
  }

  function selectAttendanceRole(root,group){
    root.dataset.activeGroup=group;
    root.querySelectorAll("[data-attendance-role]").forEach(function(tab){
      var selected=tab.dataset.attendanceRole===group;
      tab.setAttribute("aria-selected",String(selected));
      tab.tabIndex=selected?0:-1;
      $(tab.getAttribute("aria-controls")).hidden=!selected;
    });
  }

  function matchAttendanceTable(event,people,group,day,editable=false){
    var answers=ANSWERS.concat({value:"",label:"未回答"});
    var peopleByAnswer=new Map(answers.map(function(answer){return [answer.value,[]];}));
    people.forEach(function(person){
      var value=attendanceValue(event,person,day,group);
      (peopleByAnswer.get(value)||peopleByAnswer.get("")).push(person);
    });
    var totals=(group==="coaches"&&!editable?ANSWERS:answers).map(function(answer){
      var count=peopleByAnswer.get(answer.value).length;
      return '<tr class="match-attendance-total"><th scope="row">'+esc((answerMark(answer.value)+" "+answer.label).trim())+
        '</th><td>'+count+'人</td><td></td></tr>';
    }).join("");
    var rows=answers.flatMap(function(answer){
      return peopleByAnswer.get(answer.value).map(function(person){
        var value=answer.value,label=answer.label;
        var grade=group==="players"&&person.grade?'<span class="match-attendance-grade">'+esc(person.grade)+'</span>':"";
        var invite=group==="players"&&recruitmentDecision(event,person)==="include"?'<span class="recruitment-badge">個別招集</span>':"";
        var name=grade+(grade?" ":"")+esc(person.name)+invite;
        if(editable&&editableDayEvents(day,person,group,event.id).length){
          name='<button type="button" class="participant-edit" data-participant="'+esc(person.id)+
            '" data-participant-group="'+group+'" aria-label="'+esc(person.name+"の出欠を編集")+'">'+name+'</button>';
        }
        var contact=matchComment(matchContact(event.id,person.id,group));
        return '<tr><th scope="row" class="match-attendance-name">'+name+
          '</th><td data-value="'+esc(value)+'" aria-label="'+esc(label)+'">'+esc(answerMark(value)?answerMark(value)+" "+label:label)+'</td>'+
          '<td class="participant-contact-cell">'+(contact?
            '<details class="participant-contact"><summary>'+esc(contact)+'</summary></details>':"—")+'</td></tr>';
      });
    }).join("");
    return '<div class="match-attendance-wrap"><table class="match-attendance-table has-comments"><thead><tr><th scope="col">参加者</th>'+
      '<th scope="col" aria-label="出欠 '+esc(dateLabel(event.date))+'">出欠</th>'+
      '<th scope="col">連絡事項</th></tr></thead><tbody>'+totals+'</tbody><tbody>'+rows+'</tbody></table></div>';
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
    if(day.matches.length&&!recruitmentReady){
      rows.replaceChildren();
      status.textContent=calendarView.delayed?"招集情報を読み込めません。閉じてから開き直してください。":"招集情報を読み込み中です。";
      return;
    }
    $("calendar-attendance-title").textContent=attendanceEventTitle(event)+"の出欠一覧";
    status.textContent=calendarView.parentHeader?"":dateLabel(date);
    renderEventParticipants(rows,event,day);
  }

  var BOARD_SUMMARY_KEY="yoshimi_smc_attendance_summary_expanded";
  var boardSummaryExpanded=true;
  try{boardSummaryExpanded=localStorage.getItem(BOARD_SUMMARY_KEY)!=="false";}catch(error){}

  function setupBoardViewport(){
    var header=document.querySelector(".site-header"),list=$("response-list");
    var entry=$("entry-mode-button"),floating=$("floating-entry-button"),summary=$("board-summary-list");
    var viewport=window.visualViewport,frame=0;

    function update(){
      frame=0;
      var boards=[summary,list].map(function(section){return section.querySelector(".attendance-board-scroll");}).filter(Boolean);
      var viewTop=viewport?.offsetTop||0;
      var viewBottom=viewport?viewTop+viewport.height:window.innerHeight;
      var headerBounds=header.getBoundingClientRect();
      var top=Math.max(viewTop,headerBounds.bottom);
      list.style.setProperty("--attendance-header-height",headerBounds.height+"px");
      var anyBoardVisible=false;
      boards.forEach(function(board){
        var bounds=board.getBoundingClientRect();
        board.style.setProperty("--board-header-offset",Math.max(0,top-bounds.top-board.clientTop)+"px");
        if(bounds.bottom>top&&bounds.top<viewBottom)anyBoardVisible=true;
      });
      floating.hidden=!anyBoardVisible||entry.disabled||entry.getBoundingClientRect().bottom>top||
        Boolean(document.querySelector("dialog[open]"));
      if(!floating.hidden){
        floating.textContent=entry.textContent;
        floating.style.setProperty("--entry-bottom-inset",Math.max(0,window.innerHeight-viewBottom)+"px");
      }
    }

    function schedule(){
      if(!frame)frame=requestAnimationFrame(update);
    }

    window.addEventListener("scroll",schedule,{passive:true});
    window.addEventListener("resize",schedule);
    viewport?.addEventListener("scroll",schedule,{passive:true});
    viewport?.addEventListener("resize",schedule);
    var layout=new ResizeObserver(schedule);
    [header,list,entry,$("response-panel")].forEach(function(element){layout.observe(element);});
    var changes=new MutationObserver(schedule);
    changes.observe(list,{childList:true});
    changes.observe(summary,{childList:true});
    changes.observe(entry,{attributes:true,attributeFilter:["disabled"]});
    document.querySelectorAll("dialog").forEach(function(dialog){
      changes.observe(dialog,{attributes:true,attributeFilter:["open"]});
    });
    floating.addEventListener("click",function(){entry.click();});
    schedule();
  }

  function toggleBoardSummary(){
    boardSummaryExpanded=!boardSummaryExpanded;
    try{localStorage.setItem(BOARD_SUMMARY_KEY,String(boardSummaryExpanded));}catch(error){}
    renderResponse(true);
  }

  function openLineInvitation(){
    const dialog=$("line-invite-dialog");
    if(!refreshLineComposer)refreshLineComposer=window.SMCAttendanceLineInvite.setup(dialog,dateLabel,location.href);
    refreshLineInvitation();
    dialog.showModal();
  }

  function refreshLineInvitation(){
    if(!refreshLineComposer)return;
    if(!calendarMatchesChecked||!visibilityReady||!seasonReady||!calendarSyncResult?.saved){
      refreshLineComposer(null,"受付中の試合を確認しています。読み込めない場合はページを開き直してください。");
      return;
    }
    const failed=calendarSyncResult.failed;
    const entries=getBoardEvents().filter(event=>event.kind==="match"&&event.id.startsWith("calendar_")&&
      !failed.includes(event.calendarLabel||event.category)).map(event=>{
        const description=String(event.description||"").replace(/<[^>]*>/g," ").normalize("NFKC");
        const meeting=description.match(/(?:【集合(?:時間)?】|\b集合(?:時間)?\s*[:：]|集合(?:時間)?\s*[:：]?)\s*(\d{1,2}[:時]\d{2}(?:分)?)/)?.[1]||"";
        return {id:event.id,date:event.date,category:matchCategory(event),title:event.title,startTime:event.startTime,place:event.place,meeting};
      });
    refreshLineComposer(entries,failed.length?"一部のカレンダーを取得できませんでした。確認できた試合を表示しています。":
      entries.length?"":"出欠受付中の試合がありません。");
  }

  function showSharedMatchStatus(message){
    const status=$("shared-match-link-status");
    status.hidden=false;
    status.querySelector("p").textContent=message;
  }

  function openSharedMatch(){
    if(!sharedMatchLink||calendarView)return;
    const link=sharedMatchLink;
    if(!link.id.startsWith("calendar_")||!/^\d{4}-\d{2}-\d{2}$/.test(link.date)||link.date<todayISO()||link.date>maxDate()){
      showSharedMatchStatus("この試合の出欠受付は終了したか、リンクが正しくありません。");
      sharedMatchLink=null;
      return;
    }
    if(!calendarMatchesChecked||!calendarSyncResult?.saved||!visibilityReady||!seasonReady||
      !sharedReady||!recruitmentReady||!rosterState.startsWith("名簿から")){
      if($("shared-match-link-status").hidden)showSharedMatchStatus("試合の出欠を読み込んでいます…");
      return;
    }
    const match=getBoardEvents().find(event=>event.kind==="match"&&event.id===link.id&&event.date===link.date);
    const failed=calendarSyncResult.failed;
    if(failed.length&&(!match||failed.includes(match.calendarLabel||match.category))){
      showSharedMatchStatus("カレンダーに接続できず、試合の受付状況を確認できませんでした。ページを開き直してください。");
      return;
    }
    sharedMatchLink=null;
    if(!match){
      showSharedMatchStatus("この試合は削除されたか、出欠の受付を終了しました。");
      return;
    }
    $("shared-match-link-status").hidden=true;
    openAttendanceDetail(match.date,"match","",match.id,null,"players");
    if(activeAttendanceDetail)activeAttendanceDetail.sharedLink=true;
  }

  function renderAttendanceBoard(root,days,people,showSummary,preserveScroll){
    var previous=root.querySelector(".attendance-board-scroll");
    var savedTop=preserveScroll&&previous?previous.scrollTop:0,savedLeft=preserveScroll&&previous?previous.scrollLeft:0;
    var head,body,boardPeople=showSummary?[]:people;
    if(transposeBoard){
      head='<thead><tr><th class="event-col" scope="col">日付</th>'+boardPeople.map(function(person){
        return '<th class="rotated-person" scope="col">'+boardPersonName(person)+'</th>';
      }).join("")+'</tr></thead><tbody>';
      body=days.map(function(day){
        return '<tr><th class="event-col" scope="row" data-board-date="'+esc(day.date)+'">'+
          dayHeading(day,people,showSummary)+
          (showSummary?scheduleCellSummary(day,people):"")+'</th>'+
          boardPeople.map(function(person){return '<td>'+dayButton(day,person)+'</td>';}).join("")+'</tr>';
      }).join("");
    }else{
      head='<thead><tr><th class="person-col" scope="col">'+(showSummary?"練習の出欠":"名前")+'</th>'+days.map(function(day){
        return '<th scope="col" data-board-date="'+esc(day.date)+'">'+dayHeading(day,people,showSummary)+'</th>';
      }).join("")+'</tr></thead><tbody>';
      body=(showSummary?scheduleSummaryRow(days,people):"")+boardPeople.map(function(person){
        return '<tr><th class="person-col" scope="row">'+boardPersonName(person)+'</th>'+
          days.map(function(day){return '<td>'+dayButton(day,person)+'</td>';}).join("")+'</tr>';
      }).join("");
    }
    root.innerHTML='<p class="board-attendance-legend"><span>'+attendanceMark("attending")+'参加</span>'+
      '<span>'+attendanceMark("maybe")+'未定</span><span>'+attendanceMark("absent")+'不参加</span></p>'+
      '<div class="attendance-board-scroll" role="region" aria-label="'+(showSummary?"出欠集計":"参加者別の出欠")+'、上下左右にスクロール" tabindex="0"><table class="attendance-board'+(transposeBoard?" is-transposed":"")+(showSummary?" has-board-summary":"")+'">'+head+body+'</tbody></table></div>';
    var board=root.querySelector(".attendance-board-scroll");
    board.scrollTop=savedTop;
    board.scrollLeft=savedLeft;
  }

  function renderResponse(preserveScroll){
    refreshLineInvitation();
    openSharedMatch();
    void transferCancelledMatchAnswers();
    if(calendarView){renderCalendarAttendance();return;}
    var panel=$("response-panel"),rows=$("response-list"),summary=$("board-summary-list");
    var people=getPeople(),summaryPeople=people,days=groupBoardDays(getBoardEvents());
    $("board-toolbar").hidden=true;
    $("board-summary-controls").hidden=true;
    panel.hidden=false;
    $("response-title").textContent="参加予定【"+(audience==="players"?"団員用":"コーチ用")+"】";
    $("attendance-guide-name").textContent=audience==="players"?"お子さんの名前":"ご自身の名前";
    $("response-summary").hidden=!deviceMode;
    $("response-summary").textContent=deviceMode?"この端末の試作回答を表示しています。":"";
    // Do not silently disable the input button when a session link is missing.
    // Clicking it explains how to reconnect without overwriting old answers.
    $("entry-mode-button").disabled=!getPeople().length||!sharedReady;
    $("open-add-coach").hidden=audience!=="coaches";
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

    $("entry-mode-button").textContent=deviceMode?"試作回答を入力する":"出欠を入力する";
    $("attendance-guide-entry").textContent=$("entry-mode-button").textContent;
    $("board-toolbar").hidden=!days.length;
    $("board-summary-controls").hidden=!days.length;
    $("toggle-board-summary").setAttribute("aria-expanded",String(boardSummaryExpanded));
    $("board-summary-label").textContent=boardSummaryExpanded?"出欠集計を閉じる":"出欠集計を表示（練習・試合・行事・祝日）";
    $("board-summary-arrow").textContent=boardSummaryExpanded?"▴":"▾";
    $("board-status").textContent=transposeBoard?"日付が縦":"日付が横";
    $("transpose-board").setAttribute("aria-pressed",String(transposeBoard));
    $("attendance-summary-help").hidden=!boardSummaryExpanded;
    summary.hidden=!boardSummaryExpanded||!days.length;
    if(!summary.hidden)renderAttendanceBoard(summary,days,summaryPeople,true,preserveScroll);
    if(!people.length){
      rows.innerHTML='<div class="empty-state">'+(audience==="players"?esc(rosterState)+"。":esc(coachRosterStatus))+"</div>";
      return;
    }
    if(!days.length){rows.innerHTML='<div class="empty-state">表示できる日程がありません。</div>';return;}

    renderAttendanceBoard(rows,days,people,false,preserveScroll);
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
    rows.querySelectorAll("[data-count-event]").forEach(function(button){
      button.addEventListener("click",function(){
        var key=button.dataset;
        openAttendanceDetail(key.countDate,key.countKind,"",key.countEvent,button,key.countGroup);
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
    var existing=$("family-existing");
    $("family-existing-label").hidden=Boolean(family.id)||!familyRecords.size;
    existing.innerHTML='<option value="">新しい家族を登録</option>'+[...familyRecords].map(function(item){
      var ids=familyIds(item[1]);
      var label=item[1].name||roster.filter(function(member){return ids.has(member.key);}).map(familyLabel).join("・");
      return label?'<option value="'+esc(item[0])+'">'+esc(label)+'</option>':"";
    }).join("");
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

  function familyUpdates(section,member,day,options){
    return inFamilyGroup(member.group,function(){
      return readEntryUpdates(familyControlData(section),member.person,[day],options);
    });
  }

  function familyChanged(update,baseline){
    if(update.value!==undefined&&(baseline?.value||"")!==update.value)return true;
    if(update.contact===undefined)return false;
    var old=baseline?.contact||{},next=update.contact||{};
    return Object.keys(old).length!==Object.keys(next).length||Object.keys(next).some(function(key){return old[key]!==next[key];});
  }

  function familyBulkCandidates(entry,eventId,playersOnly=false){
    return entry.members.flatMap(function(member,index){
      if(playersOnly&&member.group!=="players")return [];
      var section=entry.people.children[index];
      var inputs=Array.from(section.querySelectorAll('input[type="radio"]')).filter(function(input){
        return input.dataset.familyField==="answer-"+eventId&&!input.closest("[data-coach-practice][hidden]");
      });
      return inputs.length?[{member:member,inputs:inputs}]:[];
    });
  }

  function renderFamilyBulk(entry){
    entry.bulk.innerHTML=inputDayEvents(entry.day).filter(function(event){return !event.holidayReference;}).map(function(event){
      var candidates=familyBulkCandidates(entry,event.id);
      if(candidates.length<2)return "";
      var roles=new Set(candidates.map(function(item){return item.member.group;}));
      var target=roles.size>1?
        '<label class="family-bulk-scope"><input type="checkbox" data-family-scope="'+esc(event.id)+'"'+
        (entry.playersOnly.has(event.id)?" checked":"")+'>子どもだけ</label>':
        '<p>'+esc(candidates.map(function(item){return familyLabel(item.member);}).join("・"))+'</p>';
      return '<section class="family-bulk-event"><strong>'+esc(scheduleEventTitle(event))+'</strong>'+target+
        ANSWERS.map(function(answer){
          return '<button type="button" class="secondary-button" data-family-event="'+esc(event.id)+'" data-family-value="'+
            esc(answer.value)+'">まとめて'+answerMark(answer.value)+'</button>';
        }).join(" ")+'</section>';
    }).join("");
  }

  function renderFamilyDays(){
    var root=$("family-entries"),status=$("family-status");
    var eventId=family.scope?.eventId;
    var days=groupBoardDays(getBoardEvents()).filter(function(day){
      return !family.scope||day.date===family.scope.date;
    });
    family.baseline=sharedRows;
    family.confirmed=new Map();
    family.dirty=false;
    family.days=new Map();
    status.textContent="";
    root.replaceChildren();
    var selected=days.flatMap(dayEvents).find(function(event){return event.id===eventId;});
    $("family-event-label").textContent=selected?dateLabel(selected.date)+" · "+attendanceEventTitle(selected):"";
    days.forEach(function(day){
      var activeMembers=family.members.filter(function(member){
        return editableDayEvents(day,member.person,member.group,eventId).length;
      });
      if(!activeMembers.length)return;
      var panel=document.createElement("section");
      panel.className="family-entry-day";
      panel.dataset.familyDate=day.date;
      panel.innerHTML=(family.scope?"":'<h3 class="family-day-heading">'+entryCalendarDate(day.date)+'</h3>')+
        '<div class="family-day-bulk"></div><div class="family-day-people"></div>';
      var entry={day:day,members:activeMembers,playersOnly:new Set(),bulk:panel.querySelector(".family-day-bulk"),people:panel.querySelector(".family-day-people")};
      family.days.set(day.date,entry);
      activeMembers.forEach(function(member,index){
        var section=document.createElement("section");
        section.className="family-person";
        section.innerHTML='<h4>'+esc(familyLabel(member))+'</h4>'+inFamilyGroup(member.group,function(){
          return renderEntryDay(day,member.person,false,eventId);
        });
        section.querySelectorAll("[name]").forEach(function(input){
          input.dataset.familyField=input.name;
          input.name="family-"+day.date+"-"+index+"-"+input.name;
        });
        section.addEventListener("change",function(event){
          family.dirty=true;
          if(member.group==="coaches"&&event.target.matches('.is-match input[type="radio"]')){
            inFamilyGroup(member.group,function(){updateCoachPracticeOptions(event);});
            renderFamilyBulk(entry);
          }
        });
        section.addEventListener("input",function(){family.dirty=true;});
        entry.people.append(section);
      });
      renderFamilyBulk(entry);
      root.append(panel);
    });
    $("family-save").disabled=!family.days.size;
    if(!family.days.size)status.textContent="家族が回答できる予定はありません。";
  }

  function showFamilyEntry(ids){
    family.members=familyRoster().filter(function(member){return ids.has(member.key);});
    var showEntry=family.members.length>0;
    $("family-picker").hidden=showEntry;
    $("family-entry").hidden=!showEntry;
    $("family-save").hidden=!showEntry;
    if(!showEntry){renderFamilyPicker();return;}
    $("family-entry-title").textContent=family.record?.name? family.record.name+"の出欠を入力":"家族で入力";
    $("family-entry-guide").hidden=Boolean(family.scope);
    $("family-event-label").hidden=!family.scope;
    renderFamilyDays();
    $("family-entries").closest(".attendance-entry-scroll").scrollTop=0;
  }

  function enterSelectedPerson(personId,group=audience,scope,trigger){
    if(!requireSharedConnection())return;
    var person=getPeople(group).find(function(item){return item.id===personId;});
    if(!person)return;
    function openIndividual(){
      if(!scope){openAttendanceForm(personId);return;}
      var day=groupBoardDays(getBoardEvents().filter(function(event){return event.date===scope.date;}))[0];
      if(day&&editableDayEvents(day,person,group,scope.eventId).length){
        openDayEntry(day,person,trigger,group,scope.eventId);
      }
    }
    var key=familyKey(group,personId);
    var roster=familyRoster();
    var choices=[...familyRecords].filter(function(item){return familyIds(item[1]).has(key);})
      .map(function(item){
        var ids=familyIds(item[1]);
        return {id:item[0],name:item[1].name,names:roster.filter(function(member){return ids.has(member.key);}).map(familyLabel)};
      }).filter(function(item){return item.names.length>=2;});
    if(familyDirectoryState!=="ready"||!choices.length){openIndividual();return;}
    var dialog=$("family-choice-dialog"), actions=$("family-choice-actions");
    $("family-choice-person").textContent=person.name;
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
    addChoice(scope?"この人だけ編集":"この人だけ入力","",openIndividual);
    choices.forEach(function(choice){
      addChoice(choice.name?choice.name+"でまとめて入力":"家族まとめて入力",choice.names.join("・"),function(){openFamilyEntry(choice.id,scope);});
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

  function openFamilyEntry(id,scope){
    if(!requireSharedConnection())return;
    var record=id?familyRecords.get(id):null;
    if(id&&!record){
      openFamilyEntry(undefined,scope);
      $("family-status").textContent="この家族登録は解除されています。";
      return;
    }
    family={id:id||"",record:record,members:[],dirty:false,saving:false,scope:scope};
    $("family-name").value=record?.name||"";
    $("family-entry-title").textContent="家族を登録";
    $("family-picker-people").replaceChildren();
    var status=$("family-status");
    status.textContent="";
    delete status.dataset.loading;
    if(!$("family-entry-dialog").open)$("family-entry-dialog").showModal();
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
    var knownIds=new Set(familyRoster().map(function(member){return member.key;}));
    familyIds(family.record).forEach(function(id){if(!knownIds.has(id))ids.add(id);});
    var name=$("family-name").value.trim();
    if(!remove&&!name){
      $("family-status").textContent="家族名を入力してください。";
      $("family-name").focus();
      return;
    }
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
      if(family.record.name){
        showFamilyEntry(ids);
        $("family-status").textContent="登録済みの家族を開きました。家族名は「家族名・メンバーを変更」から編集できます。";
        return;
      }
    }
    family.id=family.id||sharedStore.families.newId();
    family.saving=true;
    var controls=[...$("family-picker").querySelectorAll("button,input,select"),$("family-close")].filter(function(control){return !control.disabled;});
    controls.forEach(function(control){control.disabled=true;});
    $("family-status").textContent="クラウドに保存しています…";
    try{
      family.record=await sharedStore.families.save(family.id,remove?[]:ids,family.record?.revision||0,name);
      if(remove){
        familyRecords.delete(family.id);
        family.id="";
        $("family-name").value="";
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
    var entry=family.days.get(button.closest("[data-family-date]").dataset.familyDate);
    var eventId=button.dataset.familyEvent;
    var candidates=familyBulkCandidates(entry,eventId,entry.playersOnly.has(eventId));
    var changed=candidates.filter(function(item){return item.inputs.find(function(input){return input.checked;})?.value!==value;});
    if(changed.length&&!confirm(dateLabel(entry.day.date)+"の"+changed.map(function(item){return familyLabel(item.member);}).join("・")+
      " の回答を "+answerMark(value)+" にしますか？"))return;
    changed.forEach(function(item){
      var radio=item.inputs.find(function(input){return input.value===value;});
      radio.checked=true;
      radio.dispatchEvent(new Event("change",{bubbles:true}));
    });
  }

  async function saveFamily(){
    if(!family?.days?.size||family.saving||savingShared||!sharedReady)return;
    var currentDays=new Map(groupBoardDays(getBoardEvents()).map(function(day){return [day.date,day];}));
    var status=$("family-status");
    var jobs=[...family.days.values()].flatMap(function(entry){
      return entry.members.flatMap(function(member,index){
        // Read the rendered draft, then check changed replies against the latest schedule.
        return familyUpdates(entry.people.children[index],member,entry.day,{renderedOnly:true}).flatMap(function(update){
          var key=sharedStore.key(update.id,member.group,member.person.id);
          return familyChanged(update,family.baseline.get(key))?[{member:member,key:key,update:update,day:entry.day}]:[];
        });
      });
    });
    var outdated=jobs.find(function(job){
      var currentDay=currentDays.get(job.day.date);
      return !currentDay||!editableDayEvents(currentDay,job.member.person,job.member.group,job.update.id).length;
    });
    if(outdated){
      status.textContent=dateLabel(outdated.day.date)+"の予定または回答対象が変わりました。入力はこの画面に残っています。最新の予定を出欠表で確認してください。";
      return;
    }
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
      var event=dayEvents(job.day).find(function(item){return item.id===job.update.id;});
      failed.push(dateLabel(job.day.date)+"｜"+familyLabel(job.member)+"｜"+scheduleEventTitle(event)+(result.status==="fulfilled"?"（別の端末で変更あり）":"（保存できませんでした）"));
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
    if(!$("attendance-dialog").open)$("attendance-dialog").showModal();
    $("attendance-form-events").parentElement.scrollTop=0;
  }

  function renderAttendanceFormEvents(){
    var root=$("attendance-form-events");
    entryBaseline=sharedRows;
    resetEntrySave($("attendance-form"));
    var person=getPeople().find(function(item){return item.id===$("entry-person").value;});
    $("save-attendance").disabled=!person;
    $("entry-add-coach").hidden=audience!=="coaches"||Boolean(person);
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
  var openChouseisanDialog;
  async function openChouseisan(){
    var button=$("import-chouseisan");
    if(!requireSharedConnection())return;
    button.disabled=true;
    try{
      if(!openChouseisanDialog){
        var module=await import("./attendance-chouseisan-ui.mjs");
        openChouseisanDialog=module.initChouseisanImport({
          context:function(group){
            var events=sharedReady?getBoardEvents().filter(function(event){return !event.holidayReference;}):[];
            var days=new Map(groupBoardDays(events).map(function(day){return [day.date,day];}));
            return {events:events,people:getPeople(group),baseline:sharedRows,
              existing:function(event,person){return sharedRows.get(sharedStore.key(event.id,group,person.id))?.value;},
              eligible:function(event,person){return !responseRestriction(event,person,days.get(event.date),group);}
            };
          },
          eventLabel:function(event){return dateLabel(event.date)+"｜"+eventKindLabel(event)+"｜"+eventName(event);},
          nameKey:coachNameKey,
          saveAnswer:async function(group,job,baseline){
            if(!sharedReady)throw new Error("出欠クラウドに接続できません。");
            var conflicts=await sharedStore.save(group,job.personId,[{id:job.eventId,value:job.value}],undefined,baseline);
            return !conflicts.size;
          }
        });
      }
      openChouseisanDialog();
    }catch(error){
      alert("CSV取り込み画面を開けませんでした。ページを開き直してください。");
    }finally{
      button.disabled=false;
    }
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
      var directlyLinked=sharedMatchLink?.id===match.id&&sharedMatchLink.date===match.date;
      if(!restore&&!previous&&match.kind==="match"&&!match.seasonOnly&&!isAutomaticMatch(match)&&!directlyLinked)return;
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
      var message=visible.length?visible.length+"件の予定。追加・復元する試合を選んでください。":"出欠の受付期間内に予定はありません。";
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
        if($("match-summary-dialog").open)renderMatchSummary();
        return;
      }
      loading=true;
      syncStatus.textContent="カレンダーを読み込み中…";
      if($("match-summary-dialog").open)renderMatchSummary();
      refresh.disabled=true;
      renderMatches();
      var from=todayISO();
      dialog.dispatchEvent(new CustomEvent("smc-calendar-request",{detail:{from:from,through:maxDate(from)}}));
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
      practiceTransfers.clear();
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

  function setupParticipantEditing(){
    $("day-entry-events").addEventListener("change",function(event){
      if(activeDayEntry)inFamilyGroup(activeDayEntry.group,function(){updateCoachPracticeOptions(event);});
    });
    ["calendar-attendance-people","match-detail-attendance"].forEach(function(id){
      var root=$(id);
      function switchRole(tab){
        selectAttendanceRole(root,tab.dataset.attendanceRole);
        if(id==="match-detail-attendance")$("match-detail-scroll").scrollTop=0;
        else root.scrollIntoView({block:"start"});
        tab.focus({preventScroll:true});
      }
      root.addEventListener("keydown",function(event){
        if(!event.target.matches("[data-attendance-role]")||
          !["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
        var tabs=Array.from(root.querySelectorAll("[data-attendance-role]"));
        var index=event.key==="Home"?0:event.key==="End"?tabs.length-1:1-tabs.indexOf(event.target);
        event.preventDefault();
        switchRole(tabs[index]);
      });
      root.addEventListener("click",function(click){
        var tab=click.target.closest("[data-attendance-role]");
        if(tab){switchRole(tab);return;}
        var button=click.target.closest("[data-participant]");
        if(!button)return;
        enterSelectedPerson(button.dataset.participant,button.dataset.participantGroup,
          {date:root.dataset.eventDate,eventId:root.dataset.eventId},button);
      });
    });
    $("day-entry-form").addEventListener("submit",async function(event){
      event.preventDefault();
      if(!activeDayEntry)return;
      var entry=activeDayEntry,form=new FormData(event.currentTarget);
      var days=groupBoardDays(getBoardEvents()).filter(function(day){return day.date===entry.day.date;});
      if(entry.eventId&&(!days.length||!editableDayEvents(days[0],entry.person,entry.group,entry.eventId).length)){
        event.currentTarget.querySelector("[data-entry-status]").textContent="予定や回答対象が変わりました。一覧で確認してください。";
        return;
      }
      var updates=inFamilyGroup(entry.group,function(){return readEntryUpdates(form,entry.person,days);});
      if(entry.eventId)updates=updates.filter(function(update){return update.id===entry.eventId;});
      if(!await submitEntry(entry.person.id,updates,undefined,event.currentTarget,entry.group))return;
      $("day-entry-dialog").close();
      renderEventList();renderResponse(true);
      reportEntrySaved(updates);
      if(!entry.eventId)focusDayCell(entry.day.date,entry.person.id);
    });
    $("cancel-day-entry").addEventListener("click",function(){$("day-entry-dialog").close();});
    $("day-entry-dialog").addEventListener("close",function(){
      var trigger=dayEntryTrigger;
      if(trigger?.dataset.participant&&!trigger.isConnected){
        var key=trigger.dataset;
        var current=$(calendarView?"calendar-attendance-people":"match-detail-attendance");
        trigger=Array.from(current.querySelectorAll("[data-participant]")).find(function(button){
          return button.dataset.participant===key.participant&&button.dataset.participantGroup===key.participantGroup;
        });
      }
      if(trigger?.isConnected)trigger.focus({preventScroll:true});
      activeDayEntry=null;
      dayEntryTrigger=null;
    });
    $("open-family-entry").addEventListener("click",function(){openFamilyEntry();});
    $("family-existing").addEventListener("change",function(event){
      if(event.target.value)openFamilyEntry(event.target.value,family.scope);
    });
    $("family-picker").addEventListener("submit",function(event){
      event.preventDefault();
      saveFamilyRegistration(false);
    });
    $("family-clear-people").addEventListener("click",function(){saveFamilyRegistration(true);});
    $("family-edit-people").addEventListener("click",function(){
      if(!familyCanDiscard())return;
      family.dirty=false;
      $("family-entry-title").textContent="家族登録を変更";
      $("family-name").value=family.record?.name||"";
      $("family-picker-people").replaceChildren();
      $("family-picker").hidden=false;
      $("family-entry").hidden=true;
      $("family-save").hidden=true;
      $("family-status").textContent="";
      renderFamilyPicker();
    });
    $("family-entries").addEventListener("change",function(event){
      var scope=event.target;
      if(!scope.matches("[data-family-scope]"))return;
      var entry=family.days.get(scope.closest("[data-family-date]").dataset.familyDate);
      if(scope.checked)entry.playersOnly.add(scope.dataset.familyScope);
      else entry.playersOnly.delete(scope.dataset.familyScope);
    });
    $("family-entries").addEventListener("click",function(event){
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
    $("day-entry-dialog").addEventListener("cancel",function(event){
      if(savingShared)event.preventDefault();
    });
  }

  function init(){
    setupParticipantEditing();
    if(calendarView){
      document.body.classList.add("calendar-attendance-embedded");
      $("calendar-attendance-title").hidden=calendarView.parentHeader;
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
    $("open-line-invite").addEventListener("click",openLineInvitation);
    updateSeasonInputs();
    setupBoardViewport();
    $("toggle-board-summary").addEventListener("click",toggleBoardSummary);
    $("board-summary-list").addEventListener("click",function(event){
      var button=event.target.closest("[data-count-event]");
      if(!button)return;
      var key=button.dataset;
      openAttendanceDetail(key.countDate,key.countKind,"",key.countEvent,button,key.countGroup);
    });
    $("year-end-form").addEventListener("submit",saveSeasonPeriod);
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
    $("entry-person").addEventListener("change",function(event){
      var personId=event.currentTarget.value;
      if(!personId){renderAttendanceFormEvents();return;}
      $("attendance-dialog").close();
      enterSelectedPerson(personId);
    });
    $("attendance-dialog").addEventListener("cancel",function(event){if(savingShared)event.preventDefault();});
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
      var fromSummary=$("match-summary-dialog").open;
      activeAttendanceDetail=null;
      if(trigger&&!trigger.isConnected){
        var key=trigger.dataset;
        var source=fromSummary?$("match-summary-list"):$("response-panel");
        if(key.countEvent)trigger=Array.from(source.querySelectorAll("[data-count-event]")).find(function(button){
          return button.dataset.countEvent===key.countEvent&&button.dataset.countGroup===key.countGroup;
        });
        if(key.matchDetail)trigger=$("match-summary-list").querySelector('[data-match-detail="'+CSS.escape(key.matchDetail)+'"]');
      }
      trigger?.focus({preventScroll:true});
    });
    $("match-summary-list").addEventListener("click",function(event){
      var detail=event.target.closest("[data-match-detail]");
      if(detail){
        openAttendanceDetail(detail.dataset.matchDate,"match","",detail.dataset.matchDetail,detail,audience,true);
        return;
      }
      var count=event.target.closest("[data-count-event]");
      if(count){
        var key=count.dataset;
        openAttendanceDetail(key.countDate,"match","",key.countEvent,count,key.countGroup);
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
      renderMatchSummary();
      $("match-summary-list").querySelector('[data-match-detail="'+CSS.escape(match.id)+'"]')?.focus({preventScroll:true});
    });
    $("attendance-form-events").addEventListener("change",updateCoachPracticeOptions);
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
    $("open-match-summary").addEventListener("click",openMatchSummary);
    $("open-add-coach").addEventListener("click",openCoachRegistration);
    $("entry-add-coach").addEventListener("click",openCoachRegistration);
    $("close-add-coach").addEventListener("click",function(){$("add-coach-dialog").close();});
    $("add-coach-dialog").addEventListener("cancel",function(event){if($("save-new-coach").disabled)event.preventDefault();});
    $("add-coach-form").addEventListener("submit",saveCoachRegistration);

    document.querySelectorAll(".audience-tab").forEach(function(btn){btn.addEventListener("click",function(){audience=btn.dataset.audience;if(audience==="coaches")readStaffCoaches();selectedGrade="すべて";document.querySelectorAll(".audience-tab").forEach(function(tab){var active=tab===btn;tab.classList.toggle("active",active);tab.setAttribute("aria-pressed",active?"true":"false");});render();});});
    $("cancel-event").addEventListener("click",function(){$("event-dialog").close();});$("event-form").addEventListener("submit",function(e){e.preventDefault();var title=$("event-title").value.trim();if(!title)return;if(selectedDate<todayISO()||selectedDate>maxDate()||!isDefaultDay(selectedDate)){alert("今日から翌々月末までの対象日を一覧から選んでください。");return;}var kind=$("event-kind").value,dayId=defaultEvent(selectedDate).id;
      var reuseDay=kind==="practice"&&!eventForDate(selectedDate).some(function(event){return event.id===dayId||event.kind==="practice";});
      var id=reuseDay?dayId:"demo_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7);state.events.push({id:id,date:selectedDate,kind:$("event-kind").value,title:title,place:$("event-place").value.trim(),createdAt:new Date().toISOString()});saveState();$("event-dialog").close();openEvent(id);});
    $("entry-mode-button").addEventListener("click",function(){if(!requireSharedConnection())return;if(getPeople().length){openAttendanceForm("");return;}if(audience==="coaches"&&!state.coaches.length){$("coach-local-editor").open=true;$("coach-editor").scrollIntoView({behavior:"smooth",block:"center"});$("coach-name-input").focus({preventScroll:true});return;}});$("transpose-board").addEventListener("click",function(){transposeBoard=!transposeBoard;renderResponse();});$("cancel-attendance").addEventListener("click",function(){$("attendance-dialog").close();});$("attendance-form").addEventListener("submit",saveAttendanceForm);$("export-csv").addEventListener("click",openCsv);$("import-chouseisan").addEventListener("click",openChouseisan);$("reset-demo").addEventListener("click",function(){if(!confirm("この端末に保存した試作の予定・回答・コーチ名をすべて削除しますか？団員名簿は変更されません。"))return;state={events:[],archive:[],coaches:[],coachLinks:{},answers:{},notes:{},matchNotes:{}};selectedEventId="";selectedDate="";localStorage.removeItem(STORAGE_KEY);render();});$("add-coach").addEventListener("click",function(){var input=$("coach-name-input"),name=input.value.trim();if(!name){input.focus();return;}if(getPeople().some(function(c){return coachNameKey(c.name)===coachNameKey(name);})){alert("同じ名前がすでに登録されています。");return;}state.coaches.push({id:"coach_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6),name:name});input.value="";saveState();render();});
    $("archive-list").addEventListener("click",handleEventListClick);
    render();loadHolidays();
    if(params.has("line-invite")&&!params.has("match"))openLineInvitation();
    if(sharedMatchLink)window.setTimeout(function(){
      if(sharedMatchLink)showSharedMatchStatus("試合の確認に時間がかかっています。通信状況を確認して、ページを開き直してください。");
    },12000);
  }
  document.addEventListener("DOMContentLoaded",init);
})();
