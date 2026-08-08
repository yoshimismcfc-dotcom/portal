import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "pitch.html"), "utf8");

for (const required of [
  "低学年6人制ピッチ",
  "縦50m × 横32m",
  "約59.4m",
  "各ゴールラインから10m",
  "大会要項の指定を最優先"
]) {
  if (!source.includes(required)) throw new Error("6人制ピッチ情報が不足しています: " + required);
}
if (!source.includes('aria-label="縦50メートル、横32メートルの低学年6人制ピッチ図"')) {
  throw new Error("6人制ピッチ図の読み上げ説明がありません");
}

console.log("pitch dimensions tests passed");
