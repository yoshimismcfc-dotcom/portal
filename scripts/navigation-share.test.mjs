import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const common = fs.readFileSync(path.join(root, "common.js"), "utf8");
const css = fs.readFileSync(path.join(root, "common.css"), "utf8");
const firebase = fs.readFileSync(path.join(root, "firebase-config.js"), "utf8");
const coach = fs.readFileSync(path.join(root, "coach.html"), "utf8");

for (const required of [
  'var PREVIOUS_KEY="smc-portal-previous-url-v1"',
  "function safePortalUrl(value)",
  "url.origin!==location.origin",
  "url.pathname.indexOf(base)!==0",
  "function tournamentProgressFallback()",
  'url.searchParams.set("eventId",id)',
  'url.hash="coach-match"',
  "function requestBackNavigation(button)",
  "保存が完了してから戻ります",
  "保存できていない変更がある可能性があります",
  "document.addEventListener(\"DOMContentLoaded\",installBackButton)",
  "window.SMCNavigation="
]) assert.ok(common.includes(required), "共通の安全な戻る処理が不足しています: " + required);

assert.ok(common.indexOf("internalReferrer()") < common.indexOf("storedPreviousUrl()", common.indexOf("function performBackNavigation")),
  "戻る処理はアプリ内履歴を端末保存履歴より優先してください");
assert.match(css, /\.smc-smart-back\{[^}]*min-height:44px/,
  "戻るボタンは44px以上のタップ領域が必要です");
assert.match(css, /@media print\{\.smc-page-nav\{display:none!important\}\}/,
  "戻るナビゲーションを印刷しないでください");
assert.ok(firebase.indexOf("emitSaveStatus({saving:true,path:path,ok:false})") < firebase.indexOf("var localSaved = true", firebase.indexOf("function dbSave")),
  "保存開始を戻る処理へ通知してください");

for (const required of [
  'new URLSearchParams(location.search).get("eventId")',
  "function validCoachEventId(value)",
  "function syncCoachEventUrl(id)",
  'history.replaceState({eventId:safeId}',
  "function coachEventShareUrl(item)",
  "function preparationShareText(item)",
  "navigator.share({title:displayTournamentName(item)+\" 大会準備\",text:text,url:url})",
  "共有された大会情報を読み込んでいます",
  "共有された大会が見つかりませんでした",
  "大会準備の状況とURLをコピーしました",
  "🔗 大会URLだけコピー",
  "この大会のURLをコピーしました"
]) assert.ok(coach.includes(required), "大会専用URLまたは共有機能が不足しています: " + required);

assert.match(coach, /status==="OK"\|\|status==="要項送付済"/,
  "要項送付済みも参加確定数に含めてください");
assert.doesNotMatch(coach, /coachEventShareUrl[\s\S]{0,500}tournamentName/,
  "共有URLに大会名や個人情報を含めないでください");

console.log("shared tournament URL and smart back navigation tests passed");
