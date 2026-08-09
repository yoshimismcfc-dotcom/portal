/*
 * 吉見SMC 対戦順最適化エンジン
 * - ブラウザとNode.jsテストの両方から利用可能
 * - 入力配列を変更せず、同一入力では同一結果を返す
 */
(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.SMCTournamentScheduler=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  function cloneMatch(match,index){
    return {
      id:String(match.id!==undefined?match.id:index),
      home:String(match.home||""),
      away:String(match.away||""),
      fixed:!!match.fixed,
      originalIndex:Number.isFinite(match.originalIndex)?match.originalIndex:index
    };
  }

  function createRoundRobin(teams){
    var clean=(teams||[]).map(function(team){return String(team||"").trim();}).filter(Boolean);
    var matches=[];
    for(var i=0;i<clean.length;i++){
      for(var j=i+1;j<clean.length;j++){
        matches.push({id:i+"-"+j,home:clean[i],away:clean[j],fixed:false,originalIndex:matches.length});
      }
    }
    return matches;
  }

  function teamsOf(match){return [match.home,match.away];}

  function incrementalPenalty(match,slot,lastPlayed,playCounts){
    var penalty=0;
    teamsOf(match).forEach(function(team){
      if(lastPlayed[team]===slot-1)penalty+=10000;
      else if(lastPlayed[team]===slot-2)penalty+=300;
      penalty+=(playCounts[team]||0)*2;
    });
    // 同点時に元の順番へ近い安定した候補を優先する。
    penalty+=Math.abs(match.originalIndex-slot)*0.001;
    return penalty;
  }

  function optimize(matches,options){
    options=options||{};
    var source=(matches||[]).map(cloneMatch);
    if(source.length<2)return {matches:source,report:evaluate(source),changed:false};
    var width=Math.max(20,Math.min(Number(options.beamWidth)||240,600));
    var fixedSlots={};
    source.forEach(function(match,index){if(match.fixed)fixedSlots[index]=match.id;});
    var states=[{sequence:[],remaining:source,lastPlayed:{},playCounts:{},score:0}];

    for(var slot=0;slot<source.length;slot++){
      var next=[];
      states.forEach(function(state){
        var requiredId=fixedSlots[slot];
        state.remaining.forEach(function(match,index){
          if(requiredId&&match.id!==requiredId)return;
          // 後ろの固定枠で使う試合を先に消費しない。
          if(!requiredId&&match.fixed)return;
          var last=Object.assign({},state.lastPlayed);
          var counts=Object.assign({},state.playCounts);
          var add=incrementalPenalty(match,slot,last,counts);
          teamsOf(match).forEach(function(team){
            last[team]=slot;
            counts[team]=(counts[team]||0)+1;
          });
          next.push({
            sequence:state.sequence.concat([match]),
            remaining:state.remaining.slice(0,index).concat(state.remaining.slice(index+1)),
            lastPlayed:last,
            playCounts:counts,
            score:state.score+add
          });
        });
      });
      next.sort(function(a,b){
        if(a.score!==b.score)return a.score-b.score;
        return a.sequence.map(function(m){return m.id;}).join("|")
          .localeCompare(b.sequence.map(function(m){return m.id;}).join("|"),"ja");
      });
      states=next.slice(0,width);
      if(!states.length){
        return {matches:source,report:evaluate(source),changed:false,error:"固定した試合の条件を満たせません"};
      }
    }
    var best=states[0].sequence;
    var report=evaluate(best);
    return {
      matches:best,
      report:report,
      changed:best.some(function(match,index){return match.id!==source[index].id;})
    };
  }

  function evaluate(matches){
    var last={};
    var appearances={};
    var consecutive=[];
    (matches||[]).forEach(function(match,index){
      teamsOf(match).forEach(function(team){
        if(!appearances[team])appearances[team]=[];
        appearances[team].push(index);
        if(last[team]===index-1){
          consecutive.push({team:team,previousIndex:index-1,index:index});
        }
        last[team]=index;
      });
    });
    var teamRest={};
    Object.keys(appearances).forEach(function(team){
      var slots=appearances[team],rests=[];
      for(var i=1;i<slots.length;i++)rests.push(slots[i]-slots[i-1]-1);
      teamRest[team]={
        minimum:rests.length?Math.min.apply(null,rests):null,
        maximum:rests.length?Math.max.apply(null,rests):null
      };
    });
    return {
      consecutiveCount:consecutive.length,
      consecutive:consecutive,
      teamRest:teamRest,
      status:consecutive.length?"warning":"optimal"
    };
  }

  function validate(matches){
    var errors=[],seen={},slotTeams={};
    (matches||[]).forEach(function(match,index){
      if(!match.home||!match.away)errors.push("第"+(index+1)+"試合に未入力のチームがあります");
      if(match.home===match.away)errors.push("第"+(index+1)+"試合が同一チーム同士です");
      var key=[match.home,match.away].sort().join("\u0000");
      if(seen[key]!==undefined)errors.push("対戦カードが重複しています："+match.home+" 対 "+match.away);
      seen[key]=index;
      slotTeams[index]=[match.home,match.away];
    });
    return {valid:errors.length===0,errors:errors,slotTeams:slotTeams};
  }

  function validScore(value){
    if(value===""||value===null||value===undefined)return null;
    var number=Number(value);
    return Number.isInteger(number)&&number>=0?number:null;
  }

  function calculateStandings(teams,matches,results){
    var rows=(teams||[]).map(function(team,index){return {
      team:String(team||""),originalIndex:index,played:0,wins:0,draws:0,losses:0,
      goalsFor:0,goalsAgainst:0,goalDifference:0,points:0,headToHead:0,rank:0
    };});
    var byTeam={};rows.forEach(function(row){byTeam[row.team]=row;});
    var completed=[];
    (matches||[]).forEach(function(match){
      var result=results&&results[match.id];
      if(!result)return;
      var homeScore=validScore(result.homeScore),awayScore=validScore(result.awayScore);
      if(homeScore===null||awayScore===null||!byTeam[match.home]||!byTeam[match.away])return;
      var home=byTeam[match.home],away=byTeam[match.away];
      home.played++;away.played++;home.goalsFor+=homeScore;home.goalsAgainst+=awayScore;
      away.goalsFor+=awayScore;away.goalsAgainst+=homeScore;
      if(homeScore>awayScore){home.wins++;away.losses++;home.points+=3;}
      else if(homeScore<awayScore){away.wins++;home.losses++;away.points+=3;}
      else{home.draws++;away.draws++;home.points++;away.points++;}
      completed.push({home:match.home,away:match.away,homeScore:homeScore,awayScore:awayScore});
    });
    rows.forEach(function(row){row.goalDifference=row.goalsFor-row.goalsAgainst;});
    var tieGroups={};
    rows.forEach(function(row){
      var key=[row.points,row.goalDifference,row.goalsFor].join("|");
      if(!tieGroups[key])tieGroups[key]=[];tieGroups[key].push(row);
    });
    Object.keys(tieGroups).forEach(function(key){
      var group=tieGroups[key];if(group.length<2)return;
      var names={};group.forEach(function(row){names[row.team]=true;row.headToHead=0;});
      completed.forEach(function(match){
        if(!names[match.home]||!names[match.away])return;
        var home=byTeam[match.home],away=byTeam[match.away];
        if(match.homeScore>match.awayScore)home.headToHead+=3;
        else if(match.homeScore<match.awayScore)away.headToHead+=3;
        else{home.headToHead++;away.headToHead++;}
      });
    });
    rows.sort(function(a,b){
      return b.points-a.points||b.goalDifference-a.goalDifference||b.goalsFor-a.goalsFor||
        b.headToHead-a.headToHead||a.originalIndex-b.originalIndex;
    });
    rows.forEach(function(row,index){
      var previous=rows[index-1];
      var tied=previous&&row.points===previous.points&&row.goalDifference===previous.goalDifference&&
        row.goalsFor===previous.goalsFor&&row.headToHead===previous.headToHead;
      row.rank=tied?previous.rank:index+1;
    });
    return rows;
  }

  return {
    createRoundRobin:createRoundRobin,
    optimize:optimize,
    evaluate:evaluate,
    validate:validate,
    calculateStandings:calculateStandings
  };
});
