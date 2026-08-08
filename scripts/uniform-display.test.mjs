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
if (!source.includes('class="uniform-borrower"') || !source.includes("escapeHtml(u.lentTo)")) {
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
if (!source.includes('["背番号","選手名","サイズ","メインカラー","メイン表示色","サブカラー","サブ表示色","状態","貸出先","貸出日","返却予定日","メモ"]')) {
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
  "function selectPairTemplate(templateName)",
  '"オレンジ赤縦じま":["オレンジ","赤"]',
  '"水色ピンク":["水色","ピンク"]'
]) {
  if (!source.includes(required)) throw new Error("カラーテンプレートの復元が不足しています: " + required);
}

console.log("uniform display tests passed");
