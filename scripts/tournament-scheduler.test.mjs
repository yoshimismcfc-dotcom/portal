import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const scheduler=require("../tournament-scheduler.js");

function teams(count){return Array.from({length:count},(_,i)=>"チーム"+(i+1));}

[4,5,6,8].forEach((count)=>{
  const generated=scheduler.createRoundRobin(teams(count));
  assert.equal(generated.length,count*(count-1)/2);
  assert.equal(scheduler.validate(generated).valid,true);
  const result=scheduler.optimize(generated);
  assert.equal(result.matches.length,generated.length);
  assert.equal(scheduler.validate(result.matches).valid,true);
  assert.ok(result.report.consecutiveCount<=scheduler.evaluate(generated).consecutiveCount);
  assert.deepEqual(
    scheduler.optimize(generated).matches.map((m)=>m.id),
    result.matches.map((m)=>m.id),
    "同じ入力では同じ結果になる"
  );
});

{
  const original=scheduler.createRoundRobin(teams(5));
  original[2].fixed=true;
  const result=scheduler.optimize(original);
  assert.equal(result.matches[2].id,original[2].id,"固定試合は元の枠を維持する");
}

{
  const manual=[
    {id:"a",home:"A",away:"B"},
    {id:"b",home:"A",away:"C"},
    {id:"c",home:"B",away:"C"}
  ];
  const result=scheduler.optimize(manual);
  assert.equal(scheduler.validate(result.matches).valid,true);
}

{
  const standings=scheduler.calculateStandings(
    ["A","B","C"],
    [{id:"ab",home:"A",away:"B"},{id:"ac",home:"A",away:"C"},{id:"bc",home:"B",away:"C"}],
    {ab:{homeScore:0,awayScore:0},ac:{homeScore:2,awayScore:1},bc:{homeScore:"",awayScore:3}}
  );
  assert.deepEqual(standings.map(row=>row.team),["A","B","C"]);
  assert.deepEqual(standings.map(row=>[row.played,row.wins,row.draws,row.losses,row.goalsFor,row.goalsAgainst,row.points]),[
    [2,1,1,0,2,1,4],[1,0,1,0,0,0,1],[1,0,0,1,1,2,0]
  ]);
  const sameRank=scheduler.calculateStandings(["A","B"],[{id:"ab",home:"A",away:"B"}],{});
  assert.deepEqual(sameRank.map(row=>row.rank),[0,0]);
}

{
  const headToHead=scheduler.calculateStandings(
    ["A","B","C","D"],
    [{id:"ab",home:"A",away:"B"},{id:"ac",home:"A",away:"C"},{id:"ad",home:"A",away:"D"},{id:"bc",home:"B",away:"C"},{id:"bd",home:"B",away:"D"}],
    {ab:{homeScore:1,awayScore:0},ac:{homeScore:0,awayScore:1},ad:{homeScore:1,awayScore:0},bc:{homeScore:1,awayScore:0},bd:{homeScore:1,awayScore:0}}
  );
  assert.ok(headToHead.findIndex(row=>row.team==="A")<headToHead.findIndex(row=>row.team==="B"));
}

// ケースA：全試合未入力。表示上は順位・全数値を空欄にする。
{
  const rows=scheduler.calculateStandings(["吉見SMC","A FC"],[{id:"m1",home:"吉見SMC",away:"A FC"}],{});
  rows.forEach((row)=>assert.deepEqual(scheduler.standingDisplay(row),{
    rank:"",played:"",wins:"",draws:"",losses:"",goalsFor:"",goalsAgainst:"",goalDifference:"",points:""
  }));
}

// ケースB：0対0は未入力ではなく、引き分けとして0を表示する。
{
  const rows=scheduler.calculateStandings(["吉見SMC","A FC"],[{id:"m1",home:"吉見SMC",away:"A FC"}],{m1:{homeScore:0,awayScore:0}});
  const smc=scheduler.standingDisplay(rows.find((row)=>row.team==="吉見SMC"));
  assert.deepEqual([smc.played,smc.wins,smc.draws,smc.losses,smc.goalsFor,smc.goalsAgainst,smc.goalDifference,smc.points],[1,0,1,0,0,0,0,1]);
}

// ケースC：2対1を正しく勝敗・得失点・勝点へ反映する。
{
  const rows=scheduler.calculateStandings(["吉見SMC","A FC"],[{id:"m1",home:"吉見SMC",away:"A FC"}],{m1:{homeScore:2,awayScore:1}});
  const smc=scheduler.standingDisplay(rows.find((row)=>row.team==="吉見SMC"));
  assert.deepEqual([smc.rank,smc.played,smc.wins,smc.draws,smc.losses,smc.goalsFor,smc.goalsAgainst,smc.goalDifference,smc.points],[1,1,1,0,0,2,1,1,3]);
}

// ケースD：複数試合は勝点→得失点差→総得点の順で並ぶ。
{
  const matches=[{id:"ab",home:"A",away:"B"},{id:"ac",home:"A",away:"C"},{id:"bc",home:"B",away:"C"}];
  const rows=scheduler.calculateStandings(["A","B","C"],matches,{ab:{homeScore:2,awayScore:1},ac:{homeScore:0,awayScore:0},bc:{homeScore:3,awayScore:0}});
  assert.deepEqual(rows.map((row)=>row.team),["A","B","C"]);
  assert.deepEqual(rows.map((row)=>row.rank),[1,2,3]);
}

// 片方だけの得点は未確定として計算に含めない。
{
  const rows=scheduler.calculateStandings(["A","B"],[{id:"ab",home:"A",away:"B"}],{ab:{homeScore:0,awayScore:""}});
  assert.deepEqual(rows.map((row)=>row.played),[0,0]);
}

console.log("tournament scheduler tests: ok");
