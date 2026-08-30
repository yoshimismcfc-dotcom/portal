(function(global){
  "use strict";
  function text(value){return String(value==null?"":value);}
  function toArray(value){
    if(Array.isArray(value))return value.filter(Boolean);
    if(value&&typeof value==="object")return Object.keys(value).sort(function(a,b){return Number(a)-Number(b);}).map(function(key){return value[key];}).filter(Boolean);
    return [];
  }
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function linked(record,eventId,prefix){
    return !!record&&(text(record.gameAdjustDateId)===text(eventId)||text(record.id)===prefix+text(eventId));
  }
  function resultSetKey(eventId){return "date_"+encodeURIComponent(text(eventId)).replace(/\./g,"%2E");}
  function buildDeletePlan(snapshots,eventId){
    var id=text(eventId),game=clone(snapshots&&snapshots.gameAdjust)||{},dates=toArray(game.dates);
    var target=dates.find(function(date){return date&&text(date.id)===id;});
    if(!target)return {found:false,updates:{},backup:null};
    var teams=toArray(game.teams).map(function(team){
      var copy=clone(team)||{};
      if(copy.statuses&&typeof copy.statuses==="object")delete copy.statuses[id];
      return copy;
    });
    var duties=toArray(snapshots&&snapshots.duties),saves=clone(snapshots&&snapshots.tournamentSaves)||{};
    var results=clone(snapshots&&snapshots.tournamentResults)||{},accounting=clone(snapshots&&snapshots.accounting)||{};
    var tournaments=toArray(accounting.tournaments),saveKeys=Object.keys(saves).filter(function(key){return saves[key]&&text(saves[key].gameAdjustDateId)===id;});
    var dutyMatches=duties.filter(function(item){return linked(item,id,"ga_");});
    var accountingMatches=tournaments.filter(function(item){return linked(item,id,"accounting_game_");});
    var resultKey=resultSetKey(id),updates={};
    updates["game_adjust/dates"]=dates.filter(function(date){return !date||text(date.id)!==id;});
    updates["game_adjust/teams"]=teams;
    updates["game_adjust/備考/"+id]=null;
    var remainingDuties=duties.filter(function(item){return !linked(item,id,"ga_");});
    var remainingAccounting=tournaments.filter(function(item){return !linked(item,id,"accounting_game_");});
    if(remainingDuties.length!==duties.length)updates.duty_match=remainingDuties;
    if(remainingAccounting.length!==tournaments.length)updates["accounting/tournaments"]=remainingAccounting;
    saveKeys.forEach(function(key){updates["tournament_saves/"+key]=null;});
    if(results[resultKey])updates["tournament_match_results/"+resultKey]=null;
    return {
      found:true,
      updates:updates,
      backup:{
        format:"yoshimi-smc-tournament-backup-v1",exportedAt:new Date().toISOString(),eventId:id,
        tournament:clone(target),note:game["備考"]&&game["備考"][id]||"",
        teamStatuses:toArray(game.teams).map(function(team){return {id:team.id,name:team.name,status:team.statuses&&team.statuses[id]||"－"};}),
        dutyMatches:clone(dutyMatches),tournamentSaves:saveKeys.reduce(function(out,key){out[key]=clone(saves[key]);return out;},{}),
        tournamentResults:results[resultKey]?clone(results[resultKey]):null,accounting:clone(accountingMatches)
      },
      counts:{duties:dutyMatches.length,saves:saveKeys.length,accounting:accountingMatches.length,results:results[resultKey]?1:0}
    };
  }
  var api={toArray:toArray,resultSetKey:resultSetKey,buildDeletePlan:buildDeletePlan};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  global.SMCTournamentManagement=api;
})(typeof window!=="undefined"?window:globalThis);
