import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync("tournament.html","utf8");
const createButtons=html.match(/<button[^>]*>[^<]*対戦表を自動作成<\/button>/g)||[];

assert.equal(createButtons.length,1,"画面上の対戦表自動作成ボタンは1つにしてください");
for(const required of [
  "⚽ 対戦表を自動作成",
  "参加チームから試合順を自動で作ります。",
  "☁️ 対戦表を保存",
  "☁️ 変更を保存",
  "☁️ 保存する",
  "📄 対戦表・順位表をPDFで保存／共有",
  "試合日程・得点・順位表をA4縦1枚のPDFにします。",
  "PDFの保存・共有方法を見る",
  '<details class="secondary-actions no-print">',
  "その他の操作",
  'aria-label="対戦表と順位表をPDFで保存または共有する"'
]) assert.ok(html.includes(required),`シンプルな大会操作UIの要件が不足しています: ${required}`);

assert.ok(!html.includes("☁️ 対戦表を保存・共有"),"対戦表保存ボタンに不要な『共有』を表示しないでください");
assert.ok(!html.includes("☁️ 変更を保存・共有"),"変更保存ボタンに不要な『共有』を表示しないでください");

console.log("tournament simple actions: OK");
