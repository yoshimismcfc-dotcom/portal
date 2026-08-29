import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const html=fs.readFileSync(path.join(root,"tournament.html"),"utf8");

for(const required of [
  "⚽ 試合結果の入力",
  "入力例：2 － 1",
  "順位表・総当たり表へ自動反映されます",
  "✅ 順位表を更新しました",
  "順位表を見る ↓",
  "試合結果を入力すると自動更新",
  "試合結果未入力",
  'inputmode="numeric"',
  'pattern="[0-9]*"',
  'min="0"',
  "aria-label=",
  "SMCTournamentScheduler.standingDisplay(stat)",
  "result.homeScore!==null",
  "result.awayScore!==undefined"
]) assert.ok(html.includes(required),"得点入力・順位表UIの要件が不足しています: "+required);

assert.match(html,/data-stat="played"><\/td>/,"未入力の試合数は初期表示から空欄にしてください");
assert.doesNotMatch(html,/data-stat="played">0<\/td>/,"未入力順位表に0を入れないでください");
assert.match(html,/if\(!isSchedule&&!scheduleLandscape&&heightAtReadableWidth>maxHeight\*splitThreshold\)/,"対戦表PDFを複数ページへ分割しないでください");
assert.ok(html.includes("対戦表をA4縦1枚PDFで作成")&&html.includes("_対戦表_A4縦1枚.pdf"),"対戦表PDFはA4縦1枚にしてください");
assert.match(html,/\.st tr\.taisen-game-row\{display:grid/,"スマホでは試合行を得点入力カードとして表示してください");
assert.match(html,/\.score-input\{width:50px;min-height:48px/,"スマホの得点欄は十分なタップサイズにしてください");

console.log("tournament result UI tests passed");
