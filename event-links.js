(function(global){
  "use strict";

  function installTournamentUiFixes(){
    var path=String(global.location&&global.location.pathname||"");
    if(!/(?:^|\/)tournament\.html$/.test(path)) return;

    /* 1面時、チーム自動反映の途中で出る不要なネイティブ警告だけを抑止する。 */
    var nativeAlert=global.alert;
    if(typeof nativeAlert==="function"){
      global.alert=function(message){
        var value=String(message==null?"":message);
        if(value==="チーム一覧に、チーム名が2チーム以上決まってから対戦表を作成してください。") return;
        return nativeAlert.apply(global,arguments);
      };
    }

    /* iPhoneでも「期日」「開始時刻」を必要以上に横長にしない。 */
    var style=document.createElement("style");
    style.id="tournament-compact-date-time";
    style.textContent=[
      "html body #doc-taisen #t-date{display:block!important;width:220px!important;inline-size:220px!important;min-width:0!important;min-inline-size:0!important;max-width:100%!important;max-inline-size:100%!important;margin-left:0!important;margin-right:0!important;box-sizing:border-box!important;}",
      "html body #doc-taisen #t-start{display:block!important;width:170px!important;inline-size:170px!important;min-width:0!important;min-inline-size:0!important;max-width:100%!important;max-inline-size:100%!important;box-sizing:border-box!important;}"
    ].join("");
    document.head.appendChild(style);
  }

  installTournamentUiFixes();

  function text(value){ return String(value == null ? "" : value).trim(); }
  function parseIso(value){
    var match=text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!match) return null;
    var date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));
    return Number.isNaN(date.getTime())?null:date;
  }
  function fiscalKey(item){
    var date=parseIso(item&&item.dateIso || item&&item.date);
    if(!date) return Number.MAX_SAFE_INTEGER;
    var month=date.getMonth()+1;
    var fiscalYear=month>=4?date.getFullYear():date.getFullYear()-1;
    var fiscalMonth=month>=4?month-4:month+8;
    return fiscalYear*10000+fiscalMonth*100+date.getDate();
  }
  function sortDates(dates){
    return (Array.isArray(dates)?dates:[]).slice().sort(function(a,b){
      var diff=fiscalKey(a)-fiscalKey(b);
      if(diff) return diff;
      return text(a&&a.label).localeCompare(text(b&&b.label),"ja");
    });
  }
  function fromGameAdjust(value){
    return sortDates(value&&Array.isArray(value.dates)?value.dates:[]);
  }
  function queryFor(date){
    var params=new URLSearchParams();
    params.set("dateId",text(date&&date.id));
    if(text(date&&date.dateIso)) params.set("dateIso",text(date.dateIso));
    if(text(date&&date.label)) params.set("date",text(date.label));
    if(text(date&&date.tournamentName)) params.set("name",text(date.tournamentName));
    if(text(date&&date.cat)) params.set("category",text(date.cat));
    return params.toString();
  }
  function href(page,date){
    var query=queryFor(date);
    return page+(query?"?"+query:"");
  }
  function validEventId(value){return /^[A-Za-z0-9_-]{1,100}$/.test(text(value))?text(value):"";}
  function dashboardHref(dateOrId){
    var id=validEventId(typeof dateOrId==="string"?dateOrId:dateOrId&&dateOrId.id||dateOrId&&dateOrId.dateId);
    return id?"coach.html?eventId="+encodeURIComponent(id)+"#coach-match":"coach.html#coach-match";
  }
  function installTournamentBackLinks(){
    var params=new URLSearchParams(location.search),dateId=validEventId(params.get("dateId"));
    document.querySelectorAll("[data-tournament-back]").forEach(function(link){link.setAttribute("href",dashboardHref(dateId));});
  }
  function nearest(dates,now){
    var list=sortDates(dates).filter(function(item){return parseIso(item&&item.dateIso);});
    if(!list.length) return null;
    var today=now instanceof Date?new Date(now.getFullYear(),now.getMonth(),now.getDate()):new Date();
    if(!(now instanceof Date)) today=new Date(today.getFullYear(),today.getMonth(),today.getDate());
    var chronological=list.slice().sort(function(a,b){return parseIso(a.dateIso)-parseIso(b.dateIso);});
    return chronological.find(function(item){return parseIso(item.dateIso)>=today;})||chronological[chronological.length-1];
  }
  function label(date){
    return text(date&&date.label)||text(date&&date.dateIso)||"日付未設定";
  }
  global.SMCEventLinks={
    parseIso:parseIso,
    fiscalKey:fiscalKey,
    sortDates:sortDates,
    fromGameAdjust:fromGameAdjust,
    queryFor:queryFor,
    href:href,
    dashboardHref:dashboardHref,
    nearest:nearest,
    label:label
  };
  document.addEventListener("DOMContentLoaded",installTournamentBackLinks);
})(window);
