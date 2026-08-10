import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "duty_match.html"), "utf8");
const guide = fs.readFileSync(path.join(root, "guide.html"), "utf8");

function expectIncludes(value, label) {
  if (!source.includes(value)) throw new Error(`duty_match.html: ${label}`);
}

expectIncludes('<label class="form-label" for="md-person-input">担当者</label>', "担当者の直接入力欄がありません");
expectIncludes('persons:readPersonsInput()', "保存時に担当者入力を反映していません");
expectIncludes('split(/[、,，・\\n]+/)', "複数担当者の区切り入力に対応していません");
expectIncludes('<option value="done">✅ 対応済み</option>', "対応済みの正式名称がありません");
expectIncludes('<option value="planned">📅 対応予定</option>', "対応予定の状態がありません");
expectIncludes('<option value="yet">⏳ 未定</option>', "未定の正式名称がありません");
expectIncludes('<option value="na">— 対象外</option>', "対象外の正式名称がありません");
expectIncludes('d.status==="planned"?"📅 対応予定"', "LINEコピーに対応予定が反映されません");

if (source.includes("＋ 追加</button>") || source.includes("function addPerson()")) {
  throw new Error("担当者を反映するための旧『＋追加』操作が残っています");
}
if (!guide.includes("最後の「保存」だけで反映されます") || !guide.includes("✅対応済み・📅対応予定・⏳未定・—対象外")) {
  throw new Error("guide.html: 新しい担当者入力と状態名の説明がありません");
}

console.log("duty match simplified editor tests passed");
