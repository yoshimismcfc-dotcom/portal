from pathlib import Path
import json

p=Path('tournament.html')
s=p.read_text(encoding='utf-8')

s=s.replace('var _gameAdjustDates = [];\nvar _activeDateMeta = {', 'var _gameAdjustDates = [];\nvar _gameAdjustRaw = null;\nvar _activeDateMeta = {', 1)

anchor='''function applyTeamValues(teams){\n  if(!Array.isArray(teams)||!teams.length)return;'''
insert='''function gameAdjustArray(value){\n  if(Array.isArray(value))return value.filter(Boolean);\n  if(value&&typeof value===\"object\")return Object.keys(value).sort().map(function(key){return value[key];}).filter(Boolean);\n  return [];\n}\nfunction normalizedTournamentTeamName(name){\n  return String(name||\"\").normalize(\"NFKC\").replace(/[\\s　]+/g,\"\").toUpperCase();\n}\nfunction isYoshimiSmcTeam(name){\n  return normalizedTournamentTeamName(name)===\"吉見SMC\";\n}\nfunction isConfirmedGameAdjustStatus(status){\n  return status===\"OK\"||status===\"要項送付済\";\n}\nfunction confirmedGameAdjustTeamNames(dateId){\n  if(!_gameAdjustRaw||!dateId)return [];\n  var teams=gameAdjustArray(_gameAdjustRaw.teams),seen={};\n  return teams.filter(function(team){\n    return team&&isConfirmedGameAdjustStatus(((team.statuses||{})[dateId])||\"－\");\n  }).map(function(team){return String(team.name||\"\").trim();}).filter(function(name){\n    var key=normalizedTournamentTeamName(name);\n    if(!key||isYoshimiSmcTeam(name)||seen[key])return false;\n    seen[key]=true;return true;\n  });\n}\nfunction gameAdjustTournamentBlocks(dateId){\n  var confirmed=confirmedGameAdjustTeamNames(dateId);\n  if(!confirmed.length)return null;\n  var all=[\"吉見SMC\"].concat(confirmed).slice(0,16);\n  var currentCourts=Number(gv(\"t-courts\"))||2;\n  var useTwoCourts=all.length>8||(currentCourts===2&&all.length>=4);\n  if(!useTwoCourts)return [all];\n  var firstSize=Math.ceil(all.length/2);\n  return [all.slice(0,firstSize),all.slice(firstSize)];\n}\nfunction syncGameAdjustTeamsToTournament(dateId,options){\n  options=options||{};\n  if(TOURNAMENT_CONTEXT.saveId&&TOURNAMENT_CONTEXT.view===\"results\")return false;\n  var blocks=gameAdjustTournamentBlocks(dateId);\n  if(!blocks)return false;\n  applyTeamValues(blocks);\n  _lastTournamentSchedule=null;_scheduleUndo=null;\n  if(options.build!==false)buildTaisen(true);\n  return true;\n}\n\nfunction applyTeamValues(teams){\n  if(!Array.isArray(teams)||!teams.length)return;'''
if anchor not in s: raise SystemExit('applyTeamValues anchor not found')
s=s.replace(anchor,insert,1)

old='''  renderGuidelineEditors();\n  buildYoukou();\n  buildTaisen();\n  renderLinkedTournamentDates();'''
new='''  renderGuidelineEditors();\n  buildYoukou();\n  syncGameAdjustTeamsToTournament(_activeGameAdjustDateId,{build:false});\n  buildTaisen();\n  renderLinkedTournamentDates();'''
if old not in s: raise SystemExit('hydrate anchor not found')
s=s.replace(old,new,1)

old2='''  dbListen("game_adjust",function(value){\n    _gameAdjustDates=SMCEventLinks.fromGameAdjust(value);\n    updateTournamentCategories();\n    renderLinkedTournamentDates();\n  },"smc_game_adj_v1",null);'''
new2='''  dbListen("game_adjust",function(value){\n    _gameAdjustRaw=value&&typeof value===\"object\"?value:null;\n    _gameAdjustDates=SMCEventLinks.fromGameAdjust(value);\n    updateTournamentCategories();\n    renderLinkedTournamentDates();\n    if(_activeGameAdjustDateId)syncGameAdjustTeamsToTournament(_activeGameAdjustDateId,{build:true});\n  },"smc_game_adj_v1",null);'''
if old2 not in s: raise SystemExit('game adjust listener anchor not found')
s=s.replace(old2,new2,1)

s=s.replace('<meta name="app-version" content="20260830-4">','<meta name="app-version" content="20260830-5">',1)
p.write_text(s,encoding='utf-8')

# Version consistency
idx=Path('index.html'); t=idx.read_text(encoding='utf-8').replace('content="20260830-4"','content="20260830-5"',1); idx.write_text(t,encoding='utf-8')
sw=Path('sw.js'); t=sw.read_text(encoding='utf-8').replace('20260830-4','20260830-5'); sw.write_text(t,encoding='utf-8')
pkg=Path('package.json'); data=json.loads(pkg.read_text(encoding='utf-8')); data['version']='20260830.5.0';
if 'node scripts/tournament-game-adjust-sync.test.mjs' not in data['scripts']['test']:
    data['scripts']['test']=data['scripts']['test'].replace('node scripts/game-adjust-status.test.mjs','node scripts/game-adjust-status.test.mjs && node scripts/tournament-game-adjust-sync.test.mjs')
pkg.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

Path('scripts/tournament-game-adjust-sync.test.mjs').write_text('''import fs from "node:fs";\nconst html=fs.readFileSync("tournament.html","utf8");\nconst must=[\n  'var _gameAdjustRaw = null',\n  'status===\\"OK\\"||status===\\"要項送付済\\"',\n  'var all=[\\"吉見SMC\\"].concat(confirmed)',\n  'syncGameAdjustTeamsToTournament(_activeGameAdjustDateId,{build:false})',\n  '_gameAdjustRaw=value&&typeof value===\\"object\\"?value:null',\n  'if(_activeGameAdjustDateId)syncGameAdjustTeamsToTournament(_activeGameAdjustDateId,{build:true})',\n  'TOURNAMENT_CONTEXT.saveId&&TOURNAMENT_CONTEXT.view===\\"results\\"'\n];\nfor(const text of must){if(!html.includes(text)){throw new Error(`missing: ${text}`)}}\nconsole.log("tournament game-adjust sync: OK");\n''',encoding='utf-8')
