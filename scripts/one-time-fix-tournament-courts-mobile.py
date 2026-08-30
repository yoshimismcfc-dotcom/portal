from pathlib import Path

p=Path('tournament.html')
s=p.read_text()
old='''      #doc-taisen .form-control,#team-inputs input,#team-inputs select,.ceremony-row input,.ceremony-row select{width:100%;max-width:100%;min-width:0;box-sizing:border-box}\n      #team-inputs [id^="names-"]{grid-template-columns:minmax(0,1fr)!important;gap:9px!important}\n      .ceremony-detail{grid-template-columns:minmax(0,1fr)!important}\n      .ceremony-row{overflow:hidden}\n'''
new='''      #doc-taisen .form-control,#team-inputs input,#team-inputs select,.ceremony-row input:not([type="checkbox"]),.ceremony-row select{width:100%;max-width:100%;min-width:0;box-sizing:border-box}\n      #team-inputs [id^="names-"]{grid-template-columns:minmax(0,1fr)!important;gap:9px!important}\n      .ceremony-detail{grid-template-columns:minmax(0,1fr)!important}\n      .ceremony-row{overflow:hidden;min-width:0}\n      .ceremony-toggle{width:100%;min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere}\n      .ceremony-toggle input[type="checkbox"]{width:22px!important;min-width:22px!important;max-width:22px!important;height:22px!important;min-height:22px!important;flex:0 0 22px!important;margin:0!important}\n'''
assert old in s
s=s.replace(old,new,1)

old='''function gameAdjustTournamentBlocks(dateId){\n  var confirmed=confirmedGameAdjustTeamNames(dateId);\n  var all=["吉見SMC"].concat(confirmed).slice(0,16);\n  if(all.length<2)return null;\n  var selectedDate=resolveGameAdjustDate(dateId);\n  var target=Number(selectedDate&&selectedDate.target)||0;\n  var expectedTotal=target>0?target+1:all.length;\n  var currentCourts=Number(gv("t-courts"))||1;\n  var useTwoCourts=all.length>8||(currentCourts===2&&expectedTotal>=5);\n  if(!useTwoCourts)return [all];\n  var firstSize=Math.ceil(all.length/2);\n  var first=all.slice(0,firstSize),second=all.slice(firstSize);\n  if(second.length<2)return [all];\n  return [first,second];\n}\n'''
new='''function gameAdjustTournamentBlocks(dateId){\n  var confirmed=confirmedGameAdjustTeamNames(dateId);\n  var all=["吉見SMC"].concat(confirmed).slice(0,16);\n  var opponentCount=confirmed.length;\n  var currentCourts=Number(gv("t-courts"))||1;\n  // 吉見SMC以外が3チーム以下は1面、5チーム以上は2面。4チームだけは現在の面数設定を尊重する。\n  var useTwoCourts=opponentCount>=5||(opponentCount===4&&currentCourts===2);\n  if(!useTwoCourts)return [all];\n  var firstSize=Math.ceil(all.length/2);\n  var first=all.slice(0,firstSize),second=all.slice(firstSize);\n  if(second.length<2)return [all];\n  return [first,second];\n}\n'''
assert old in s
s=s.replace(old,new,1)

old='''function syncGameAdjustTeamsToTournament(dateId,options){\n  options=options||{};\n  if(TOURNAMENT_CONTEXT.saveId&&TOURNAMENT_CONTEXT.view==="results")return false;\n  var blocks=gameAdjustTournamentBlocks(dateId);\n  if(!blocks){setGameAdjustTeamSyncNote(null);return false;}\n  applyTeamValues(blocks);\n  setGameAdjustTeamSyncNote(blocks);\n  _lastTournamentSchedule=null;_scheduleUndo=null;\n  if(options.build!==false)buildTaisen(true);\n  return true;\n}\n'''
new='''function syncGameAdjustTeamsToTournament(dateId,options){\n  options=options||{};\n  if(TOURNAMENT_CONTEXT.saveId&&TOURNAMENT_CONTEXT.view==="results")return false;\n  var blocks=gameAdjustTournamentBlocks(dateId);\n  if(!blocks){setGameAdjustTeamSyncNote(null);return false;}\n  applyTeamValues(blocks);\n  setGameAdjustTeamSyncNote(blocks);\n  _lastTournamentSchedule=null;_scheduleUndo=null;\n  var namedCount=[].concat.apply([],blocks).filter(function(name){return String(name||"").trim();}).length;\n  if(options.build!==false&&namedCount>=2)buildTaisen(true);\n  else if(namedCount<2){var preview=document.getElementById("taisen-preview");if(preview)preview.innerHTML="";}\n  return true;\n}\n'''
assert old in s
s=s.replace(old,new,1)

