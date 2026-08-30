import fs from "node:fs";
const html=fs.readFileSync("tournament.html","utf8");
const must=[
  'var _gameAdjustRaw = null',
  'function resolveGameAdjustDate(dateId)',
  'normalized==="OK"||normalized==="要項送付済"||normalized==="要綱送付済"',
  'var all=["吉見SMC"].concat(confirmed)',
  'syncGameAdjustTeamsToTournament(_activeGameAdjustDateId,{build:false})',
  '_gameAdjustRaw=value&&typeof value==="object"?value:null',
  'normalizedGameAdjust=value&&typeof value==="object"',
  'if(_activeGameAdjustDateId)syncGameAdjustTeamsToTournament(_activeGameAdjustDateId,{build:true})',
  'TOURNAMENT_CONTEXT.saveId&&TOURNAMENT_CONTEXT.view==="results"',
  'String(item&&item.id||"")===String(dateId||"")',
  'String(entry[1].gameAdjustDateId||"")===String(dateId||"")'
];
for(const text of must){if(!html.includes(text)){throw new Error(`missing: ${text}`)}}

for(const text of [
  'opponentCount>=5||(opponentCount===4&&currentCourts===2)',
  'if(!useTwoCourts)return [all]',
  'if(teamName)teams.push(teamName)',
  'if(clearEl)clearEl.value=""',
  'namedCount>=2',
  '.ceremony-toggle input[type="checkbox"]'
]){if(!html.includes(text)){throw new Error(`missing new sync/mobile rule: ${text}`)}}

console.log("tournament game-adjust sync: OK");
