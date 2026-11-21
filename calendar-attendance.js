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

  function parseTargetGrades(value){
    var source = text(value).normalize("NFKC").replace(/\s+/g, "");
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

  function targetGrades(description, title){
    var field = plainDescription(description).match(/(?:^|\n)\s*(?:【対象(?:学年)?】|対象(?:学年)?\s*[:：])\s*([^\n【]+)/);
    if (field) return parseTargetGrades(field[1]);
    var name = text(title).normalize("NFKC");
    var label = name.match(/【対象(?:学年)?】\s*([^【]+)/);
    if (label) return parseTargetGrades(label[1]);
    var parts = name.matchAll(/\(([^()]*)\)/g);
    for (var part of parts) {
      var grades = parseTargetGrades(part[1]);
      if (grades) return grades;
    }
    var leading = name.match(/^(?:U(?:[7-9]|1[0-2])\s*)?([1-6](?:年(?:生)?)?\s*[~〜～–—-]\s*[1-6]年(?:生)?|[1-6]年(?:生)?(?:以下|以上)?|全学年|年長)(?:\s|$)/i);
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

  return {
    plainDescription: plainDescription,
    targetGrades: targetGrades,
    safeChouseisanUrl: safeChouseisanUrl,
    safeCategoryColor: safeCategoryColor,
    extractChouseisanUrl: extractChouseisanUrl,
    formatDate: formatDate,
    normalizeEntries: normalizeEntries,
    buildLineMessage: buildLineMessage
  };
});
