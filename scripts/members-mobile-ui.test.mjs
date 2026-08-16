import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "members.html"), "utf8");

for (const required of [
  "@media(max-width:768px)",
  "#grid-view,#list-view{display:none!important}",
  ".mobile-card-view{display:grid;gap:12px;min-width:0",
  'id="mobile-card-view"',
  "function renderMobileCards()",
  "function toggleMobileGrade(grade)",
  'aria-label="表示する学年"',
  'aria-label="団員の並び替え"',
  'el.setAttribute("aria-pressed"',
  "function memberDisplayNumber(member)",
  'item.state==="lent"',
  'item.state==="planned"',
  "renderMemberUniformBadges(member)",
  "mobile-add-member",
  "openMemberCardFromKey",
  ".page-wrap{overflow-x:hidden;overflow-x:clip}",
]) {
  if (!source.includes(required)) throw new Error("スマートフォン名簿UIが不足しています: " + required);
}

for (const forbidden of [
  'dbSave("uniform"',
  'dbSave("uniform/',
  'db.ref("uniform").set',
]) {
  if (source.includes(forbidden)) throw new Error("団員名簿からuniformへの書き込みが追加されています: " + forbidden);
}

console.log("members mobile UI tests passed");
