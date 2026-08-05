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
      return {
        title: text(event && event.title) || "（タイトル未設定）",
        start: text(event && event.start),
        dateLabel: formatDate(event && event.start),
        url: safeChouseisanUrl(event && (event.attendanceUrl || event.url))
      };
    }).filter(function(entry){
      if(!entry.url) return false;
      var key = [entry.title, entry.start, entry.url].join("|");
      if(seen.has(key)) return false;
      seen.add(key);
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
    safeChouseisanUrl: safeChouseisanUrl,
    extractChouseisanUrl: extractChouseisanUrl,
    formatDate: formatDate,
    normalizeEntries: normalizeEntries,
    buildLineMessage: buildLineMessage
  };
});
