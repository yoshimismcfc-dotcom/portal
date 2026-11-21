(function(){
  "use strict";
  var STORAGE_KEY="yoshimi_smc_attendance_prototype_v1";
  var GRADES=["6年","5年","4年","3年","2年","1年","年長"];
  var DAY_NAMES=["日","月","火","水","木","金","土"];
  var ANSWERS=[{value:"attending",label:"参加"},{value:"maybe",label:"未定"},{value:"absent",label:"不参加"}];
  var state=loadState(),members=[],rosterState="読み込み中",holidays={},audience="players",selectedDate="",selectedEventId="",selectedGrade="すべて",editingPersonId="",formAnswers={},transposeBoard=false;
  var staffCoaches=[],coachRosterStarted=false,coachRosterStatus="コーチ担当を読み込み中…";
  var $=function(id){return document.getElementById(id);};
  function loadState(){try{var value=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");return {events:Array.isArray(value.events)?value.events:[],archive:Array.isArray(value.archive)?value.archive:[],coaches:Array.isArray(value.coaches)?value.coaches:[],coachLinks:value.coachLinks&&typeof value.coachLinks==="object"&&!Array.isArray(value.coachLinks)?value.coachLinks:{},answers:value.answers&&typeof value.answers==="object"?value.answers:{},notes:value.notes&&typeof value.notes==="object"?value.notes:{}};}catch(e){return {events:[],archive:[],coaches:[],coachLinks:{},answers:{},notes:{}};}}
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
  function eventDetails(event){
    var kind=event.kind==="match"?((event.category?event.category+" ":"")+"試合"):event.kind==="practice"?"練習":"";
    return (kind?'<span class="board-kind">'+esc(kind)+'</span>':"")+
      (event.startTime?'<span class="board-event-time">'+esc(event.startTime)+'</span>':"")+
      (event.title?'<span class="board-event-title" title="'+esc(event.title)+'">'+esc(event.title)+'</span>':"");
  }
  function eventForDate(iso){return state.events.filter(function(e){return e.date===iso&&!e.hidden;});}
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
  function answerCounts(event){var counts={attending:0,maybe:0,absent:0,unanswered:0};eligiblePeople(event,getPeople()).forEach(function(person){var value=answerValue(event,person);if(Object.hasOwn(counts,value))counts[value]++;else counts.unanswered++;});return counts;}
  function renderEventList(){
    var active=state.events.filter(function(event){return !event.hidden;}).sort(function(a,b){return a.date.localeCompare(b.date)||a.title.localeCompare(b.title,"ja");});
    var list=$("event-list");
    if(!active.length){
      list.innerHTML='<div class="empty-state">日程を選ぶと予定の詳細を追加できます。</div>';
    }else{
      list.innerHTML=active.map(function(event){
        var c=answerCounts(event);
        var unanswered=audience==="players"&&event.kind==="match"&&!targetGrades(event)?"対象学年未設定":"未回答 "+c.unanswered;
        return '<article class="event-card'+(selectedEventId===event.id?" selected":"")+'"><button class="event-open" type="button" data-open-event="'+esc(event.id)+'"><strong>'+esc(event.title)+'</strong><span class="event-meta"><span>'+dateLabel(event.date)+'</span><span class="kind-badge '+(event.kind==="match"?"match":"")+'">'+(event.kind==="match"?"試合":"練習")+'</span>'+(event.place?'<span>'+esc(event.place)+'</span>':"")+"</span></button><span class=\"event-count\">参加 <b>"+c.attending+"</b> ・未定 "+c.maybe+'<br>'+unanswered+'</span><button type="button" class="delete-event" data-delete-event="'+esc(event.id)+'" aria-label="'+(event.id.startsWith("calendar_")?"この試合を表から非表示":"この予定を削除")+'">'+(event.id.startsWith("calendar_")?"非表示":"削除")+'</button></article>';
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

  var showMatchTotals=true, activeDayEntry=null, dayEntryTrigger=null;

  function groupBoardDays(events){
    var days=new Map();
    events.forEach(function(event){
      if(!days.has(event.date))days.set(event.date,{date:event.date,practice:[],matches:[]});
      var day=days.get(event.date);
      (event.kind==="match"?day.matches:day.practice).push(event);
    });
    return Array.from(days.values());
  }

  function answerValue(event,person){
    return state.answers[event.id]?.[audience]?.[person.id]?.value||"";
  }

  function targetGrades(event){
    if(event.targetOverride)return event.targetOverride;
    if(Object.hasOwn(event,"targetGrades"))return event.targetGrades;
    return window.SMCCalendarAttendance.targetGrades("",event.title);
  }

  function eligibility(event,person){
    if(audience!=="players"||event.kind!=="match")return "";
    var grades=targetGrades(event);
    if(!grades)return "対象学年未設定";
    var grade=String(person.grade||"").normalize("NFKC").trim().replace(/生$/,"");
    return grades.includes(grade)?"":"対象外";
  }

  function eligiblePeople(event,people){
    return people.filter(function(person){return !eligibility(event,person);});
  }

  function categoryName(event){
    return event.category||"その他";
  }

  function countAnswers(events,people){
    var total={attending:0,maybe:0,absent:0};
    events.forEach(function(event){
      eligiblePeople(event,people).forEach(function(person){
        var value=answerValue(event,person);
        if(Object.hasOwn(total,value))total[value]++;
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

  function dayHeading(day){
    var date=fromISO(day.date);
    var labels=Array.from(new Set(day.matches.map(categoryName)))
      .sort(function(left,right){return left.localeCompare(right,"ja",{numeric:true});})
      .map(function(category){return category==="その他"?"試合":category;});
    var dayLabel=(date.getMonth()+1)+"/"+date.getDate()+"（"+DAY_NAMES[date.getDay()]+"）";
    var fullLabels=labels.join("・");
    var shortLabels=labels.length>3?labels.slice(0,2).join("・")+" ＋"+(labels.length-2):fullLabels;
    var heading='<span class="board-date">'+esc(dayLabel)+'<span class="day-calendar-icon" aria-hidden="true">▦</span></span>';
    if(labels.length){
      heading+='<span class="day-match-label" title="'+esc(fullLabels)+'">'+esc(shortLabels)+'</span>';
    }else{
      var detail=holidays[day.date]||day.practice[0]?.title||"";
      if(detail)heading+='<span class="board-event-title" title="'+esc(detail)+'">'+esc(detail)+'</span>';
    }
    return calendarLink(day.date,heading,"day-detail-link","",dateLabel(day.date)+"の予定を開く");
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
    var practice=day.practice.map(function(event){return answerValue(event,person);}).filter(Boolean);
    var eligible=day.matches.filter(function(event){return !eligibility(event,person);});
    var answered=eligible.map(function(event){
      return {label:event.category||"試合",value:answerValue(event,person)};
    }).filter(function(answer){return answer.value;});
    var first=answered[0];
    var badge=first?'<span class="day-match-chip" data-value="'+esc(first.value)+'">'+esc(first.label)+(first.value==="attending"?"":answerMark(first.value))+'</span>':"";
    var extra=answered.length>1?'<span class="day-more">＋'+(answered.length-1)+'</span>':"";
    var marks=practice.map(answerMark).join(" ");
    if(!day.practice.length&&!eligible.length){
      return '<span class="board-ineligible">'+(day.matches.every(function(event){return targetGrades(event);})?"対象外":"対象学年未設定")+'</span>';
    }
    var description=(marks?"練習 "+marks:"")+(answered.length?" "+answered.map(function(answer){return answer.label+" "+answerMark(answer.value);}).join("、"):"");
    var cycle=day.matches.length===0&&day.practice.length===1;
    var style=cycle?"board-mark editable":"board-mark editable day-answer";
    return '<button type="button" class="'+style+'" data-answer-date="'+esc(day.date)+'" data-answer-person="'+esc(person.id)+
      '" data-value="'+esc(practice[0]||"")+'" aria-label="'+esc(person.name+" "+dateLabel(day.date)+" "+(description.trim()||"未回答")+(cycle?"。タップで回答を切り替え":"。出欠を入力"))+'">'+
      (cycle?marks:(marks?'<span class="day-practice-mark">'+marks+'</span>':"")+badge+extra)+'</button>';
  }

  function matchSummaryButton(day,category,people){
    var matches=day.matches.filter(function(event){return categoryName(event)===category;});
    if(!matches.length)return "—";
    var total=countAnswers(matches,people);
    var awaitingGrades=audience==="players"&&matches.some(function(event){return !targetGrades(event);});
    var label=(category==="その他"?"その他の試合":category+"試合")+" "+dateLabel(day.date)+" 参加"+total.attending+"人、未定"+total.maybe+"人、不参加"+total.absent+"人";
    return '<button type="button" class="match-total-button" data-match-date="'+esc(day.date)+'" data-match-category="'+esc(category)+'" aria-label="'+esc(label+"。内訳を表示")+'">'+
      (matches.length>1?'<span class="match-total-note">'+matches.length+'試合・延べ</span>':"")+
      (awaitingGrades?'<span class="match-total-note">対象学年未設定あり</span>':"")+
      '<span>○'+total.attending+'人</span> <span>△'+total.maybe+'人</span> <span>×'+total.absent+'人</span></button>';
  }

  function focusDayCell(date,personId){
    var button=$("response-list").querySelector('[data-answer-date="'+CSS.escape(date)+'"][data-answer-person="'+CSS.escape(personId)+'"]');
    if(button)button.focus({preventScroll:true});
  }

  function saveDayAnswers(personId,updates,note){
    var timestamp=new Date().toISOString();
    var before=state.answers;
    var beforeNotes=state.notes;
    var answers={...before};
    updates.forEach(function(update){
      var current=before[update.id]?.[audience]||{};
      if((current[personId]?.value||"")===update.value)return;
      var replies={...current};
      if(update.value)replies[personId]={value:update.value,updatedAt:timestamp};
      else delete replies[personId];
      answers[update.id]={...before[update.id],[audience]:replies};
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

  function eventName(event){
    var kind=event.kind==="match"?(event.category?event.category+" 試合":"試合"):"練習";
    return [kind,event.startTime,event.title].filter(Boolean).join(" · ");
  }

  function openDayEntry(day,person,trigger){
    activeDayEntry={day:day,person:person};
    dayEntryTrigger=trigger;
    $("day-entry-title").innerHTML=calendarLink(day.date,esc(dateLabel(day.date)),"entry-date-link")+"の出欠";
    $("day-entry-person").textContent=person.name;
    $("day-entry-events").innerHTML=day.practice.concat(day.matches).map(function(event,index){
      var unavailable=eligibility(event,person);
      var current=answerValue(event,person);
      var options=[{value:"attending",label:event.kind==="match"?(event.category||"○ 参加"):"○ 参加"},
        {value:"maybe",label:"△ 未定"},{value:"absent",label:"× 不参加"},{value:"",label:"未回答"}];
      return '<fieldset class="day-entry-event"><legend>'+esc(eventName(event))+'</legend>'+
        (unavailable?'<span class="match-target-note">'+esc(unavailable)+'</span>':options.map(function(option){
          return '<label class="day-entry-choice"><input type="radio" name="day-answer-'+index+'" value="'+esc(option.value)+'"'+
            (option.value===current?" checked":"")+'><span>'+esc(option.label)+'</span></label>';
        }).join(""))+matchCalendarAction(event)+'</fieldset>';
    }).join("");
    $("day-entry-dialog").showModal();
    $("day-entry-events").parentElement.scrollTop=0;
  }

  function openMatchSummary(day,category,people){
    $("match-summary-title").textContent=dateLabel(day.date)+" "+(category==="その他"?"その他の試合":category+"試合");
    $("match-summary-list").innerHTML=day.matches.filter(function(event){return categoryName(event)===category;}).map(function(event){
      var groups=ANSWERS.concat({value:"",label:"未回答"});
      var eligible=eligiblePeople(event,people),grades=targetGrades(event);
      var target=grades?"対象 "+grades.join("・")+(audience==="players"?"／"+eligible.length+"名":""):"対象学年未設定";
      return '<section class="match-summary-event" data-target-event="'+esc(event.id)+'"><h3>'+esc(eventName(event))+'</h3><div class="match-target-note">'+esc(target)+'</div>'+
        (grades||audience==="coaches"?groups.map(function(group){
        var names=eligible.filter(function(person){return answerValue(event,person)===group.value;}).map(function(person){return person.name;});
        return '<p><strong>'+esc((answerMark(group.value)+" "+group.label).trim())+' '+names.length+'人</strong><span>'+esc(names.join("、")||"—")+'</span></p>';
      }).join(""):"")+matchCalendarAction(event)+(audience==="coaches"?targetGradeEditor(event,grades):"")+'</section>';
    }).join("");
    var dialog=$("match-summary-dialog");
    if(!dialog.open)dialog.showModal();
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
    var roster=getPeople(),people=roster,days=groupBoardDays(getBoardEvents());
    $("board-toolbar").hidden=true;
    panel.hidden=false;
    $("response-title").textContent="参加予定【"+(audience==="players"?"団員用":"コーチ用")+"】";
    $("respondent-count").textContent=people.length+"名";
    $("response-summary").textContent="日付をタップするとカレンダー、マスをタップすると出欠入力が開きます。";
    $("entry-mode-button").disabled=audience==="players"&&!members.length;
    $("coach-roster-status").textContent=coachRosterStatus;
    $("coach-roster-status").hidden=audience!=="coaches";
    $("coach-editor").hidden=audience!=="coaches";$("grade-filters").hidden=audience!=="players";$("grade-filters").innerHTML="";
    if(audience==="players"){var grades=["すべて"].concat(GRADES.filter(function(g){return members.some(function(m){return m.grade===g;});}));$("grade-filters").innerHTML=grades.map(function(g){return '<button type="button" class="filter-chip'+(selectedGrade===g?" active":"")+'" data-grade="'+esc(g)+'">'+esc(g)+(g==="すべて"?"":"（"+members.filter(function(m){return m.grade===g;}).length+"）")+"</button>";}).join("");$("grade-filters").querySelectorAll("[data-grade]").forEach(function(btn){btn.addEventListener("click",function(){selectedGrade=btn.dataset.grade;renderResponse();});});if(selectedGrade!=="すべて")people=people.filter(function(p){return p.grade===selectedGrade;});}

    $("entry-mode-button").textContent="出欠を入力する";
    $("entry-mode-help").textContent="名前を選び、複数の日程をまとめて回答できます。";
    if(!people.length){
      rows.innerHTML='<div class="empty-state">'+(audience==="players"?esc(rosterState)+"。":esc(coachRosterStatus))+"</div>";
      return;
    }
    if(!days.length){rows.innerHTML='<div class="empty-state">表示できる日程がありません。</div>';return;}

    var categories=Array.from(new Set(days.flatMap(function(day){return day.matches.map(categoryName);}))).sort(function(a,b){return a.localeCompare(b,"ja",{numeric:true});});
    var toggle=$("toggle-match-totals");
    toggle.hidden=!categories.length;
    toggle.setAttribute("aria-expanded",String(showMatchTotals));
    toggle.textContent=showMatchTotals?"試合集計 ▴":"試合集計 ▾";
    var head,body;
    var practiceTotals=new Map(days.map(function(day){return [day.date,countAnswers(day.practice,people)];}));
    if(transposeBoard){
      head='<thead><tr><th class="event-col" scope="col">日付</th>'+people.map(function(person){
        return '<th class="rotated-person" scope="col"><button type="button" class="board-member-name" data-edit-person="'+esc(person.id)+'">'+
          (audience==="players"?'<span class="board-member-grade">'+esc(person.grade||"学年未登録")+'</span>':"")+esc(person.name)+'</button></th>';
      }).join("")+'</tr></thead><tbody>';
      body=days.map(function(day){
        var totals=practiceTotals.get(day.date);
        var summaries=showMatchTotals?Array.from(new Set(day.matches.map(categoryName))).map(function(category){
          return '<div class="transposed-match-total">'+esc(category)+' '+matchSummaryButton(day,category,roster)+'</div>';
        }).join(""):"";
        return '<tr><th class="event-col" scope="row" data-board-date="'+esc(day.date)+'">'+dayHeading(day)+
          (day.practice.length?'<span class="event-count-summary">○'+totals.attending+' △'+totals.maybe+' ×'+totals.absent+'</span>':"")+summaries+'</th>'+
          people.map(function(person){return '<td>'+dayButton(day,person)+'</td>';}).join("")+'</tr>';
      }).join("");
    }else{
      head='<thead><tr><th class="person-col" scope="col">参加者</th>'+days.map(function(day){
        return '<th scope="col" data-board-date="'+esc(day.date)+'">'+dayHeading(day)+'</th>';
      }).join("")+'</tr></thead><tbody>';
      var summary=ANSWERS.map(function(answer){
        return '<tr class="summary-row"><th class="person-col" scope="row"><span class="summary-symbol mark-'+answer.value+'">'+answerMark(answer.value)+'</span> '+answer.label+'</th>'+
          days.map(function(day){return '<td>'+(day.practice.length?practiceTotals.get(day.date)[answer.value]+'人':"—")+'</td>';}).join("")+'</tr>';
      }).join("");
      if(showMatchTotals)summary+=categories.map(function(category){
        return '<tr class="summary-row match-summary-row"><th class="person-col" scope="row">'+esc(category==="その他"?"その他の試合":category+"試合")+'</th>'+
          days.map(function(day){return '<td>'+matchSummaryButton(day,category,roster)+'</td>';}).join("")+'</tr>';
      }).join("");
      body=summary+people.map(function(person){
        var note=state.notes[audience]?.[person.id]||"";
        var name='<button type="button" class="board-member-name" data-edit-person="'+esc(person.id)+'">'+
          (audience==="players"?'<span class="board-member-grade">'+esc(person.grade||"学年未登録")+'</span>':"")+'<span>'+esc(person.name)+'</span></button>';
        var controls=audience==="coaches"&&!person.fromStaff?'<div class="coach-edit-actions"><button type="button" data-edit-coach="'+esc(person.id)+'">名前を編集</button><button type="button" class="remove-coach" data-remove-coach="'+esc(person.id)+'">削除</button></div>':"";
        return '<tr><th class="person-col" scope="row">'+name+(note?'<span class="board-comment" title="'+esc(note)+'">'+esc(note)+'</span>':"")+controls+'</th>'+
          days.map(function(day){return '<td>'+dayButton(day,person)+'</td>';}).join("")+'</tr>';
      }).join("");
    }
    $("board-toolbar").hidden=false;
    $("board-status").textContent=transposeBoard?"日付を縦、参加者を横に表示中":"参加者を縦、日付を横に表示中";
    $("transpose-board").setAttribute("aria-pressed",String(transposeBoard));
    rows.innerHTML='<div class="attendance-board-scroll" role="region" aria-label="出欠一覧、上下左右にスクロール" tabindex="0"><table class="attendance-board'+(transposeBoard?" is-transposed":"")+'">'+head+body+'</tbody></table></div>';
    var newBoard=rows.querySelector(".attendance-board-scroll");
    if(preserveScroll){newBoard.scrollTop=savedTop;newBoard.scrollLeft=savedLeft;}
    var daysByDate=new Map(days.map(function(day){return [day.date,day];}));
    var peopleById=new Map(people.map(function(person){return [person.id,person];}));
    rows.querySelectorAll("[data-edit-person]").forEach(function(btn){
      btn.addEventListener("click",function(){openAttendanceForm(btn.dataset.editPerson);});
    });
    rows.querySelectorAll("[data-answer-date]").forEach(function(btn){
      btn.addEventListener("click",function(){
        var day=daysByDate.get(btn.dataset.answerDate),person=peopleById.get(btn.dataset.answerPerson);
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
      btn.addEventListener("click",function(){openMatchSummary(daysByDate.get(btn.dataset.matchDate),btn.dataset.matchCategory,roster);});
    });
    rows.querySelectorAll("[data-edit-coach]").forEach(function(btn){btn.addEventListener("click",function(){var coach=state.coaches.find(function(c){return c.id===btn.dataset.editCoach;});if(!coach)return;var name=prompt("コーチ名を入力してください",coach.name);if(name!==null&&name.trim()){coach.name=name.trim();saveState();render();}});});rows.querySelectorAll("[data-remove-coach]").forEach(function(btn){btn.addEventListener("click",function(){var coach=state.coaches.find(function(c){return c.id===btn.dataset.removeCoach;});if(coach&&confirm(coach.name+"さんを試作リストから削除しますか？")){state.coaches=state.coaches.filter(function(c){return c.id!==coach.id;});saveState();render();}});});
  }

  function openAttendanceForm(personId){
    var people=getPeople(),events=getBoardEvents(),select=$("entry-person");editingPersonId=personId||"";formAnswers={};
    select.innerHTML='<option value="">名前を選択してください</option>'+people.map(function(person){var label=(audience==="players"?(person.grade||"学年未登録")+" · ":"")+person.name;return '<option value="'+esc(person.id)+'">'+esc(label)+"</option>";}).join("");
    select.value=editingPersonId;$("entry-comment").value="";
    if(editingPersonId){events.forEach(function(event){var value=state.answers[event.id]&&state.answers[event.id][audience]&&state.answers[event.id][audience][editingPersonId];formAnswers[event.id]=value&&value.value||"";});$("entry-comment").value=state.notes[audience]&&state.notes[audience][editingPersonId]||"";}
    renderAttendanceFormEvents(events);$("attendance-dialog").showModal();
    $("attendance-form-events").parentElement.scrollTop=0;
  }
  function renderAttendanceFormEvents(events){
    var root=$("attendance-form-events"),options=[{value:"attending",label:"○"},{value:"maybe",label:"△"},{value:"absent",label:"×"},{value:"",label:"未回答"}];
    var person=getPeople().find(function(item){return item.id===editingPersonId;});
    $("save-attendance").disabled=!editingPersonId;
    $("entry-comment").disabled=!editingPersonId;
    root.innerHTML=events.map(function(event){
      var current=formAnswers[event.id]||"";
      var unavailable=person&&eligibility(event,person);
      return '<section class="attendance-form-event"><div class="attendance-form-date">'+calendarLink(event.date,esc(dateLabel(event.date)),"entry-date-link")+'</div>'+
        '<div class="attendance-form-title">'+eventDetails(event)+(event.place?" · "+esc(event.place):"")+'</div>'+
        matchCalendarAction(event)+(unavailable?'<div class="match-target-note">'+esc(unavailable)+'</div>':'<div class="attendance-form-choices">'+options.map(function(option){
          return '<button type="button" class="attendance-form-choice" data-form-event="'+esc(event.id)+
            '" data-form-value="'+esc(option.value)+'" aria-pressed="'+String(current===option.value)+'"'+
            (editingPersonId?"":" disabled")+'>'+option.label+'</button>';
        }).join("")+'</div>')+'</section>';
    }).join("");
  }
  function saveAttendanceForm(event){
    event.preventDefault();
    var personId=$("entry-person").value;
    var person=getPeople().find(function(item){return item.id===personId;});
    if(!person){
      alert("入力する人を選び直してください。");return;
    }
    var updates=getBoardEvents().filter(function(item){return !eligibility(item,person)&&Object.hasOwn(formAnswers,item.id);}).map(function(item){
      return {id:item.id,value:formAnswers[item.id]};
    });
    var note=$("entry-comment").value.trim().slice(0,80);
    if(!saveDayAnswers(personId,updates,note))return;
    $("attendance-dialog").close();
    renderEventList();renderResponse(true);
    $("answer-status").textContent="回答を保存しました。";
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
  function exportCsv(){var people=getPeople(),rows=[["対象","日付","種類","予定名","会場","名前","学年","出欠","備考","最終更新","カテゴリー","開始時刻"]],events=getBoardEvents().concat(state.events.filter(function(event){return event.hidden;}),state.archive,pastDefaultEvents()).sort(function(a,b){return a.date.localeCompare(b.date);});events.forEach(function(event){var table=state.answers[event.id]&&state.answers[event.id][audience]||{};people.forEach(function(person){var response=table[person.id]||{},note=state.notes[audience]&&state.notes[audience][person.id]||"";rows.push([audience==="players"?"団員":"コーチ",event.date,event.kind==="match"?"試合":event.kind==="practice"?"練習":"",event.title,event.place||"",person.name,person.grade||"",({attending:"参加",maybe:"未定",absent:"不参加"})[response.value]||eligibility(event,person)||"未回答",note,response.updatedAt||"",event.category||"",event.startTime||""]);});});function cell(value){var text=String(value==null?"":value);if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}var csv="\uFEFF"+rows.map(function(row){return row.map(cell).join(",");}).join("\r\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="吉見SMC_出欠試作_"+(audience==="players"?"団員":"コーチ")+"_"+todayISO()+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},0);}
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
    if(/中止|キャンセル|活動なし|お休み|^\s*(?:OFF|休み)\s*$/i.test(title))return false;
    var isMatch=/試合|大会|交流戦|対抗戦|招待|カップ|リーグ|トレマ|フェス|マッチ|\b(?:TM|TRM|CUP|LEAGUE)\b|[vV][sS][.．]/i.test(title);
    return isMatch||!/練習|トレーニング|会議|総会|説明会|保護者会|審判講習|予備日/.test(title);
  }

  function syncCalendarMatches(matches,restore){
    var events=new Map(state.events.map(function(event){return [event.id,event];}));
    var archived=new Set(state.archive.map(function(event){return event.id;}));
    var resumed=new Set(),changed=false;
    matches.forEach(function(match){
      var previous=events.get(match.id);
      if(!restore&&!previous&&!isAutomaticMatch(match))return;
      var hidden=previous?.hidden&&!restore;
      if(previous&&Boolean(previous.hidden)===Boolean(hidden)&&
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
      var visible=matches.filter(function(match){return !category.value||match.category===category.value;});
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
      var saved=syncCalendarMatches(matches,false);
      var visible=matches.filter(function(match){
        return state.events.some(function(item){return item.id===match.id&&!item.hidden;});
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

  function init(){movePastEvents();
    setupCalendarMatchPicker();
    $("match-summary-list").addEventListener("click",function(event){
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
      var day=groupBoardDays(getBoardEvents()).find(function(item){return item.date===match.date;});
      if(day)openMatchSummary(day,categoryName(match),getPeople());
    });
    $("attendance-form-events").addEventListener("click",function(event){
      var button=event.target.closest("[data-form-event]");
      if(!button||button.disabled)return;
      formAnswers[button.dataset.formEvent]=button.dataset.formValue;
      button.parentElement.querySelectorAll("[data-form-event]").forEach(function(choice){
        choice.setAttribute("aria-pressed",String(choice===button));
      });
    });
    $("toggle-match-totals").addEventListener("click",function(){showMatchTotals=!showMatchTotals;renderResponse(true);});
    $("day-entry-form").addEventListener("submit",function(event){
      event.preventDefault();
      if(!activeDayEntry)return;
      var entry=activeDayEntry,form=new FormData(event.currentTarget);
      var current=new Map(getBoardEvents().map(function(item){return [item.id,item];}));
      var updates=entry.day.practice.concat(entry.day.matches).map(function(item,index){
        return {id:item.id,value:form.get("day-answer-"+index)};
      }).filter(function(update){
        var item=current.get(update.id);
        return update.value!==null&&item&&!eligibility(item,entry.person);
      });
      if(!saveDayAnswers(entry.person.id,updates))return;
      $("day-entry-dialog").close();
      renderEventList();renderResponse(true);
      $("answer-status").textContent="回答を保存しました。";
      focusDayCell(entry.day.date,entry.person.id);
    });
    $("cancel-day-entry").addEventListener("click",function(){$("day-entry-dialog").close();});
    $("day-entry-dialog").addEventListener("close",function(){
      if(dayEntryTrigger&&dayEntryTrigger.isConnected)dayEntryTrigger.focus({preventScroll:true});
      activeDayEntry=null;
      dayEntryTrigger=null;
    });
    document.querySelectorAll(".audience-tab").forEach(function(btn){btn.addEventListener("click",function(){audience=btn.dataset.audience;if(audience==="coaches")readStaffCoaches();selectedGrade="すべて";document.querySelectorAll(".audience-tab").forEach(function(tab){var active=tab===btn;tab.classList.toggle("active",active);tab.setAttribute("aria-pressed",active?"true":"false");});render();});});
    $("add-event").addEventListener("click",addEvent);$("cancel-event").addEventListener("click",function(){$("event-dialog").close();});$("event-form").addEventListener("submit",function(e){e.preventDefault();var title=$("event-title").value.trim();if(!title)return;if(selectedDate<todayISO()||selectedDate>maxDate()||!isDefaultDay(selectedDate)){alert("出欠予定は今日から2か月先までの水・木・土・日・祝日から登録してください。");return;}var kind=$("event-kind").value,dayId=defaultEvent(selectedDate).id;
      var reuseDay=kind==="practice"&&!eventForDate(selectedDate).some(function(event){return event.id===dayId||event.kind==="practice";});
      var id=reuseDay?dayId:"demo_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7);state.events.push({id:id,date:selectedDate,kind:$("event-kind").value,title:title,place:$("event-place").value.trim(),createdAt:new Date().toISOString()});saveState();$("event-dialog").close();openEvent(id);});
    $("entry-mode-button").addEventListener("click",function(){if(getPeople().length){openAttendanceForm("");return;}if(audience==="coaches"&&!state.coaches.length){$("coach-local-editor").open=true;$("coach-editor").scrollIntoView({behavior:"smooth",block:"center"});$("coach-name-input").focus({preventScroll:true});return;}});$("entry-mode-icon").addEventListener("click",function(){$("entry-mode-button").click();});$("transpose-board").addEventListener("click",function(){transposeBoard=!transposeBoard;renderResponse();});$("cancel-attendance").addEventListener("click",function(){$("attendance-dialog").close();});$("attendance-form").addEventListener("submit",saveAttendanceForm);$("entry-person").addEventListener("change",function(){var id=this.value,events=getBoardEvents();editingPersonId=id;formAnswers={};events.forEach(function(event){var response=id&&state.answers[event.id]&&state.answers[event.id][audience]&&state.answers[event.id][audience][id];formAnswers[event.id]=response&&response.value||"";});$("entry-comment").value=id&&state.notes[audience]&&state.notes[audience][id]||"";renderAttendanceFormEvents(events);});$("export-csv").addEventListener("click",exportCsv);$("reset-demo").addEventListener("click",function(){if(!confirm("この端末に保存した試作の予定・回答・コーチ名をすべて削除しますか？団員名簿は変更されません。"))return;state={events:[],archive:[],coaches:[],coachLinks:{},answers:{},notes:{}};selectedEventId="";selectedDate="";localStorage.removeItem(STORAGE_KEY);render();});$("add-coach").addEventListener("click",function(){var input=$("coach-name-input"),name=input.value.trim();if(!name){input.focus();return;}if(getPeople().some(function(c){return coachNameKey(c.name)===coachNameKey(name);})){alert("同じ名前がすでに登録されています。");return;}state.coaches.push({id:"coach_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6),name:name});input.value="";saveState();render();});
    var archiveSection=document.createElement("section");archiveSection.className="panel archived-panel";archiveSection.innerHTML='<details><summary>過去の予定（試作データ）</summary><div id="archive-list" class="event-list"></div><p class="small-note">日付が過ぎた予定は一覧から自動で移し、試作版の回答記録はCSV出力用にこの端末へ残しています。</p></details>';$("event-panel").after(archiveSection);
    render();loadHolidays();readRoster();
  }
  document.addEventListener("DOMContentLoaded",init);
})();
