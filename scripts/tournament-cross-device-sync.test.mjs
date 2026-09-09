import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync("tournament.html","utf8");

for(const required of [
  'dbListen("tournament_saves", function(val,sourceMeta)',
  'sourceMeta && sourceMeta.authoritative',
  'cloudChanged&&(_tournamentDirty.youkou||_tournamentDirty.taisen)',
  'hydrateLinkedDate(_activeGameAdjustDateId,_activeDateMeta)',
  'if(!loadedPairs.taisen)syncGameAdjustTeamsToTournament',
  'if(_activeGameAdjustDateId&&!latestLinkedPair("taisen"))',
  '☁️ 要項を保存・共有',
  '☁️ 対戦表を保存',
  '☁️ 保存する',
  'クラウドに保存しました。他の端末にも最新内容が反映されます。',
  '別の端末で新しい内容が保存されています',
  'function reloadLatestCloudSave()',
  'id="cloud-save-status"',
  'id="cloud-save-modal-status"',
  'saveButton.disabled=true',
  '通信状況を確認して、もう一度お試しください'
]) assert.ok(html.includes(required),`端末間同期・保存案内の要件が不足しています: ${required}`);

const hydrate=html.match(/function hydrateLinkedDate\(dateId, meta\)\{[\s\S]*?\n\}/)?.[0]||"";
assert.ok(hydrate.includes("loadedPairs.taisen")&&hydrate.includes("_loadedSaveVersions.taisen"),"保存済み対戦表の版を保持してください");
assert.ok(hydrate.includes("if(!loadedPairs.taisen)syncGameAdjustTeamsToTournament"),"保存済み対戦表を無条件に上書きしないでください");

console.log("tournament cross-device sync: OK");
