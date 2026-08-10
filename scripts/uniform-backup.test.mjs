import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "uniform.html"), "utf8");

assert.doesNotMatch(source, /dbSave\("uniform",/,
  "ユニフォーム本体を競合確認なしで上書きしないでください");
assert.match(source, /function writeUniformWithConflictCheck\(next,expected\)/);
assert.match(source, /uniformStableSignature\(actual\)!==expectedSignature/);
assert.match(source, /FIREBASE_DB\.ref\("uniform"\)\.transaction/);
assert.match(source, /return dbSave\("uniform_backups\/"\+backupId,backup,null,null\)/);
assert.match(source, /return writeUniformWithConflictCheck\(next,backup\.items\)/);

const saveStart = source.indexOf("function saveU(d,reason)");
const saveEnd = source.indexOf("function restoreDeviceInventory", saveStart);
const saveBody = source.slice(saveStart, saveEnd);
assert.ok(saveBody.indexOf("readUniformCloud()") < saveBody.indexOf('dbSave("uniform_backups/"+backupId'),
  "最新クラウド確認をバックアップより先に行ってください");
assert.ok(saveBody.indexOf('dbSave("uniform_backups/"+backupId') < saveBody.indexOf("writeUniformWithConflictCheck(next,backup.items)"),
  "在庫更新より先にバックアップを完了してください");
assert.match(saveBody, /_uniformWriteInFlight/);
assert.match(saveBody, /古いデータでの上書きを停止/);

for (const required of [
  "function ensureDailyUniformBackup(items)",
  "function createManualUniformBackup()",
  "function restoreSelectedUniformBackup()",
  "復元前の現在データも自動保存されます",
  'id="modal-uniform-backup"',
  "現在の在庫を保存",
  "このバックアップへ戻す"
]) assert.ok(source.includes(required), "バックアップ復元機能が不足しています: " + required);

for (const required of [
  "function acceptCurrentUniformInventory()",
  "現在の在庫で確定",
  'reason:"recovery_baseline"',
  'localStorage.setItem(KR,JSON.stringify(baseline))',
  "復元候補はバックアップへ保存されています"
]) assert.ok(source.includes(required), "現在の正しい在庫を復元基準にする機能が不足しています: " + required);
const acceptStart = source.indexOf("function acceptCurrentUniformInventory()");
const acceptEnd = source.indexOf("function japanDateKey()", acceptStart);
const acceptBody = source.slice(acceptStart, acceptEnd);
assert.ok(acceptBody.indexOf('dbSave("uniform_backups/"+archiveId') < acceptBody.indexOf("localStorage.setItem(KR"),
  "復元候補のバックアップ完了前に現在在庫を確定しないでください");

assert.match(source, /if\(answer!=="復元"\)/,
  "誤操作防止の復元確認が必要です");
assert.match(source, /saveU\(entry\.items,"backup_restore:"\+entry\.key\)/,
  "復元も通常の安全保存経路を使用してください");
assert.match(source, /if\(!result\|\|!result\.ok\)return;[\s\S]{0,500}saveH\(history\)/,
  "在庫保存に失敗した場合は履歴を追加しないでください");

console.log("uniform backup and conflict-protection tests passed");
