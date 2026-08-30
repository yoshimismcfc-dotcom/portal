import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const html=fs.readFileSync(path.join(root,"tournament.html"),"utf8");

for(const required of [
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
assert.ok(html.includes("順位表を含む対戦表PDFを作成")&&html.includes("_対戦表・順位表_A4縦1枚.pdf"),"順位表を含む対戦表PDFはA4縦1枚にしてください");
for(const required of [
  "PDFはまだ端末へ自動保存されていません",
  "保存先・LINE・印刷を選ぶ",
  "PDFを端末へダウンロード",
  "ranking-pdf-actions",
  "PDFを作成して保存先を選ぶ",
  "match-editor",
  "＋ 追加試合を入れる",
  "⚽ 試合を追加・削除",
  "ここに試合結果を入力してください",
  "function prepareScoreEntryUrl(copyAfterCreate)",
  "function copyScoreEntryLineMessage()",
  'url.searchParams.set("saveId",saveId)',
  'url.searchParams.set("view","results")',
  "function addManualMatch()",
  "function deleteScheduledMatch(blockIndex,matchId)",
  "function deleteFinalMatch(index)",
  "function deleteManualMatch(id)",
  "追加試合は順位計算に含みません"
]) assert.ok(html.includes(required),"PDFまたは試合追加・削除UIが不足しています: "+required);
const resultsForBlockSource=html.match(/function resultsForBlock\(blockIndex,block\)\{[\s\S]*?\n\}/)?.[0]||"";
assert.ok(resultsForBlockSource.includes("block.matches.forEach")&&!resultsForBlockSource.includes("manualMatches()"),
  "順位計算は自動作成したブロック試合だけを対象にしてください");
assert.match(html,/\.st tr\.taisen-game-row\{display:grid/,"スマホでは試合行を得点入力カードとして表示してください");
assert.match(html,/\.score-input\{width:50px;min-height:48px/,"スマホの得点欄は十分なタップサイズにしてください");


assert.ok(html.includes('.ceremony-row{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important'),"スマホの開会式・閉会式カードは巨大化しない高さにしてください");
assert.ok(html.includes('.ceremony-toggle input[type="checkbox"]{display:block!important;width:22px!important'),"開会式・閉会式のチェックボックスは通常サイズにしてください");
assert.ok(html.includes('.ceremony-detail .form-group{width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important'),"開会式・閉会式の入力欄はスマホ幅内へ収めてください");
console.log("tournament result UI tests passed");

assert.match(html,/<details class="match-editor-details" id="match-editor-details">/,"試合追加・削除一覧は必要なときに開ける折りたたみ表示にしてください");
assert.ok(html.includes('body.score-entry-mode #doc-taisen>.panel'),"共有URLでは設定画面を隠し、得点入力に集中できるようにしてください");

assert.ok(!html.includes('id="match-day-actions"'),"対戦表上部に重複したスコア入力URLパネルを表示しないでください");

for(const required of [
  "function resolveGameAdjustDate(dateId)",
  'normalized==="要綱送付済"',
  'normalized==="要項送付済"',
  'var all=["吉見SMC"].concat(confirmed)',
  "game-adjust-team-sync-note",
  '#team-inputs [id^="names-"]{grid-template-columns:minmax(0,1fr)!important',
  '.ceremony-detail{grid-template-columns:minmax(0,1fr)!important'
]) assert.ok(html.includes(required),"試合調整連携またはスマホ幅対策が不足しています: "+required);
