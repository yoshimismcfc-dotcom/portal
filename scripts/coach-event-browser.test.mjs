import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "coach.html"), "utf8");

for (const required of [
  "直近の大会",
  "すべての大会を見る",
  "選択中の大会",
  "過去・日付未設定の大会を見る",
  "function displayTournamentName(item)",
  "function chronologicalCoachDates(dates)",
  "function nextActionFor(item,prep,confirmed)",
  "次に行うこと",
  "大会準備は完了しています",
  "大会準備の状況をLINEで共有",
  "参加状況・任務分担・要項・対戦表の準備状況と、この大会を直接開くURLを共有します",
  "大会情報を読み込んでいます",
  "大会がまだ登録されていません",
  "＋ 大会を登録する",
  "coachDataReady",
  "showAllCoachEvents"
]) assert.ok(source.includes(required), "大会管理の初心者向け表示が不足しています: " + required);

for (const required of [
  '<span class="coach-action-icon" aria-hidden="true">📊</span>',
  '<span class="coach-action-icon" aria-hidden="true">👥</span>',
  '<span class="coach-action-icon" aria-hidden="true">📋</span>',
  '<span class="coach-action-icon" aria-hidden="true">💴</span>',
  "💬 大会準備の状況をLINEで共有",
  "coach-action-card is-adjust",
  "coach-action-card is-duty",
  "coach-action-card is-guideline",
  "coach-action-card is-accounting"
]) assert.ok(source.includes(required), "大会操作カードの絵文字または配色が不足しています: " + required);

assert.ok(source.includes("✏️ 大会名・日付を変更") && source.includes("coach-event-edit-button"),
  "選択中の大会から大会名を変更する導線がありません");
assert.ok(source.includes('data-coach-edit-event=') && source.includes('id="coach-event-edit-modal"'),
  "大会名・日付をコーチ画面内で直接編集できません");
assert.ok(source.includes('db.ref("game_adjust").transaction') && source.includes("item.tournamentName=values.name"),
  "大会情報を最新クラウドデータへ安全に反映する処理がありません");
assert.doesNotMatch(source, /coach-event-edit-button" href=/,
  "大会名・日付の変更で別画面へ移動しないでください");
assert.ok(source.includes("大会IDは変わらないため") && source.includes("参加状況・任務分担・要項・会計"),
  "関連データが維持される案内がありません");
assert.match(source, /function displayTournamentName\(item\)\{\s*return String\(item&&item\.tournamentName\|\|""\)\.trim\(\)\|\|"大会名未設定";\s*\}/,
  "大会名は保存された正式名称を省略せず表示してください");
assert.doesNotMatch(source, /dotted=date\.replace|name\.slice\(prefix\.length\)|name\.slice\(category\.length\)/,
  "正式な大会名から日付やカテゴリーを自動削除しないでください");

assert.doesNotMatch(source, /横にスライドできます/,
  "大会一覧に横スクロール案内を残さないでください");
assert.match(source, /\.coach-event-tabs\{display:grid;[^}]*overflow:visible/,
  "大会一覧は横スクロールのない縦一覧にしてください");
assert.match(source, /\.coach-preparation-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  "準備状況は画面内に収まる2列表示にしてください");
assert.match(source, /\.coach-next-step\{[^}]*border:1px solid rgba\(255,82,82,[^)]+\)[^}]*background:rgba\(255,54,74,[^)]+\)/,
  "未完了の「次に行うこと」は赤系で表示してください");
assert.match(source, /body\[data-theme="light"\] \.coach-next-step\{background:#fff0f2;border-color:#c6283d\}/,
  "ライトモードの「次に行うこと」も赤系で表示してください");
assert.doesNotMatch(source, /@media\(max-width:340px\)\{[^}]*\.coach-next-actions\{grid-template-columns:1fr/,
  "320pxでも大会操作カードの2列表示を維持してください");
assert.match(source, /status==="OK"\|\|status==="要項送付済"/,
  "要項送付済みも参加確定数に含めてください");
assert.ok(source.indexOf('id="coach-event-browser"') < source.indexOf("セクション：コーチ共有"),
  "大会管理はコーチ共有より上へ配置してください");

const matchSectionStart = source.indexOf("セクション：試合・大会");
const sharedSectionStart = source.indexOf("セクション：コーチ共有");
const matchSection = source.slice(matchSectionStart, sharedSectionStart);
assert.doesNotMatch(matchSection, /class="c-card-grid"/,
  "大会カード内と同じ機能の大きなカードを重複表示しないでください");

console.log("coach event browser mobile UX tests passed");
