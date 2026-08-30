import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const management = require(path.join(root, "tournament-management.js"));

const snapshots = {
  gameAdjust:{
    dates:[{id:"d_target",tournamentName:"対象大会",dateIso:"2026-09-01"},{id:"d_keep",tournamentName:"残す大会",dateIso:"2026-10-01"}],
    teams:[{id:"t1",name:"A",statuses:{d_target:"OK",d_keep:"NG"}},{id:"t2",name:"B",statuses:{d_target:"－",d_keep:"OK"}}],
    備考:{d_target:"削除対象",d_keep:"残す"}
  },
  duties:[{id:"ga_d_target",gameAdjustDateId:"d_target"},{id:"ga_d_keep",gameAdjustDateId:"d_keep"},{id:"legacy"}],
  tournamentSaves:{save_target:{gameAdjustDateId:"d_target",type:"taisen"},save_keep:{gameAdjustDateId:"d_keep",type:"taisen"},standalone:{type:"youkou"}},
  tournamentResults:{date_d_target:{results:{a:{homeScore:0,awayScore:0}}},date_d_keep:{results:{b:{homeScore:2,awayScore:1}}}},
  accounting:{tournaments:[{id:"accounting_game_d_target",gameAdjustDateId:"d_target"},{id:"accounting_game_d_keep",gameAdjustDateId:"d_keep"},{id:"legacy-accounting"}]}
};

const plan = management.buildDeletePlan(snapshots, "d_target");
assert.equal(plan.found, true);
assert.deepEqual(plan.updates["game_adjust/dates"].map((item) => item.id), ["d_keep"]);
assert.equal(plan.updates["game_adjust/teams"][0].statuses.d_target, undefined);
assert.equal(plan.updates["game_adjust/teams"][0].statuses.d_keep, "NG");
assert.deepEqual(plan.updates.duty_match.map((item) => item.id), ["ga_d_keep", "legacy"]);
assert.deepEqual(plan.updates["accounting/tournaments"].map((item) => item.id), ["accounting_game_d_keep", "legacy-accounting"]);
assert.equal(plan.updates["tournament_saves/save_target"], null);
assert.equal(Object.hasOwn(plan.updates, "tournament_saves/save_keep"), false);
assert.equal(plan.updates["tournament_match_results/date_d_target"], null);
assert.equal(Object.hasOwn(plan.updates, "tournament_match_results/date_d_keep"), false);
assert.equal(plan.backup.tournament.tournamentName, "対象大会");
assert.equal(plan.backup.teamStatuses[0].status, "OK");
assert.equal(plan.backup.tournamentResults.results.a.homeScore, 0, "0対0をバックアップで未入力扱いにしない");

const absent = management.buildDeletePlan(snapshots, "missing");
assert.equal(absent.found, false);
assert.deepEqual(absent.updates, {});

const coachSource = fs.readFileSync(path.join(root, "coach.html"), "utf8");
for (const required of [
  "＋ 新しい大会を追加","大会を整理・削除","＋ 最初の大会を追加する","大会を追加する","追加しています…",
  "同じ日付・学年・大会名の大会があります","削除前のデータをJSONで保存","内容を確認して削除へ進む",
  "大会を完全に削除する","readCoachEventSnapshots","SMCTournamentManagement.buildDeletePlan","db.ref().update(plan.updates)",
  "selectedBefore=selectedCoachEventId","preserved=dates.find","Math.random().toString(36).slice(2,8)",
  'role="status" aria-live="polite"','role="status" aria-live="assertive"'
]) assert.ok(coachSource.includes(required), `大会追加・削除UIまたは安全処理が不足しています: ${required}`);

assert.match(coachSource, /\.coach-event-add-button[^}]*min-height:48px/);
assert.match(coachSource, /\.coach-event-management-actions\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
assert.match(coachSource, /@media\(max-width:640px\)[\s\S]*?\.coach-event-management-actions\{grid-template-columns:1fr\}/);

console.log("tournament management add/delete tests passed");
