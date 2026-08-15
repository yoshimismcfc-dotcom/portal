import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const members = fs.readFileSync(path.join(root, "members.html"), "utf8");
const uniform = fs.readFileSync(path.join(root, "uniform.html"), "utf8");

for (const required of [
  'var MEMBER_UNIFORM_SOURCE = "uniform"',
  "function uniformAssignmentsForMember(member)",
  'item.plannedMemberId===id',
  'item.memberId===id',
  'db.ref(MEMBER_PATH+"/"+id).update(changes)',
  "uniformAssignmentsForMember(memberRecords[editId]||{})",
  "ユニフォーム貸出管理の「貸出予定」「貸出中」を自動表示します",
]) if (!members.includes(required)) throw new Error("団員名簿連携が不足しています: " + required);

for (const forbidden of [
  'id="member-uniform-editor"',
  "＋ ユニフォームを追加",
  'class="member-uniform-number"',
]) if (members.includes(forbidden)) throw new Error("団員名簿に旧ユニフォーム編集UIが残っています: " + forbidden);

for (const required of [
  'id="allocation-section"',
  'id="allocation-section" open',
  "🗓 貸出予定を入力する",
  "① ユニフォームの色を選ぶ",
  "③ 貸出予定の団員を選ぶ",
  "貸出予定を登録しました。",
  "貸出予定を登録",
  "function atomicUniformOperations(operations,reason)",
  'FIREBASE_DB.ref("uniform").transaction',
  'FIREBASE_DB.ref("uniform_hist").transaction',
  'plannedSource=op.source||"manual"',
  'source:"members_v2"',
  "function previewLegacyAllocations()",
  "function distributeSelectedPlans()",
  "function unplanUniform(id)",
  'id="modal-member-picker"',
  "氏名・ふりがなで検索",
  'dbListen("members_v2"',
  'operationId:opId+"_"+op.id',
  "clearPlannedFields(item)",
]) if (!uniform.includes(required)) throw new Error("配布計画・貸出連携が不足しています: " + required);

console.log("uniform allocation tests passed");
