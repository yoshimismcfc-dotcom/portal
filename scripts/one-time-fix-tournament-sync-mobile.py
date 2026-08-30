from pathlib import Path
import re

root=Path('.')
html_path=root/'tournament.html'
text=html_path.read_text(encoding='utf-8')

old='''function isConfirmedGameAdjustStatus(status){\n  return status==="OK"||status==="要項送付済";\n}\nfunction confirmedGameAdjustTeamNames(dateId){\n  if(!_gameAdjustRaw||!dateId)return [];\n  var teams=gameAdjustArray(_gameAdjustRaw.teams),seen={};\n  return teams.filter(function(team){\n    return team&&isConfirmedGameAdjustStatus(((team.statuses||{})[dateId])||"－");\n  }).map(function(team){return String(team.name||"").trim();}).filter(function(name){\n    var key=normalizedTournamentTeamName(name);\n    if(!key||isYoshimiSmcTeam(name)||seen[key])return false;\n    seen[key]=true;return true;\n  });\n}\nfunction gameAdjustTournamentBlocks(dateId){\n  var confirmed=confirmedGameAdjustTeamNames(dateId);\n  if(!confirmed.length)return null;\n  var all=["吉見SMC"].concat(confirmed).slice(0,16);\n  var currentCourts=Number(gv("t-courts"))||2;\n  var useTwoCourts=all.length>8||(currentCourts===2&&all.length>=4);\n  if(!useTwoCourts)return [all];\n  var firstSize=Math.ceil(all.length/2);\n  return [all.slice(0,firstSize),all.slice(firstSize)];\n}\n'''
new='''function isConfirmedGameAdjustStatus(status){\n  var normalized=String(status||"").normalize("NFKC").replace(/[\\s　]+/g,"");\n  return normalized==="OK"||normalized==="要項送付済"||normalized==="要綱送付済";\n}\nfunction resolveGameAdjustDate(dateId){\n  var dates=gameAdjustArray(_gameAdjustRaw&&_gameAdjustRaw.dates);\n  if(!dates.length)return null;\n  var exact=dates.find(function(date){return String(date&&date.id||"")===String(dateId||"");});\n  if(exact)return exact;\n  var targetIso=String(_activeDateMeta.dateIso||TOURNAMENT_CONTEXT.dateIso||gv("t-date")||"").trim();\n  var targetLabel=String(_activeDateMeta.dateLabel||TOURNAMENT_CONTEXT.dateLabel||"").trim();\n  var targetName=normalizedTournamentTeamName(_activeDateMeta.name||TOURNAMENT_CONTEXT.name||gv("t-title")||"");\n  var targetCategory=normalizedTournamentTeamName(_activeDateMeta.category||TOURNAMENT_CONTEXT.category||"");\n  return dates.find(function(date){\n    if(!date)return false;\n    if(targetIso&&String(date.dateIso||"").trim()===targetIso)return true;\n    if(targetLabel&&String(date.label||"").trim()===targetLabel)return true;\n    var sameName=targetName&&normalizedTournamentTeamName(date.tournamentName||"")===targetName;\n    var sameCategory=!targetCategory||normalizedTournamentTeamName(date.cat||"")===targetCategory;\n    return !!(sameName&&sameCategory);\n  })||null;\n}\nfunction confirmedGameAdjustTeamNames(dateId){\n  if(!_gameAdjustRaw)return [];\n  var resolvedDate=resolveGameAdjustDate(dateId);\n  var statusDateId=String(resolvedDate&&resolvedDate.id||dateId||"");\n  if(!statusDateId)return [];\n  var teams=gameAdjustArray(_gameAdjustRaw.teams),seen={};\n  return teams.filter(function(team){\n    return team&&isConfirmedGameAdjustStatus(((team.statuses||{})[statusDateId])||"－");\n  }).map(function(team){return String(team.name||"").trim();}).filter(function(name){\n    var key=normalizedTournamentTeamName(name);\n    if(!key||isYoshimiSmcTeam(name)||seen[key])return false;\n    seen[key]=true;return true;\n  });\n}\nfunction gameAdjustTournamentBlocks(dateId){\n  var confirmed=confirmedGameAdjustTeamNames(dateId);\n  var all=["吉見SMC"].concat(confirmed).slice(0,16);\n  if(all.length<2)return null;\n  var selectedDate=resolveGameAdjustDate(dateId);\n  var target=Number(selectedDate&&selectedDate.target)||0;\n  var expectedTotal=target>0?target+1:all.length;\n  var currentCourts=Number(gv("t-courts"))||1;\n  var useTwoCourts=all.length>8||(currentCourts===2&&expectedTotal>=5);\n  if(!useTwoCourts)return [all];\n  var firstSize=Math.ceil(all.length/2);\n  var first=all.slice(0,firstSize),second=all.slice(firstSize);\n  if(second.length<2)return [all];\n  return [first,second];\n}\n'''
if old not in text:
    raise SystemExit('sync block anchor not found')
text=text.replace(old,new,1)

# Replace game-adjust listener normalization so object-shaped Firebase arrays work everywhere.
old2='''    _gameAdjustRaw=value&&typeof value==="object"?value:null;\n    _gameAdjustDates=SMCEventLinks.fromGameAdjust(value);\n'''
new2='''    _gameAdjustRaw=value&&typeof value==="object"?value:null;\n    var normalizedGameAdjust=value&&typeof value==="object"?Object.assign({},value,{dates:gameAdjustArray(value.dates),teams:gameAdjustArray(value.teams)}):value;\n    _gameAdjustDates=SMCEventLinks.fromGameAdjust(normalizedGameAdjust);\n'''
if old2 not in text:
    raise SystemExit('listener anchor not found')
