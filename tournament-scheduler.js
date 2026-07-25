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

  return {
    createRoundRobin:createRoundRobin,
    optimize:optimize,
    evaluate:evaluate,
    validate:validate
  };
});
