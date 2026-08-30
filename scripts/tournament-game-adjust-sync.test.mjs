import fs from "node:fs";
const html=fs.readFileSync("tournament.html","utf8");
const must=[
  'var _gameAdjustRaw = null',
  'status===\"OK\"||status===\"要項送付済\"',
  'var all=[\"吉見SMC\"].concat(confirmed)',
  'syncGameAdjustTeamsToTournament(_activeGameAdjustDateId,{build:false})',
  '_gameAdjustRaw=value&&typeof value===\"object\"?value:null',
  'if(_activeGameAdjustDateId)syncGameAdjustTeamsToTournament(_activeGameAdjustDateId,{build:true})',
  'TOURNAMENT_CONTEXT.saveId&&TOURNAMENT_CONTEXT.view===\"results\"'
];
for(const text of must){if(!html.includes(text)){throw new Error(`missing: ${text}`)}}
console.log("tournament game-adjust sync: OK");
