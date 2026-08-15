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
  'id="modal-uniform-status"',
  "function openUniformStatus(id)",
  "貸出予定にする",
  "今すぐ貸し出す",
  "貸出予定を解除",
  "倉庫保管に戻す",
  "次の貸出予定者を登録",
  "現在の貸出はそのまま残ります",
  'if(!holder){item.storageLocation="warehouse";delete item.lentDate;}',
  'clearPlannedFields(item);if(!holder)item.storageLocation="warehouse"',
  "⚠ 現在このユニフォームを貸出中です",
  "返却後も予定は残ります",
  'planned=d.filter(function(u){return !!u.plannedMemberId;}).length',
  'id="u-loan-state"',
  '<option value="warehouse">🏠 倉庫保管</option>',
  '<option value="planned">🗓 貸出予定</option>',
  '<option value="lent">👕 貸出中</option>',
  'id="u-next-plan-group"',
  "次の貸出予定者（任意）",
  'openMemberPicker(\'edit-plan\')',
  'loanState==="planned"?selectedMemberId',
  'else clearPlannedFields(entry)',
  "function atomicUniformOperations(operations,reason)",
  'FIREBASE_DB.ref("uniform").transaction',
  'FIREBASE_DB.ref("uniform_hist").transaction',
  'plannedSource=op.source||"manual"',
  "function saveUniformEntryById(entry,expectedEntry,reason)",
  "saveUniformEntryById(entry,expectedEntry,editing?\"uniform_edit\":\"uniform_add\")",
  'id="modal-member-picker"',
  "氏名・ふりがなで検索",
  'dbListen("members_v2"',
  'operationId:opId+"_"+op.id',
  "clearPlannedFields(item)",
]) if (!uniform.includes(required)) throw new Error("配布計画・貸出連携が不足しています: " + required);

for (const forbidden of [
  'id="allocation-section"',
  "貸出予定の登録・確認",
  'id="modal-import-allocations"',
  "function previewLegacyAllocations()",
  "function distributeSelectedPlans()",
]) if (uniform.includes(forbidden)) throw new Error("重複した貸出予定UIが残っています: " + forbidden);

for (const required of [
  'if(holderMatch)result.push(Object.assign({state:"lent"},base))',
  'if(item.plannedMemberId===id)result.push(Object.assign({state:"planned"},base))',
]) if (!members.includes(required)) throw new Error("貸出中と次の貸出予定の同時表示が不足しています: " + required);

console.log("uniform allocation tests passed");
