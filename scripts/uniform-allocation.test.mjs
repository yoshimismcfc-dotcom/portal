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
  "確認して取り込むまでは、団員名簿に「貸出予定」として表示されません。",
  "貸出予定を登録",
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

for (const required of [
  'if(holderMatch)result.push(Object.assign({state:"lent"},base))',
  'if(item.plannedMemberId===id)result.push(Object.assign({state:"planned"},base))',
]) if (!members.includes(required)) throw new Error("貸出中と次の貸出予定の同時表示が不足しています: " + required);

console.log("uniform allocation tests passed");
