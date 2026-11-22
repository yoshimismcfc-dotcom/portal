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
  var staffCoaches=[],coachRosterStarted=false,coachRosterStatus="コーチ担当を読み込み中…";
  var previewRosterStarted=false, sharedStore, sharedRows=new Map(), sharedReady=false, savingShared=false, entryBaseline;
  if(!deviceMode){state.answers={};state.matchNotes={};state.notes={};state.coaches=[];state.coachLinks={};}
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
      var regular=defaultEvent(iso);
      if(isDefaultDay(iso)&&!registered.some(function(event){return event.id===regular.id||event.kind!=="match";})){
        if(registered.length)regular.kind="practice";
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
  function eventForDate(iso){return state.events.filter(function(e){return e.date===iso&&!e.hidden&&!e.calendarInactive;});}
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
  function renderEventList(){
    var active=state.events.filter(function(event){return !event.hidden&&!event.calendarInactive;}).sort(function(a,b){return a.date.localeCompare(b.date)||a.title.localeCompare(b.title,"ja");});
    var days=new Map(groupBoardDays(active).map(function(day){return [day.date,day];}));
    var list=$("event-list");
    if(!active.length){
      list.innerHTML='<div class="empty-state">日程を選ぶと予定の詳細を追加できます。</div>';
    }else{
      list.innerHTML=active.map(function(event){
        var c=countAnswers([event],getPeople(),days.get(event.date));
        var unanswered=audience==="players"&&event.kind==="match"&&!targetGrades(event)?"対象学年未設定":"未回答 "+(c.eligible-c.attending-c.maybe-c.absent);
        return '<article class="event-card'+(selectedEventId===event.id?" selected":"")+'"><button class="event-open" type="button" data-open-event="'+esc(event.id)+'"><strong>'+esc(event.title)+'</strong><span class="event-meta"><span>'+dateLabel(event.date)+'</span><span class="kind-badge '+(event.kind==="match"?"match":"")+'">'+(event.kind==="match"?"試合":"練習")+'</span>'+(event.place?'<span>'+esc(event.place)+'</span>':"")+"</span></button><span class=\"event-count\">参加 <b>"+c.attending+"/"+c.eligible+"</b> ・未定 "+c.maybe+'<br>'+unanswered+'</span><button type="button" class="delete-event" data-delete-event="'+esc(event.id)+'" aria-label="'+(event.id.startsWith("calendar_")?"この試合を表から非表示":"この予定を削除")+'">'+(event.id.startsWith("calendar_")?"非表示":"削除")+'</button></article>';
      }).join("");
    }
    list.querySelectorAll("[data-open-event]").forEach(function(btn){btn.addEventListener("click",function(){openEvent(btn.dataset.openEvent);});});
    list.querySelectorAll("[data-delete-event]").forEach(function(btn){
      btn.addEventListener("click",function(){
        var event=state.events.find(function(e){return e.id===btn.dataset.deleteEvent;});
        if(!event)return;
        if(event.id.startsWith("calendar_")){
          event.hidden=true;
          if(!saveState()){delete event.hidden;return;}
        }else{
          if(!confirm("「"+event.title+"」を試作データから削除しますか？"))return;
          state.events=state.events.filter(function(item){return item.id!==event.id;});
          delete state.answers[event.id];
          delete state.matchNotes[event.id];
          saveState();
        }
        if(selectedEventId===event.id)selectedEventId="";
        render();
      });
    });
    var archive=document.getElementById("archive-list");if(archive){archive.innerHTML=state.archive.length?state.archive.slice().sort(function(a,b){return b.date.localeCompare(a.date);}).map(function(e){return '<div class="event-card"><span><strong>'+esc(e.title)+'</strong><span class="event-meta">'+dateLabel(e.date)+' · 過去の予定（端末内保管）</span></span><span class="kind-badge">保存済み</span></div>';}).join(""):'<div class="empty-state">過去の予定はありません。</div>';}
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
        linkLocalCoachAnswers();
        coachRosterStatus=staffCoaches.length?"コーチ担当から"+staffCoaches.length+"名を表示":"コーチ担当に登録された名前がありません。";
      }else{
        coachRosterStatus="コーチ担当を確認できませんでした。通信状況を確認して、画面を開き直してください。";
      }
      if(audience==="coaches"){renderEventList();renderResponse(true);}
    },null,null);
  }

  function getPeople(){
    if(audience==="players")return members;
    var linked=staffCoaches.map(function(coach){
      return {id:state.coachLinks[coach.source]||coach.source,name:coach.name,fromStaff:true};
    });
    var linkedIds=new Set(linked.map(function(coach){return coach.id;}));
    return linked.concat(state.coaches.filter(function(coach){return !linkedIds.has(coach.id);}));
  }
  function answerMark(value){return value==="attending"?"○":value==="maybe"?"△":value==="absent"?"×":"";}

  var activeDayEntry=null, dayEntryTrigger=null, activeMatchSummary=null;

  function groupBoardDays(events){
    var days=new Map();
    events.forEach(function(event){
      if(!days.has(event.date))days.set(event.date,{date:event.date,practice:[],matches:[]});
      var day=days.get(event.date);
      (event.kind==="match"?day.matches:day.practice).push(event);
    });
    return Array.from(days.values());
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
    var weekday=fromISO(event.date).getDay();
    if(weekday===3)return GRADES.slice(0,3).includes(grade)?"":"対象外";
    if(weekday===4)return GRADES.slice(3).includes(grade)?"":"対象外";
    return "";
  }

  function responseRestriction(event,person,day){
    return eligibility(event,person)||
      (audience==="players"&&event.kind!=="match"&&day?.matches.some(function(match){return !eligibility(match,person);})?"試合優先":"");
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
    return "対象 "+total.eligible+"名　参加 "+total.attending+"　未定 "+total.maybe+
      "　不参加 "+total.absent+"　未回答 "+(total.eligible-total.attending-total.maybe-total.absent);
  }

  function dayHeading(day,people){
    var heading='<span class="board-date">'+esc(compactDate(day.date))+'<span class="day-calendar-icon" aria-hidden="true">▦</span></span>';
    var totals=countAnswers(day.practice.concat(day.matches),people,day);
    heading+='<span class="event-count-summary">'+compactTotal(totals)+'</span>';
    var label=dateLabel(day.date)+"の予定を開く。"+(day.practice.length+day.matches.length>1?"延べ":"")+"対象"+totals.eligible+"、参加"+totals.attending+"、未定"+totals.maybe+"、不参加"+totals.absent;
    var categories=matchCategoryLabel(day.matches);
    var summary=categories?'<button type="button" class="preview-day-summary" data-match-date="'+esc(day.date)+
      '" aria-haspopup="dialog" aria-label="'+esc(compactDate(day.date)+"の試合集計 "+categories)+'">'+esc(categories)+'</button>':
      '<span class="preview-day-summary-space" aria-hidden="true"></span>';
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
    var practice=practiceEvents.map(function(event){return answerValue(event,person);}).filter(Boolean);
    var eligible=day.matches.filter(function(event){return !eligibility(event,person);});
    var answered=eligible.map(function(event){
      return {label:event.category||"試合",value:answerValue(event,person)};
    }).filter(function(answer){return answer.value;});
    var first=answered[0];
    var badge=first?'<span class="day-match-chip" data-value="'+esc(first.value)+'">'+esc(first.label)+(first.value==="attending"?"":answerMark(first.value))+'</span>':"";
    var extra=answered.length>1?'<span class="day-more">＋'+(answered.length-1)+'</span>':"";
    var marks=practice.map(answerMark).join(" ");
    var review=eligible.some(function(match){return needsMatchReview(match,person,day);});
    var reviewBadge=review?'<span class="board-review">要確認</span>':"";
    if(!practiceEvents.length&&!eligible.length){
      var restrictions=day.matches.map(function(event){return eligibility(event,person);});
      var reason=restrictions.includes("招集対象外")?"招集対象外":restrictions.includes("対象学年未設定")?"対象学年未設定":"対象外";
      return '<span class="board-ineligible">'+reason+'</span>';
    }
    var description=(marks?"練習 "+marks:"")+(answered.length?" "+answered.map(function(answer){return answer.label+" "+answerMark(answer.value);}).join("、"):"");
    var cycle=deviceMode&&day.matches.length===0&&day.practice.length===1;
    var style=cycle?"board-mark editable":"board-mark editable day-answer";
    return '<button type="button" class="'+style+'" data-answer-date="'+esc(day.date)+'" data-answer-person="'+esc(person.id)+
      '" data-value="'+esc(practice[0]||"")+'" aria-label="'+esc(person.name+" "+dateLabel(day.date)+" "+(review?"要確認。":"")+(description.trim()||"未回答")+(cycle?"。タップで回答を切り替え":"。出欠を入力"))+'">'+
      (day.matches.length===0&&day.practice.length===1?marks:(marks?'<span class="day-practice-mark">'+marks+'</span>':"")+reviewBadge+badge+extra)+'</button>';
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

  function startSharedAttendance(){
    if(!/^[a-f0-9]{48}$/.test(previewKey)){
      $("shared-attendance-status").textContent="案内されたテスト用リンクを開いてください。";
      return;
    }
    import("./attendance-preview-store.mjs?v=20261122-8").then(function(module){
      return module.loadSharedAttendance(previewKey);
    }).then(function(store){
      sharedStore=store;
      store.recruitment.listen(function(records){
        recruitmentRows=records;
        recruitmentReady=true;
        renderEventList();
        renderResponse(true);
        refreshSharedMatchSummary();
      },function(){
        recruitmentReady=false;
        refreshSharedMatchSummary();
      });
      store.listen(function(records){
        sharedRows=records;
        sharedReady=true;
        if(!previewRosterStarted){
          previewRosterStarted=true;
          readRoster();
          if(audience==="coaches")readStaffCoaches();
        }
        var answers=Object.create(null), notes=Object.create(null), contacts=Object.create(null);
        records.forEach(function(row,id){
          var event=row.eventId,group=row.group,person=row.personId;
          if(id!==store.key(event,group,person))return;
          if(event){
            var groups=answers[event]||=Object.create(null);
            var replies=groups[group]||=Object.create(null);
            replies[person]={value:row.value,updatedAt:row.updatedAt?.toDate?.().toISOString()||""};
            if(group==="players"&&Object.keys(row.contact).length){
              (contacts[event]||=Object.create(null))[person]=row.contact;
            }
          }else{
            (notes[group]||=Object.create(null))[person]=row.note;
          }
        });
        Object.assign(state,{answers:answers,notes:notes,matchNotes:contacts});
        $("shared-attendance-status").textContent="テスト用リンクを開いた人がログインなしで閲覧・編集できます。";
        renderEventList();
        renderResponse(true);
        refreshSharedMatchSummary();
      },function(message){
        sharedReady=false;
        $("shared-attendance-status").textContent=message;
        renderResponse(true);
      });
    }).catch(function(){
      $("shared-attendance-status").textContent="クラウド出欠を開始できません。ページを開き直してください。";
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
    var beforeMatchNotes=state.matchNotes;
    var matchNotes={...beforeMatchNotes};
    var answers={...before};
    updates.forEach(function(update){
      if(update.contact!==undefined){
        var contacts={...matchNotes[update.id]};
        if(update.contact)contacts[personId]=update.contact;
        else delete contacts[personId];
        if(Object.keys(contacts).length)matchNotes[update.id]=contacts;
        else delete matchNotes[update.id];
      }
      var current=before[update.id]?.[audience]||{};
      if((current[personId]?.value||"")===update.value)return;
      var replies={...current};
      if(update.value)replies[personId]={value:update.value,updatedAt:timestamp};
      else delete replies[personId];
      answers[update.id]={...before[update.id],[audience]:replies};
    });
    state.answers=answers;
    state.matchNotes=matchNotes;
    if(note!==undefined){
      var notes={...beforeNotes[audience]};
      if(note)notes[personId]=note;
      else delete notes[personId];
      state.notes={...beforeNotes,[audience]:notes};
    }
    if(!saveState()){state.answers=before;state.notes=beforeNotes;state.matchNotes=beforeMatchNotes;return false;}
    return true;
  }

  function eventName(event){
    var kind=event.kind==="match"?(event.category?event.category+" 試合":"試合"):"練習";
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
    var events=day.practice.concat(day.matches).filter(function(event){return canAnswer(event,person,day);});
    if(!events.length)return "";
    return '<section class="entry-day">'+
      (showDate?'<h3>'+calendarLink(day.date,esc(dateLabel(day.date)),"entry-date-link")+'</h3>':"")+
      events.map(function(event){
        var match=event.kind==="match",current=answerValue(event,person);
        var title=event.title||(match?"試合":"練習");
        var review=match&&needsMatchReview(event,person,day);
        var choices=ANSWERS.concat({value:"",label:"未回答"});
        return '<article class="response-entry-card '+(match?"is-match":"")+'"'+(review?' data-needs-review="true"':"")+'>'+
          '<div class="entry-card-heading"><span class="entry-kind">'+(match?"試合":"練習")+'</span><h4>'+esc(title)+'</h4></div>'+
          (event.startTime||event.place?'<p class="entry-card-meta">'+esc([event.startTime,event.place].filter(Boolean).join(" ・ "))+'</p>':"")+
          (review?'<p class="entry-review"><strong>要確認</strong> 練習に○で回答済みです。試合の出欠を入力してください。</p>':"")+
          '<div class="entry-answer-options" role="group" aria-label="'+esc(title+"の出欠")+'">'+choices.map(function(option){
            return '<label><input type="radio" name="answer-'+esc(event.id)+'" value="'+esc(option.value)+'"'+
              (option.value===current?" checked":"")+'><span><b>'+answerMark(option.value)+'</b>'+option.label+'</span></label>';
          }).join("")+'</div>'+
          (match&&audience==="players"?contactEditor(event,person):"")+
          matchCalendarAction(event)+'</article>';
      }).join("")+'</section>';
  }

  function contactEditor(event,person){
    var note=state.matchNotes[event.id]?.[person.id]||{};
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
      return day.practice.concat(day.matches).filter(function(item){
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
    $("match-summary-list").querySelectorAll("[data-target-event]").forEach(function(section){
      var event=summary.day.matches.find(function(match){return match.id===section.dataset.targetEvent;});
      if(!event)return;
      section.querySelector(".preview-match-count").textContent=matchCountLabel(countAnswers([event],summary.people));
      section.querySelector(".match-target-note").textContent=matchTargetLabel(event);
      var edit=section.querySelector("[data-recruit-event]");
      if(edit)edit.disabled=!recruitmentReady||!members.length;
      section.querySelectorAll("[data-summary-group]").forEach(function(table){
        var group=table.dataset.summaryGroup;
        var people=group===audience?eligiblePeople(event,summary.people):
          members.filter(function(person){return !eligibility(event,person,"players");});
        table.outerHTML=matchAttendanceTable(event,people,group);
      });
    });
  }

  function matchTargetLabel(event){
    var grades=targetGrades(event);
    var players=members.filter(function(person){return !eligibility(event,person,"players");}).length;
    var individual=members.filter(function(person){return recruitmentDecision(event,person)==="include";}).length;
    return (grades?"対象学年 "+grades.join("・"):"対象学年未設定")+"／団員 "+players+"名"+
      (individual?"（個別招集 "+individual+"名）":"");
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
      var hasRecord=Boolean(answer||matchComment(state.matchNotes[event.id]?.[person.id]));
      recruitmentEdit.initial.set(person.id,decision);
      var alternate=base?"exclude":"include";
      var options=[["default",base?"対象済み":"対象外"],[alternate,base?"招集しない":"個別招集"]];
      if(decision!=="default"&&decision!==alternate)options.push([decision,decision==="include"?"個別招集":"招集しない"]);
      return '<label class="recruitment-member" data-recruit-person="'+esc(person.id)+'" data-search="'+
        esc([person.grade,person.name,person.kana].join(" ").normalize("NFKC").replace(/\s+/g,"").toLowerCase())+'"><span>'+
        esc(person.grade+" "+person.name)+(hasRecord?"<small>回答・連絡あり</small>":"")+'</span>'+
        '<select aria-label="'+esc(person.name+"の招集区分")+'">'+options.map(function(option){
          return '<option value="'+option[0]+'"'+(decision===option[0]?" selected":"")+'>'+option[1]+'</option>';
        }).join("")+'</select></label>';
    }).join("");
    updateRecruitmentCount();
    $("recruitment-dialog").showModal();
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
        (answerValue(edit.event,person,"players")||matchComment(state.matchNotes[edit.event.id]?.[person.id]));
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
      var grades=targetGrades(event),eligible=eligiblePeople(event,people);
      var target=matchTargetLabel(event);
      var table=audience==="coaches"?matchAttendanceTable(event,eligible,audience)+
        '<h4>団員の出欠・コメント</h4>'+matchAttendanceTable(event,members.filter(function(person){
          return !eligibility(event,person,"players");
        }),"players"):matchAttendanceTable(event,eligible,audience);
      return '<section class="match-summary-event" data-target-event="'+esc(event.id)+'"><h3>'+esc(eventName(event))+'</h3>'+
        '<div class="preview-match-count">'+matchCountLabel(countAnswers([event],people))+'</div>'+
        '<div class="match-target-note">'+esc(target)+'</div>'+
        (table?'<details class="preview-match-details"'+(day.matches.length===1?" open":"")+'><summary>出欠・コメントの内訳</summary>'+table+'</details>':"")+
        matchCalendarAction(event)+(!deviceMode?
          '<button type="button" class="secondary-button day-details-action" data-recruit-event="'+esc(event.id)+'"'+
          (recruitmentReady&&members.length?"":" disabled")+'>招集選手を編集</button>':"")+(audience==="coaches"?targetGradeEditor(event,grades):"")+'</section>';
    }).join("");
    var dialog=$("match-summary-dialog");
    if(!dialog.open){
      dialog.showModal();
      $("match-summary-list").parentElement.scrollTop=0;
    }
  }

  function matchAttendanceTable(event,people,group){
    var answers=ANSWERS.concat({value:"",label:"未回答"});
    var showComments=group==="players";
    var totals=answers.map(function(answer){
      var count=people.filter(function(person){return answerValue(event,person,group)===answer.value;}).length;
      return '<tr class="match-attendance-total"><th scope="row">'+esc((answerMark(answer.value)+" "+answer.label).trim())+
        '</th><td>'+count+'人</td>'+ (showComments?'<td></td>':"") +'</tr>';
    }).join("");
    var rows=people.map(function(person){
      var value=answerValue(event,person,group);
      var label=answers.find(function(answer){return answer.value===value;})?.label||"未回答";
      var grade=group==="players"&&person.grade?'<span class="match-attendance-grade">'+esc(person.grade)+'</span>':"";
      var invite=group==="players"&&recruitmentDecision(event,person)==="include"?'<span class="recruitment-badge">個別招集</span>':"";
      return '<tr><th scope="row" class="match-attendance-name">'+grade+(grade?" ":"")+esc(person.name)+invite+
        '</th><td data-value="'+esc(value)+'" aria-label="'+esc(label)+'">'+esc(answerMark(value)||"—")+'</td>'+
        (showComments?'<td>'+esc(matchComment(state.matchNotes[event.id]?.[person.id])||"—")+'</td>':"")+'</tr>';
    }).join("");
    return '<div class="match-attendance-wrap" data-summary-group="'+esc(group)+'"><table class="match-attendance-table'+(showComments?" has-comments":"")+'"><thead><tr><th scope="col">参加者</th>'+
      '<th scope="col" aria-label="出欠 '+esc(dateLabel(event.date))+'">出欠</th>'+
      (showComments?'<th scope="col">コメント・連絡事項</th>':"")+'</tr></thead><tbody>'+totals+'</tbody><tbody>'+rows+'</tbody></table></div>';
  }

  function matchComment(note){
    if(!note)return "";
    return [
      note.ride&&("送迎希望"+(note.rideTrip?"（"+note.rideTrip+"）":"")),
      note.early&&("早退"+(note.earlyTime?"（"+note.earlyTime+"）":"")),
      note.late&&("遅刻・途中参加"+(note.lateTime?"（"+note.lateTime+"）":"")),
      note.other&&"その他",
      note.message
    ].filter(Boolean).join("・");
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
    $("entry-mode-button").disabled=(!deviceMode&&!sharedReady)||!getPeople().length;
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
    var dateWidth=0;
    newBoard.querySelectorAll("th[data-board-date]").forEach(function(cell){
      var button=cell.querySelector(".preview-day-summary");
      var extra=button?Math.max(0,button.scrollWidth-button.clientWidth):0;
      dateWidth=Math.max(dateWidth,Math.ceil(cell.getBoundingClientRect().width+extra));
    });
    if(dateWidth)newBoard.style.setProperty("--preview-date-width",dateWidth+"px");
    if(preserveScroll){newBoard.scrollTop=savedTop;newBoard.scrollLeft=savedLeft;}
    var daysByDate=new Map(days.map(function(day){return [day.date,day];}));
    var peopleById=new Map(people.map(function(person){return [person.id,person];}));
    rows.querySelectorAll("[data-edit-person]").forEach(function(btn){
      btn.addEventListener("click",function(){
        if(deviceMode||sharedReady)openAttendanceForm(btn.dataset.editPerson);
      });
    });
    rows.querySelectorAll("[data-answer-date]").forEach(function(btn){
      btn.addEventListener("click",function(){
        var day=daysByDate.get(btn.dataset.answerDate),person=peopleById.get(btn.dataset.answerPerson);
        if(!deviceMode){if(sharedReady)openDayEntry(day,person,btn);return;}
        if(day.matches.length||day.practice.length!==1){openDayEntry(day,person,btn);return;}
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
  function addEvent(){if(!selectedDate||!isDefaultDay(selectedDate)){alert("出欠予定は水・木・土・日・祝日から選んでください。");return;}$("dialog-date").textContent=dateLabel(selectedDate)+(holidays[selectedDate]?" · "+holidays[selectedDate]:"");$("event-title").value=fromISO(selectedDate).getDay()===3?"通常練習":fromISO(selectedDate).getDay()===4?"低学年練習":"";$("event-place").value="";$("event-dialog").showModal();}
  function exportCsv(){
    var people=getPeople(),active=getBoardEvents();
    var days=new Map(groupBoardDays(active).map(function(day){return [day.date,day];}));
    var rows=[["対象","日付","種類","予定名","会場","名前","学年","出欠","備考","最終更新","カテゴリー","開始時刻"]];
    var events=active.concat(state.events.filter(function(item){return item.hidden||item.calendarInactive;}),state.archive,pastDefaultEvents());
    events.sort(function(a,b){return a.date.localeCompare(b.date);}).forEach(function(event){
      var table=state.answers[event.id]?.[audience]||{};
      people.forEach(function(person){
        var response=table[person.id]||{};
        var label=ANSWERS.find(function(answer){return answer.value===response.value;})?.label;
        var day=days.get(event.date);
        label=responseRestriction(event,person,day)||label;
        if(event.calendarInactive)label=label?"カレンダー対象外（記録："+label+"）":"カレンダー対象外";
        rows.push([audience==="players"?"団員":"コーチ",event.date,event.kind==="match"?"試合":event.kind==="practice"?"練習":"",
          event.title,event.place||"",person.name,person.grade||"",label||"未回答",
          [state.notes[audience]?.[person.id],audience==="players"?matchComment(state.matchNotes[event.id]?.[person.id]):""].filter(Boolean).join("・"),response.updatedAt||"",event.category||"",event.startTime||""]);
      });
    });
    function cell(value){
      var text=String(value==null?"":value);
      if(/^[=+\-@\t\r]/.test(text))text="'"+text;
      return '"'+text.replace(/"/g,'""')+'"';
    }
    var csv="\uFEFF"+rows.map(function(row){return row.map(cell).join(",");}).join("\r\n");
    var blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;
    link.download=(deviceMode?"吉見SMC_出欠試作_":"吉見SMC_出欠_")+(audience==="players"?"団員":"コーチ")+"_"+todayISO()+".csv";
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},0);
  }
  function calendarMatch(event){
    if(!event.sourceId||!/^U(?:[7-9]|1[0-2])$/.test(event.label))return null;
    var timed=/T/.test(event.start);
    var start=timed?new Date(event.start):null;
    if(start&&isNaN(start.getTime()))return null;
    var date=start?new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",dateStyle:"short"}).format(start):event.start;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<todayISO()||date>maxDate())return null;
    var time=start?new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(start):"";
    return {
      id:"calendar_"+encodeURIComponent(event.sourceId),date:date,startTime:time,
      kind:"match",category:event.label,title:event.title,place:event.location||"",
      calendarUrl:safeCalendarEventUrl(event.url),
      targetGrades:window.SMCCalendarAttendance.targetGrades(event.description,event.title)
    };
  }

  function isAutomaticMatch(match){
    var title=match.title.normalize("NFKC");
    var isMatch=/試合|大会|交流戦|対抗戦|招待|カップ|リーグ|トレマ|フェス|マッチ|\b(?:TM|TRM|CUP|LEAGUE)\b|[vV][sS][.．]/i.test(title);
    return isMatch||!/練習|トレーニング|会議|総会|説明会|保護者会|審判講習|予備日/.test(title);
  }

  function cancelledMatch(match){
    return /中止|キャンセル|活動なし|お休み|^\s*(?:OFF|休み)\s*$/i.test(match.title.normalize("NFKC"));
  }

  function syncCalendarMatches(matches,restore,failed){
    var events=new Map(state.events.map(function(event){return [event.id,event];}));
    var archived=new Set(state.archive.map(function(event){return event.id;}));
    var resumed=new Set(),changed=false;
    if(failed){
      var received=new Set(matches.filter(function(match){return !cancelledMatch(match);}).map(function(match){return match.id;}));
      events.forEach(function(event,id){
        if(id.startsWith("calendar_")&&!event.calendarInactive&&!failed.includes(event.category)&&!received.has(id)){
          events.set(id,{...event,calendarInactive:true});
          changed=true;
        }
      });
    }
    matches.forEach(function(match){
      if(cancelledMatch(match))return;
      var previous=events.get(match.id);
      if(!restore&&!previous&&!isAutomaticMatch(match))return;
      var hidden=previous?.hidden&&!restore;
      if(previous&&!previous.calendarInactive&&Boolean(previous.hidden)===Boolean(hidden)&&
        ["date","startTime","title","place","category","calendarUrl"].every(function(key){return previous[key]===match[key];})&&
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
      var visible=matches.filter(function(match){return !cancelledMatch(match)&&(!category.value||match.category===category.value);});
      list.replaceChildren();
      if(loading){status.textContent="カレンダーを読み込んでいます…";return;}
      var message=visible.length?visible.length+"件の予定。試合をタップすると、出欠表の該当日に移動します。":"2か月以内の予定がありません。";
      if(failed.length===6)message="カレンダーを取得できませんでした。再読み込みをお試しください。";
      else if(failed.length)message+=" "+failed.join("・")+"は読み込めませんでした。";
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
        action.textContent=active?.hidden?"非表示・表に戻す":active?"追加済み・出欠表を開く":"出欠表に追加";
        button.append(action);
        button.addEventListener("click",function(){
          if(!syncCalendarMatches([match],true))return;
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
      matches=event.detail.events.map(calendarMatch).filter(Boolean).sort(function(a,b){
        return a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime,"ja")||a.category.localeCompare(b.category,"ja",{numeric:true});
      });
      failed=event.detail.failed;
      var saved=syncCalendarMatches(matches,false,failed);
      var visible=matches.filter(function(match){
        return state.events.some(function(item){return item.id===match.id&&!item.hidden&&!item.calendarInactive;});
      }).length;
      syncStatus.textContent=!saved?"試合を保存できませんでした。":
        failed.length===6?"カレンダーを読み込めませんでした。":
        "カレンダー連携："+visible+"件の試合"+(failed.length?"（"+failed.join("・")+"は取得できませんでした）":"");
      renderDateOptions();renderEventList();renderResponse(true);
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
    if(dialog.dataset.calendarReady==="true"||document.readyState==="complete")requestMatches();
    else window.addEventListener("load",requestMatches,{once:true});
  }

  function init(){
    ["attendance-dialog","day-entry-dialog"].forEach(function(id){
      $(id).addEventListener("cancel",function(event){if(savingShared)event.preventDefault();});
    });
    $("shared-attendance-status").hidden=deviceMode;
    if(!deviceMode)startSharedAttendance();
    $("reset-demo").hidden=!deviceMode;
    $("device-trial-link").hidden=deviceMode;
    $("cloud-entry-return").hidden=!deviceMode;movePastEvents();
    setupCalendarMatchPicker();
    $("recruitment-search").addEventListener("input",function(event){
      var query=event.target.value.normalize("NFKC").replace(/\s+/g,"").toLowerCase();
      $("recruitment-members").querySelectorAll("[data-search]").forEach(function(row){row.hidden=!row.dataset.search.includes(query);});
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
    $("match-summary-list").addEventListener("click",function(event){
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
    document.querySelectorAll(".audience-tab").forEach(function(btn){btn.addEventListener("click",function(){audience=btn.dataset.audience;if(audience==="coaches"&&sharedReady)readStaffCoaches();selectedGrade="すべて";document.querySelectorAll(".audience-tab").forEach(function(tab){var active=tab===btn;tab.classList.toggle("active",active);tab.setAttribute("aria-pressed",active?"true":"false");});render();});});
    $("add-event").addEventListener("click",addEvent);$("cancel-event").addEventListener("click",function(){$("event-dialog").close();});$("event-form").addEventListener("submit",function(e){e.preventDefault();var title=$("event-title").value.trim();if(!title)return;if(selectedDate<todayISO()||selectedDate>maxDate()||!isDefaultDay(selectedDate)){alert("出欠予定は今日から2か月先までの水・木・土・日・祝日から登録してください。");return;}var kind=$("event-kind").value,dayId=defaultEvent(selectedDate).id;
      var reuseDay=kind==="practice"&&!eventForDate(selectedDate).some(function(event){return event.id===dayId||event.kind==="practice";});
      var id=reuseDay?dayId:"demo_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7);state.events.push({id:id,date:selectedDate,kind:$("event-kind").value,title:title,place:$("event-place").value.trim(),createdAt:new Date().toISOString()});saveState();$("event-dialog").close();openEvent(id);});
    $("entry-mode-button").addEventListener("click",function(){if(!deviceMode&&!sharedReady)return;if(getPeople().length){openAttendanceForm("");return;}if(audience==="coaches"&&!state.coaches.length){$("coach-local-editor").open=true;$("coach-editor").scrollIntoView({behavior:"smooth",block:"center"});$("coach-name-input").focus({preventScroll:true});return;}});$("entry-mode-icon").addEventListener("click",function(){$("entry-mode-button").click();});$("transpose-board").addEventListener("click",function(){transposeBoard=!transposeBoard;renderResponse();});$("cancel-attendance").addEventListener("click",function(){$("attendance-dialog").close();});$("attendance-form").addEventListener("submit",saveAttendanceForm);$("entry-person").addEventListener("change",renderAttendanceFormEvents);$("export-csv").addEventListener("click",exportCsv);$("reset-demo").addEventListener("click",function(){if(!confirm("この端末に保存した試作の予定・回答・コーチ名をすべて削除しますか？団員名簿は変更されません。"))return;state={events:[],archive:[],coaches:[],coachLinks:{},answers:{},notes:{},matchNotes:{}};selectedEventId="";selectedDate="";localStorage.removeItem(STORAGE_KEY);render();});$("add-coach").addEventListener("click",function(){var input=$("coach-name-input"),name=input.value.trim();if(!name){input.focus();return;}if(getPeople().some(function(c){return coachNameKey(c.name)===coachNameKey(name);})){alert("同じ名前がすでに登録されています。");return;}state.coaches.push({id:"coach_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6),name:name});input.value="";saveState();render();});
    var archiveSection=document.createElement("section");archiveSection.className="panel archived-panel";archiveSection.innerHTML='<details><summary>過去の予定（試作データ）</summary><div id="archive-list" class="event-list"></div><p class="small-note">日付が過ぎた予定は一覧から自動で移し、試作版の回答記録はCSV出力用にこの端末へ残しています。</p></details>';$("event-panel").after(archiveSection);
    render();loadHolidays();
  }
  document.addEventListener("DOMContentLoaded",init);
})();
