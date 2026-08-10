import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const game = fs.readFileSync(path.join(root, "game_adjust.html"), "utf8");
const common = fs.readFileSync(path.join(root, "common.js"), "utf8");

for (const required of [
  'var CYCLE = ["－","OK","要項送付済","NG","確認中"]',
  '"要項送付済":"s-sent"',
  'function isParticipatingStatus(status){return status==="OK"||status==="要項送付済";}',
  'class="status-btn s-sent">要項送付済</span>参加確定・送付済み',
  'ga-chip ga-chip-sent',
  'statuses={"OK":0,"要項送付済":0,"NG":0,"確認中":0,"－":0}',
  '要項送付済：" + sent.map',
  '参加：" + (ok.length+sent.length)',
  'isParticipatingStatus((t.statuses||{})[d.id]||"－")'
]) assert.ok(game.includes(required), "要項送付済ステータスの実装が不足しています: " + required);

assert.ok((game.match(/isParticipatingStatus\(/g) || []).length >= 5,
  "要項送付済を参加数・残り数へ反映してください");
assert.match(common, /status-btn s-sent">要項送付済/);
assert.match(common, /"要項送付済": 0, "OK": 1, "確認中": 2, "－": 3, "NG": 4/);
assert.match(common, /status-btn\.s-sent/);
assert.match(game, /announceGameAdjustDataRendered\(meta\)/,
  "クラウドデータの初回描画後に並び替えを通知していません");
assert.match(common, /addEventListener\("smc:game-adjust-data-rendered"[\s\S]*?pendingTeamSort = true/,
  "クラウドデータ読込後の初回並び替えがありません");

console.log("game adjustment guideline-sent status tests passed");
