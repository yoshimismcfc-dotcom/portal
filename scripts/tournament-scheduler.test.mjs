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

console.log("tournament scheduler tests: ok");
