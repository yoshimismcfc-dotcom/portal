import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const attendance = require(path.join(root, "calendar-attendance.js"));

assert.equal(
  attendance.extractChouseisanUrl("出欠はこちら https://chouseisan.com/s?h=abc123"),
  "https://chouseisan.com/s?h=abc123"
);
assert.equal(
  attendance.extractChouseisanUrl("<a href='https://chouseisan.com/s?h=xyz&amp;k=1'>回答</a>"),
  "https://chouseisan.com/s?h=xyz&k=1"
);
assert.equal(attendance.extractChouseisanUrl("http://chouseisan.com/s?h=unsafe"), "");
assert.equal(attendance.extractChouseisanUrl("https://example.com/?next=https://chouseisan.com.evil.test/"), "");
assert.equal(attendance.formatDate("2026-08-30"), "8月30日（日）");

const message = attendance.buildLineMessage([
  {title:"U10 練習試合", start:"2026-09-06", attendanceUrl:"https://chouseisan.com/s?h=u10"},
  {title:"U8 大会", start:"2026-08-30", attendanceUrl:"https://chouseisan.com/s?h=u8"},
  {title:"URLなし", start:"2026-08-31", attendanceUrl:""}
]);
assert.ok(message.includes("【タイトル】U8 大会\n【日付】8月30日（日）\n【調整さんURL】https://chouseisan.com/s?h=u8"));
assert.ok(message.indexOf("U8 大会") < message.indexOf("U10 練習試合"), "日付順になっていません");
assert.equal(message.includes("URLなし"), false);

const categorized = attendance.normalizeEntries([
  {title:"U10 練習試合", start:"2026-09-06", label:"U10", attendanceUrl:"https://chouseisan.com/s?h=cat-u10"}
]);
assert.equal(categorized[0].category, "U10");
assert.equal(categorized[0].color, "#f09300");
assert.equal(attendance.safeCategoryColor("", "U12"), "#8e24aa");
assert.equal(attendance.safeCategoryColor("", "U11"), "#d50000");
assert.equal(attendance.safeCategoryColor("", "U9"), "#e4c441");
assert.equal(attendance.safeCategoryColor("", "U8"), "#7cb342");
assert.equal(attendance.safeCategoryColor("", "U7"), "#0b8043");
assert.equal(attendance.safeCategoryColor("", "全体"), "#616161");
assert.equal(attendance.safeCategoryColor("", "その他"), "#4285f4");
assert.equal(attendance.safeCategoryColor("javascript:alert(1)", "未登録"), "#4285f4");
assert.ok(categorized[0].key.includes("U10 練習試合"), "試合選択用の安定キーがありません");

const selectedMessage = attendance.buildLineMessage([
  {title:"U10だけ", start:"2026-09-06", label:"U10", attendanceUrl:"https://chouseisan.com/s?h=selected"}
]);
assert.ok(selectedMessage.includes("U10だけ"));

const commonSource = fs.readFileSync(path.join(root, "common.js"), "utf8");
const calendarHtml = fs.readFileSync(path.join(root, "calendar.html"), "utf8");
const attendanceHtml = fs.readFileSync(path.join(root, "attendance.html"), "utf8");
assert.ok(commonSource.includes("const UPCOMING_DAYS = 90"), "カレンダーの取得期間が90日になっていません");
assert.ok(commonSource.includes("end.setDate(end.getDate() + UPCOMING_DAYS)"), "90日設定がAPI取得期間へ使われていません");
assert.ok(commonSource.includes('href="attendance.html#match-attendance"'), "カレンダーから参加案内への入口がありません");
assert.ok(commonSource.includes("if (!isCalendarPage) return;"), "出欠ページとカレンダーの表示分岐がありません");
assert.ok(attendanceHtml.includes('id="match-attendance"'), "出欠ページに試合参加案内の本体がありません");
assert.ok(attendanceHtml.includes('id="calendar-attendance-copy"'), "出欠ページにLINE一括コピーボタンがありません");
assert.ok(attendanceHtml.includes('id="calendar-attendance-category"'), "カテゴリー別の一括選択がありません");
assert.ok(attendanceHtml.includes('id="calendar-attendance-select-all"'), "全選択ボタンがありません");
assert.ok(attendanceHtml.includes('id="calendar-attendance-clear"'), "選択解除ボタンがありません");
assert.ok(commonSource.includes("selectedAttendanceKeys"), "選択した試合だけをコピーする処理がありません");
assert.ok(commonSource.includes("selectedEvents"), "LINE文生成へ選択結果を反映していません");
assert.ok(commonSource.includes("category.style.backgroundColor"), "カテゴリー色を画面へ反映していません");
assert.ok(attendanceHtml.includes('src="calendar-attendance.js"'), "出欠ページで調整さんURLの安全な抽出処理を読み込んでいません");
assert.equal(calendarHtml.includes('id="calendar-attendance-copy"'), false, "カレンダーHTMLに管理用のコピーボタンを重複配置しないでください");

console.log("OK: 調整さんURLの安全な抽出、試合・カテゴリー選択、カテゴリー色、LINE案内文、画面の役割分担を検査しました。");
