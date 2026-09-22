import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "pitch.html"), "utf8");

for (const required of [
  "低学年6人制ピッチ",
  "縦40m × 横30m",
  "50m（長方形確認用）",
  "各ゴールラインから4m",
  "ゴールラインから7m",
  "半径4m",
  "大会要項の指定を最優先"
]) {
  if (!source.includes(required)) throw new Error("6人制ピッチ情報が不足しています: " + required);
}
if (!source.includes('aria-label="縦40メートル、横30メートルの低学年6人制ピッチ図。')) {
  throw new Error("6人制ピッチ図の読み上げ説明がありません");
}

const eightAt = source.indexOf('alt="8人制サッカーピッチ寸法図"');
const sixAt = source.indexOf('class="six-pitch-card"');
if (eightAt < 0 || sixAt <= eightAt) {
  throw new Error("メインの8人制ピッチより前に6人制ピッチが表示されています");
}
if (!source.includes("参考：低学年6人制")) {
  throw new Error("低学年6人制が参考情報として区別されていません");
}

console.log("pitch dimensions tests passed");
