(function(root, factory){
  "use strict";
  var api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.SMCCalendarAttendance = api;
})(typeof window !== "undefined" ? window : globalThis, function(){
  "use strict";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function decodeCalendarText(value){
    return text(value)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/&amp;/gi, "&")
      .replace(/&#38;/gi, "&");
  }

  var PLAYER_GRADES = ["6年", "5年", "4年", "3年", "2年", "1年", "年長"];

  function plainDescription(value){
    return decodeCalendarText(value)
      .replace(/<\/(?:p|div|li)>/gi, "\n")
      .replace(/<[^>]*>/g, "");
  }

  function descriptionLinks(value){
    var textWithLinks = String(value || "").replace(
      /<a\b[^>]*?\s+href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a\s*>/gi,
      function(tag, doubleQuoted, singleQuoted, unquoted, label){
        var href = decodeCalendarText(doubleQuoted || singleQuoted || unquoted);
        try {
          var url = new URL(href);
          if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return label;
          return plainDescription(label) === href ? href : label + " " + href;
        } catch(error){ return label; }
      }
    );
    var source = plainDescription(textWithLinks);
    var parts = [], start = 0;
    var matches = source.matchAll(/\bhttps?:\/\/[^\s<>"'、。！？【】「」『』]+/gi);
    for (var match of matches) {
      var candidate = match[0].replace(/[.,;:!?）］｝]+$/, "");
      while (candidate.endsWith(")") && candidate.split(")").length > candidate.split("(").length) {
        candidate = candidate.slice(0,-1);
      }
      try {
        var url = new URL(candidate);
        if (url.username || url.password) continue;
        if (match.index > start) parts.push({text:source.slice(start,match.index)});
        parts.push({text:candidate,href:url.href});
        start = match.index + candidate.length;
      } catch(error){}
    }
    if(start < source.length) parts.push({text:source.slice(start)});
    return parts;
  }

  function parseTargetGrades(value){
    var source = text(value).normalize("NFKC").replace(/\s+/g, "")
      .replace(/^女子(?:のみ|限定)?[:：]?|(?:の)?女子(?:のみ|限定)?$/g, "");
    if (/^(全学年|全団員|全員)$/.test(source)) return PLAYER_GRADES.slice();
    var grades = new Set();
    for (var part of source.split(/[・、,/＋+]/)) {
      var range = part.match(/^([1-6])(?:年(?:生)?)?[~〜～\-–—]([1-6])年(?:生)?$/);
      if (range) {
        var min = Math.min(Number(range[1]), Number(range[2]));
        var max = Math.max(Number(range[1]), Number(range[2]));
        for (var grade = min; grade <= max; grade++) grades.add(grade + "年");
        continue;
      }
      var single = part.match(/^([1-6])年(?:生)?(以下|以上)?$/);
      if (single) {
        var number = Number(single[1]);
        if (single[2] === "以下") grades.add("年長");
        for (var candidate = 1; candidate <= 6; candidate++) {
          if (single[2] === "以下" ? candidate <= number :
              single[2] === "以上" ? candidate >= number : candidate === number) grades.add(candidate + "年");
        }
      } else if (part === "年長") {
        grades.add(part);
      } else {
        return null;
      }
    }
    return PLAYER_GRADES.filter(function(grade){ return grades.has(grade); });
  }

  function targetField(description){
    return plainDescription(description).match(/(?:^|\n)\s*(?:【対象(?:学年)?】|対象(?:学年)?\s*[:：])\s*([^\n【]+)/)?.[1] || "";
  }

  function girlsOnly(description, title){
    function includesGirls(value){
      return /女子/.test(value) &&
        !/男女|女子\s*(?:も|可|歓迎|混合)|男子\s*[・、/+＋と]\s*女子|女子\s*[・、/+＋と](?:\s*男子)/.test(value);
    }
    var field=targetField(description).normalize("NFKC");
    var name=text(title).normalize("NFKC");
    if(/女子|男子|男女/.test(field))return includesGirls(field);
    return includesGirls(name);
  }

  function targetGrades(description, title){
    var field=targetField(description);
    if (field) {
      var explicit=parseTargetGrades(field);
      if(explicit || !/^女子(?:のみ|限定)?$/.test(field.normalize("NFKC").trim()))return explicit;
    }
    var name = text(title).normalize("NFKC");
    var label = name.match(/【対象(?:学年)?】\s*([^【]+)/);
    if (label) return parseTargetGrades(label[1]);
    var parts = name.matchAll(/\(([^()]*)\)/g);
    for (var part of parts) {
      var grades = parseTargetGrades(part[1]);
      if (grades) return grades;
    }
    var leading = name.match(/^(?:U(?:[7-9]|1[0-2])\s*)?([1-6](?:年(?:生)?)?\s*[~〜～–—-]\s*[1-6]年(?:生)?|[1-6]年(?:生)?(?:以下|以上)?|全学年|年長)(?=\s|$|(?:の)?女子)/i);
    return leading ? parseTargetGrades(leading[1]) : null;
  }

  function safeChouseisanUrl(value){
    try{
      var url = new URL(text(value));
      var host = url.hostname.toLowerCase();
      if(url.protocol !== "https:") return "";
      if(host !== "chouseisan.com" && !host.endsWith(".chouseisan.com")) return "";
      url.hash = "";
      return url.href;
    }catch(error){
      return "";
    }
  }

  var CATEGORY_COLORS = {
    "全体": "#616161",
    "U12": "#8e24aa",
    "U11": "#d50000",
    "U10": "#f09300",
    "U9": "#e4c441",
    "U8": "#7cb342",
    "U7": "#0b8043",
    "その他": "#4285f4"
  };

  function safeCategoryColor(value, category){
    var categoryName = text(category);
    if(CATEGORY_COLORS[categoryName]) return CATEGORY_COLORS[categoryName];
    var color = text(value).toLowerCase();
    return /^#[0-9a-f]{6}$/.test(color) ? color : CATEGORY_COLORS["その他"];
  }

  function extractChouseisanUrl(){
    var values = Array.prototype.slice.call(arguments);
    for(var i = 0; i < values.length; i += 1){
      var plain = decodeCalendarText(values[i]);
      var candidates = plain.match(/https:\/\/(?:[a-z0-9-]+\.)?chouseisan\.com\/[^\s<>"']+/gi) || [];
      for(var j = 0; j < candidates.length; j += 1){
        var candidate = candidates[j].replace(/[、。),）\]】]+$/g, "");
        var safe = safeChouseisanUrl(candidate);
        if(safe) return safe;
      }
    }
    return "";
  }

  function parseStart(value){
    var source = text(value);
    var allDay = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(allDay) return new Date(Number(allDay[1]), Number(allDay[2]) - 1, Number(allDay[3]));
    var date = new Date(source);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value){
    var date = parseStart(value);
    if(!date) return "日付未設定";
    var days = ["日", "月", "火", "水", "木", "金", "土"];
    return (date.getMonth() + 1) + "月" + date.getDate() + "日（" + days[date.getDay()] + "）";
  }

  function normalizeEntries(events){
    var seen = new Set();
    return (Array.isArray(events) ? events : []).map(function(event){
      var title = text(event && event.title) || "（タイトル未設定）";
      var start = text(event && event.start);
      var url = safeChouseisanUrl(event && (event.attendanceUrl || event.url));
      var category = text(event && event.label) || "その他";
      return {
        title: title,
        start: start,
        dateLabel: formatDate(start),
        category: category,
        color: safeCategoryColor(event && event.color, category),
        url: url,
        key: [title, start, url].join("|")
      };
    }).filter(function(entry){
      if(!entry.url) return false;
      if(seen.has(entry.key)) return false;
      seen.add(entry.key);
      return true;
    }).sort(function(left, right){
      return left.start.localeCompare(right.start) || left.title.localeCompare(right.title, "ja");
    });
  }

  function buildLineMessage(events){
    var entries = normalizeEntries(events);
    if(!entries.length) return "";
    var blocks = entries.map(function(entry){
      return [
        "【タイトル】" + entry.title,
        "【日付】" + entry.dateLabel,
        "【調整さんURL】" + entry.url
      ].join("\n");
    });
    return [
      "【試合参加のご案内】",
      "",
      "お疲れさまです。",
      "下記の試合について、調整さんへ出欠の入力をお願いいたします。",
      "",
      blocks.join("\n\n"),
      "",
      "お手数ですが、各日程の回答をお願いいたします。"
    ].join("\n");
  }

  var tokyoDateFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", dateStyle: "short" });

  function tokyoDate(value){
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : tokyoDateFormat.format(date);
  }

  function upcomingKind(event){
    var title = text(event.title).normalize("NFKC");
    var cancellation = /中止|取りやめ|キャンセル|順延|活動なし|お休み|^\s*(?:OFF|休み)\s*$/i;
    if (event.status === "cancelled" || cancellation.test(title.replace(/(?:雨天|荒天)(?:の場合は?)?中止/g, ""))) return "cancelled";
    if (["match", "tournament", "event", "camp"].includes(event.kind)) return "highlight";
    if (event.kind === "practice") return "practice";

    var highlight = /試合|大会|新人戦|交流戦|対抗戦|招待|選手権|カップ|リーグ|トレマ|フェス|マッチ|合宿|遠征|交流会|運動会|卒団式|体験会|行事|\b(?:TM|TRM|CUP|LEAGUE|vs)\b/i;
    var practice = /練習|夜[練錬]|トレーニング|自主練/;
    if (highlight.test(title)) return "highlight";
    if (practice.test(title)) return "practice";

    var kindLine = plainDescription(event.description).normalize("NFKC").match(/(?:^|\n)\s*(?:【(?:種別|種類|区分|内容)】|(?:種別|種類|区分|内容)\s*:)\s*([^\n]+)/);
    if (kindLine && highlight.test(kindLine[1])) return "highlight";
    if (kindLine && practice.test(kindLine[1])) return "practice";
    return "other";
  }

  function initialCalendarDay(events, today){
    var todaysEvents = [], nextEvents = [], nextDate = "";
    for (var event of events) {
      if (event.label === "祝日") continue;
      var start = tokyoDate(event.start);
      if (!start) continue;
      var end = Date.parse(event.allDay ? event.end + "T00:00:00+09:00" : event.end);
      var last = Number.isNaN(end) ? start : tokyoDate(end - 1);
      var kind = upcomingKind(event);
      if (start <= today && (last >= today || start === today)) {
        todaysEvents.push(event);
      } else if (start > today && kind === "highlight" && (!nextDate || start <= nextDate)) {
        if (start !== nextDate) nextEvents = [];
        nextDate = start;
        nextEvents.push(event);
      }
    }
    return {
      todaysEvents: todaysEvents,
      nextDate: nextDate,
      nextEvents: nextEvents,
      practiceOnly: todaysEvents.length > 0 && todaysEvents.every(function(event){
        return upcomingKind(event) === "practice" ||
          (upcomingKind(event) === "cancelled" && /練習|夜[練錬]|トレーニング/.test(event.title));
      })
    };
  }

  return {
    tokyoDate: tokyoDate,
    initialCalendarDay: initialCalendarDay,
    upcomingKind: upcomingKind,
    plainDescription: plainDescription,
    descriptionLinks: descriptionLinks,
    targetGrades: targetGrades,
    girlsOnly: girlsOnly,
    safeChouseisanUrl: safeChouseisanUrl,
    safeCategoryColor: safeCategoryColor,
    extractChouseisanUrl: extractChouseisanUrl,
    formatDate: formatDate,
    normalizeEntries: normalizeEntries,
    buildLineMessage: buildLineMessage
  };
});
