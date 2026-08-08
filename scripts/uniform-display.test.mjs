import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "uniform.html"), "utf8");

const paletteAt = source.indexOf("var PALETTE=");
const syncAt = source.indexOf("startUniformSync();");
const renderAt = source.indexOf("function renderFolders()");
if (paletteAt < 0 || renderAt < 0 || syncAt < 0 || !(paletteAt < renderAt && renderAt < syncAt)) {
  throw new Error("ユニフォーム同期は色・一覧描画の定義後に開始してください");
}
if (!source.includes('data-label="氏名"') || !source.includes("escapeHtml(u.lentTo||u.player||'—')")) {
  throw new Error("貸出先の氏名を安全に一覧表示する処理がありません");
}
if (!source.includes('val.filter(function(item){return item && typeof item==="object";})')) {
  throw new Error("Firebase配列内の空要素を除外する処理がありません");
}

if (!source.includes("function availableSingleColors()") || !source.includes('list="uniform-color-options"')) {
  throw new Error("任意カラーを入力・再利用する処理がありません");
}
if (!source.includes('if(!mainColorName){alert("メインカラーを入力してください")')) {
  throw new Error("メインカラーの未入力チェックがありません");
}

if (!source.includes("function exportUniformCSV()") || !source.includes("function uniformCsvCell(value)")) {
  throw new Error("ユニフォームCSV出力処理がありません");
}
if (!source.includes('["背番号","選手名","サイズ","メインカラー","メイン表示色","サブカラー","サブ表示色","状態","貸出先","貸出日","返却予定日","備考"]')) {
  throw new Error("ユニフォームCSVに必要な列が揃っていません");
}
if (!source.includes('if(/^[=+\\-@\\t\\r]/.test(text))')) {
  throw new Error("CSV数式インジェクション対策がありません");
}

for (const required of [
  "メインカラー（必須）",
  "サブカラー（任意）",
  "mainColorName:mainColorName",
  "subColorName:subColorName",
  'u.mainColorName||u.cname||""',
  'u.mainColorCode||u.ccode',
  '"メインカラー","メイン表示色","サブカラー","サブ表示色"'
]) {
  if (!source.includes(required)) throw new Error("メイン・サブカラー対応が不足しています: " + required);
}
if (!source.includes('subColorName?document.getElementById("u-sub-ccode").value:""')) {
  throw new Error("サブカラー未設定時の互換処理がありません");
}

for (const required of [
  "組み合わせテンプレート",
  'id="uniform-pair-templates"',
  "function buildPairTemplates()",
  "function selectPairTemplate(templateId)",
  'class="template-color-name',
  'p.mainName+(p.subName?" × "+p.subName:"")',
  '"オレンジ赤縦じま":["オレンジ","赤"]',
  '"水色ピンク":["水色","ピンク"]'
]) {
  if (!source.includes(required)) throw new Error("カラーテンプレートの復元が不足しています: " + required);
}

for (const required of [
  "団員名（貸出先）",
  "名前を入力すると「選手に貸出中」、空欄にすると「倉庫保管」",
  "🏠 倉庫保管",
  "選手に貸出中",
  "貸出する",
  "返却する",
  'entry.storageLocation="player"',
  'entry.storageLocation="warehouse"',
  "u.lentTo||u.player||"
]) {
  if (!source.includes(required)) throw new Error("保管状況の分かりやすい表示・自動判定が不足しています: " + required);
}
if (!source.includes("previousHolder!==holderName")) {
  throw new Error("登録画面から貸出先を変更した履歴が保存されません");
}

for (const required of [
  'data-label="背番号"',
  'data-label="氏名"',
  'data-label="状況"',
  'class="status-action is-lent"',
  'class="status-action is-free"',
  'class="edit-icon-btn"',
  ".uni-table{font-size:.74rem}",
  "function openAddForColor(colorLabel,mainName,mainCode,subName,subCode)",
  "＋ 背番号・サイズ・団員名を入力",
  "右端の矢印は一覧の開閉です",
  'class="cf-toggle-button"',
  'classList.add("direct-color")',
  'classList.remove("direct-color")',
  "＋ メイン・サブカラーを選んで追加",
  "function openAddWithColorPicker()",
  "function useCurrentColorsForUniform()",
  "この色でユニフォームを登録",
  "備考（特徴・用途）",
  "キーパー用",
  "function setFolderReorderMode(force)",
  "function moveColorFolder(name,delta)",
  'dbSave("uniform_folder_order"',
  'dbListen("uniform_folder_order"',
  "組み合わせテンプレートから選ぶ",
  "＋ テンプレートに色を追加",
  "テンプレートにも追加",
  "function toggleTemplateColorEditor(forceOpen)",
  "function setUniformDetailsReady(ready,colorLabel)",
  "function updateUniformNumberGuide(colorLabel)",
  "この色の登録済み背番号",
  "この色には背番号 #",
  'uniformColorLabel(item)===colorName',
  "var items=cg.items.slice().sort",
  "Number(a.num)-Number(b.num)",
  "最初に色の組み合わせを選んでください",
  "背番号・サイズ・団員名を入力してください",
  'id="u-save-btn"',
  "長押しすると順番を変更できます",
  "function addCurrentPairTemplate()",
  "function wireTemplateLongPress()",
  "function movePairTemplate(index,delta)",
  'dbSave("uniform_color_templates"',
  'dbListen("uniform_color_templates"'
]) {
  if (!source.includes(required)) throw new Error("スマホ縦表示または共有テンプレート管理が不足しています: " + required);
}
if (!source.includes("setTimeout(function(){_templateLongPressed=true;setTemplateReorderMode(true);},600)")) {
  throw new Error("テンプレートの長押し判定がありません");
}
if (!(source.indexOf('id="color-folders"') < source.indexOf("＋ メイン・サブカラーを選んで追加"))) {
  throw new Error("補助操作ボタンは色一覧より下に配置してください");
}

for (const required of [
  'id="main-color-options"',
  'id="sub-color-options"',
  "登録済みの色から選択",
  "function buildSingleColorPalettes()",
  "function chooseSharedColor(role,name,code)",
  "loadColorTemplates().forEach(function(template)",
  'toLocaleLowerCase("ja")'
]) {
  if (!source.includes(required)) throw new Error("全員の登録済みカラーを共有・重複排除する処理が不足しています: " + required);
}

console.log("uniform display tests passed");