text=text.replace(old2,new2,1)

# Add a clear sync hint in team setting, and robust mobile width containment.
style_anchor='''    @media(max-width:520px){\n      .schedule-actions{grid-template-columns:1fr}\n'''
style_insert='''    .game-adjust-team-sync-note{display:none;margin:0 0 10px;padding:9px 11px;border:1px solid rgba(0,212,255,.36);border-radius:10px;background:rgba(0,160,220,.08);color:#9cecff;font-size:.72rem;font-weight:800;line-height:1.55}\n    .game-adjust-team-sync-note.show{display:block}\n    @media(max-width:520px){\n      #doc-taisen,#doc-taisen>.panel,#team-inputs,#team-inputs>div,.ceremony-settings,.ceremony-row,.ceremony-detail,.form-group{min-width:0;max-width:100%;box-sizing:border-box}\n      #doc-taisen .form-control,#team-inputs input,#team-inputs select,.ceremony-row input,.ceremony-row select{width:100%;max-width:100%;min-width:0;box-sizing:border-box}\n      #team-inputs [id^="names-"]{grid-template-columns:minmax(0,1fr)!important;gap:9px!important}\n      .ceremony-detail{grid-template-columns:minmax(0,1fr)!important}\n      .ceremony-row{overflow:hidden}\n      .panel{overflow-x:hidden}\n      .schedule-actions{grid-template-columns:1fr}\n'''
if style_anchor not in text:
    raise SystemExit('mobile style anchor not found')
text=text.replace(style_anchor,style_insert,1)

# Add status note helper near sync function.
sync_anchor='''function syncGameAdjustTeamsToTournament(dateId,options){\n  options=options||{};\n  if(TOURNAMENT_CONTEXT.saveId&&TOURNAMENT_CONTEXT.view==="results")return false;\n  var blocks=gameAdjustTournamentBlocks(dateId);\n  if(!blocks)return false;\n  applyTeamValues(blocks);\n  _lastTournamentSchedule=null;_scheduleUndo=null;\n  if(options.build!==false)buildTaisen(true);\n  return true;\n}\n'''
sync_new='''function setGameAdjustTeamSyncNote(blocks){\n  var note=document.getElementById("game-adjust-team-sync-note");if(!note)return;\n  if(!blocks||!blocks.length){note.classList.remove("show");note.textContent="";return;}\n  var count=[].concat.apply([],blocks).length;\n  note.textContent="🔗 試合調整から参加確定チームを自動反映しました（吉見SMCを含む "+count+"チーム）";\n  note.classList.add("show");\n}\nfunction syncGameAdjustTeamsToTournament(dateId,options){\n  options=options||{};\n  if(TOURNAMENT_CONTEXT.saveId&&TOURNAMENT_CONTEXT.view==="results")return false;\n  var blocks=gameAdjustTournamentBlocks(dateId);\n  if(!blocks){setGameAdjustTeamSyncNote(null);return false;}\n  applyTeamValues(blocks);\n  setGameAdjustTeamSyncNote(blocks);\n  _lastTournamentSchedule=null;_scheduleUndo=null;\n  if(options.build!==false)buildTaisen(true);\n  return true;\n}\n'''
if sync_anchor not in text:
    raise SystemExit('sync function anchor not found')
text=text.replace(sync_anchor,sync_new,1)

# Inject note above team-inputs if a stable anchor is available.
team_anchor='<div id="team-inputs"></div>'
if team_anchor not in text:
    raise SystemExit('team inputs anchor not found')
text=text.replace(team_anchor,'<div class="game-adjust-team-sync-note" id="game-adjust-team-sync-note" role="status" aria-live="polite"></div>\n      '+team_anchor,1)

# Version bump
text=text.replace('content="20260830-5"','content="20260830-6"')
html_path.write_text(text,encoding='utf-8')

for path in ['index.html','sw.js','package.json']:
    p=root/path
    s=p.read_text(encoding='utf-8')
    if path=='index.html': s=s.replace('content="20260830-5"','content="20260830-6"')
    elif path=='sw.js': s=s.replace('APP_VERSION = "20260830-5"','APP_VERSION = "20260830-6"')
    else: s=s.replace('"version": "20260830.5.0"','"version": "20260830.6.0"')
    p.write_text(s,encoding='utf-8')

# Add test assertions to existing UI test.
test=root/'scripts/tournament-result-ui.test.mjs'
ts=test.read_text(encoding='utf-8')
extra='''\nfor(const required of [\n  "function resolveGameAdjustDate(dateId)",\n  'normalized==="要綱送付済"',\n  'normalized==="要項送付済"',\n  'var all=["吉見SMC"].concat(confirmed)',\n  "game-adjust-team-sync-note",\n  '#team-inputs [id^="names-"]{grid-template-columns:minmax(0,1fr)!important',\n  '.ceremony-detail{grid-template-columns:minmax(0,1fr)!important'\n]) assert.ok(html.includes(required),"試合調整連携またはスマホ幅対策が不足しています: "+required);\n'''
if 'function resolveGameAdjustDate(dateId)' not in ts:
    ts += extra
test.write_text(ts,encoding='utf-8')
