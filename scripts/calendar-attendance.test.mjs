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

const commonSource = fs.readFileSync(path.join(root, "common.js"), "utf8");
assert.ok(commonSource.includes("const UPCOMING_DAYS = 90"), "カレンダーの取得期間が90日になっていません");
assert.ok(commonSource.includes("end.setDate(end.getDate() + UPCOMING_DAYS)"), "90日設定がAPI取得期間へ使われていません");

console.log("OK: 調整さんURLの安全な抽出とLINE案内文を検査しました。");
