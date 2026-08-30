import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "coach.html"), "utf8");

for (const required of [
  "選択中の大会",
  "操作する大会を選ぶ",
  "ここをタップすると、別の大会へ切り替えられます",
  "function coachEventOptionLabel(item)",
  "data-coach-event-select",
  "function displayTournamentName(item)",
  "function chronologicalCoachDates(dates)",
  "function nextActionFor(item,prep,confirmed)",
  "次にやること",
  "大会の全工程が完了しています",
  "大会準備の状況をLINEで共有",
  "参加状況・任務分担・要項・対戦表・試合結果の進行状況と、この大会を直接開くURLを共有します",
  "大会情報を読み込んでいます",
  "大会がまだ登録されていません",
  "＋ 大会を登録する",
  "coachDataReady",
  'href="members.html"',
  "団員名簿・データ管理",
  "全学年の団員を確認・追加・修正"
]) assert.ok(source.includes(required), "大会管理の初心者向け表示が不足しています: " + required);

for (const required of [
  '{icon:"🤝",name:"参加チーム"',
  '{icon:"👥",name:"担当・任務"',
  '{icon:"📋",name:"大会要綱・対戦表"',
  '{icon:"⚽",name:"試合結果"',
  '{icon:"🏆",name:"順位表・PDF出力"',
  '{icon:"💰",name:"会計・決算"',
  "💬 大会準備の状況をLINEで共有",
  "function flowStepHtml(index,action,state,current,item)",
  'class="coach-flow-step is-',
  'view:"rankings"'
]) assert.ok(source.includes(required), "大会の流れ・操作カードが不足しています: " + required);

assert.doesNotMatch(source, /<div class="coach-event-actions-title">大会の操作<\/div>/,
  "大会の流れと大会の操作を重複表示しないでください");
assert.doesNotMatch(source, /<div class="coach-next-actions">/,
  "大会操作の重複カードを残さないでください");

for (const required of [
  "大会管理ダッシュボード",
  "操作する大会を選ぶ",
  "大会の流れ・操作",
  "STEP ",
  "完了",
  "作業中",
  "未着手",
  "参加チーム",
  "担当・任務",
  "大会要綱・対戦表",
  "試合結果",
  "順位表・PDF出力",
  "会計・決算",
  "tournament_match_results"
]) assert.ok(source.includes(required), "6段階の大会進行UIが不足しています: " + required);

assert.ok(source.includes("✏️ 大会名・日付などを変更") && source.includes("coach-event-edit-button"),
  "選択中の大会から大会名を変更する導線がありません");
assert.ok(source.includes('class="modal-top-return" id="coach-event-edit-top-return"') && source.includes("← 大会管理画面に戻る"),
  "大会名・日付の編集画面上部に戻るボタンがありません");
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
assert.match(source, /\.coach-event-select\{[^}]*width:100%;[^}]*min-height:48px/,
  "選択中の大会は上部の大きな選択欄で切り替えられるようにしてください");
assert.doesNotMatch(source, /<summary>別の大会を選ぶ<\/summary>/,
  "大会選択を画面下部の折りたたみ内へ戻さないでください");
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