old='''    if(countEl){\n      countEl.value=String(Math.min(Math.max(block.length,2),8));\n      updateNames(c);\n    }\n    block.forEach(function(value,index){\n      var el=document.getElementById("t-"+c+"-"+index);\n      if(el)el.value=value;\n    });\n'''
new='''    if(countEl){\n      countEl.value=String(Math.min(Math.max(block.length,2),8));\n      updateNames(c);\n      for(var clearIndex=0;clearIndex<Number(countEl.value);clearIndex++){\n        var clearEl=document.getElementById("t-"+c+"-"+clearIndex);\n        if(clearEl)clearEl.value="";\n      }\n    }\n    block.forEach(function(value,index){\n      var el=document.getElementById("t-"+c+"-"+index);\n      if(el)el.value=String(value||"").trim();\n    });\n'''
assert old in s
s=s.replace(old,new,1)

old='''      var el=document.getElementById("t-"+c+"-"+i);\n      teams.push(el&&el.value.trim()?el.value.trim():"チーム"+(i+1));\n'''
new='''      var el=document.getElementById("t-"+c+"-"+i);\n      var teamName=el?el.value.trim():"";\n      if(teamName)teams.push(teamName);\n'''
assert old in s
s=s.replace(old,new,1)

old='''    var matches=window.SMCTournamentScheduler\n      ? SMCTournamentScheduler.createRoundRobin(teams)\n      : [];\n    blocks.push({idx:c,label:courts===1?"":['''
new='''    if(teams.length<2){\n      alert((courts===1?"チーム一覧":(["Aブロック","Bブロック"][c]))+"に、チーム名が2チーム以上決まってから対戦表を作成してください。");\n      return false;\n    }\n    var matches=window.SMCTournamentScheduler\n      ? SMCTournamentScheduler.createRoundRobin(teams)\n      : [];\n    blocks.push({idx:c,label:courts===1?"":['''
assert old in s
s=s.replace(old,new,1)

s=s.replace('content="20260830-6"','content="20260830-7"',1)
p.write_text(s)

# versions
p=Path('index.html'); t=p.read_text().replace('content="20260830-6"','content="20260830-7"',1); p.write_text(t)
p=Path('sw.js'); t=p.read_text().replace('const APP_VERSION = "20260830-6";','const APP_VERSION = "20260830-7";',1); p.write_text(t)
p=Path('package.json'); t=p.read_text().replace('"version": "20260830.6.0"','"version": "20260830.7.0"',1); p.write_text(t)

# extend sync test
p=Path('scripts/tournament-game-adjust-sync.test.mjs'); t=p.read_text();
insert='''\nfor(const text of [\n  'opponentCount>=5||(opponentCount===4&&currentCourts===2)',\n  'if(!useTwoCourts)return [all]',\n  'if(teamName)teams.push(teamName)',\n  'if(clearEl)clearEl.value=""',\n  'namedCount>=2',\n  '.ceremony-toggle input[type="checkbox"]'\n]){if(!html.includes(text)){throw new Error(`missing new sync/mobile rule: ${text}`)}}\n'''
t=t.replace('console.log("tournament game-adjust sync: OK");',insert+'\nconsole.log("tournament game-adjust sync: OK");')
p.write_text(t)
