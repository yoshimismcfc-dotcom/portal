import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const require = createRequire(import.meta.url);
const counter = require(path.join(root, "usage-counter.js"));

assert.equal(counter.monthKey(new Date(2026, 7, 3)), "2026-08", "月キーがYYYY-MMではありません");
assert.equal(counter.pageFeature("/portal/index.html"), "home");
assert.equal(counter.pageFeature("/portal/game_adjust.html"), "game_adjust");
assert.equal(counter.pageFeature("/portal/tournament.html?dateId=secret"), "tournament");
assert.equal(counter.pageFeature("/portal/unknown.html"), "", "未登録ページを送信してはいけません");

for(const key of Object.keys(counter.FEATURE_LABELS)){
  assert.match(key, /^[a-z][a-z0-9_]*$/, `安全でない機能キーです: ${key}`);
  assert.equal(counter.isAllowedFeature(key), true);
}
for(const unsafe of ["武部亮", "team/吉見", "email@example.com", "../../members", "<script>"]){
  assert.equal(counter.isAllowedFeature(unsafe), false, `任意の値を送信できてしまいます: ${unsafe}`);
}

function targetWith(button){ return {closest:()=>button}; }
function button(classNames, onclick, dataEvent){
  return {
    classList:{contains:(name)=>classNames.includes(name)},
    getAttribute:(name)=>name==="onclick"?onclick||"":name==="data-usage-event"?dataEvent||"":""
  };
}
assert.equal(counter.actionFeature(targetWith(button(["btn-line-copy"], "copyTaisen()"))), "line_copy");
assert.equal(counter.actionFeature(targetWith(button(["btn"], "buildTaisen(true)"))), "schedule_auto_create");
assert.equal(counter.actionFeature(targetWith(button(["btn"], "optimizeCurrentSchedule()"))), "schedule_optimize");
assert.equal(counter.actionFeature(targetWith(button(["btn"], "openLineInvite()"))), "line_invite_create");

const source = fs.readFileSync(path.join(root, "usage-counter.js"), "utf8");
for(const forbidden of ["navigator.userAgent", "geolocation", "fingerprint", "location.search", "location.hash", "localStorage"]){
  assert.equal(source.includes(forbidden), false, `匿名カウンターが不要な端末・利用者情報を参照しています: ${forbidden}`);
}
assert.ok(source.includes('var STORAGE_ROOT = "usage_stats_v1"'));
assert.ok(source.includes('db.ref(path).transaction'), "回数の安全な加算処理がありません");
assert.ok(source.includes("sessionStorage"), "同一セッションの重複カウント防止がありません");

const diagnostics = fs.readFileSync(path.join(root, "diagnostics.html"), "utf8");
assert.ok(diagnostics.includes('usageDb.ref("usage_stats_v1/"+month)'), "利用状況画面が集計先を読み込んでいません");
assert.ok(diagnostics.includes("textContent=item.count"), "集計値を安全に表示していません");

console.log("OK: 匿名利用カウンターの保存項目・許可リスト・画面集計を検査しました。");
