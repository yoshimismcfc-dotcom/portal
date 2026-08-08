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

if (!source.includes("function availablePalette()") || !source.includes("function startCustomColor()")) {
  throw new Error("任意カラーを追加・再利用する処理がありません");
}
if (!source.includes("＋ 新しいカラーを追加") || !source.includes("追加した色は次回から候補に表示されます")) {
  throw new Error("任意カラー追加の操作案内がありません");
}
if (!source.includes('if(!colorName){alert("カラー名を入力するか、登録済みのカラーを選んでください")')) {
  throw new Error("カラー名の未入力チェックがありません");
}

if (!source.includes("function exportUniformCSV()") || !source.includes("function uniformCsvCell(value)")) {
  throw new Error("ユニフォームCSV出力処理がありません");
}
if (!source.includes('["背番号","選手名","サイズ","カラー","表示色","状態","貸出先","貸出日","返却予定日","メモ"]')) {
  throw new Error("ユニフォームCSVに必要な列が揃っていません");
}
if (!source.includes('if(/^[=+\\-@\\t\\r]/.test(text))')) {
  throw new Error("CSV数式インジェクション対策がありません");
}

console.log("uniform display tests passed");
