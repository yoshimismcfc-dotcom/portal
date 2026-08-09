(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.SMCGuidelines=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  var SCHEMA_VERSION=2;
  var DEFAULT_META=[
    {id:"meta-date",standardKey:"date",title:"期日",content:"",inputType:"date",visible:true,type:"standard"},
    {id:"meta-place",standardKey:"place",title:"場所",content:"吉見ふれあい広場 天然芝グラウンド",inputType:"text",visible:true,type:"standard"},
    {id:"meta-reception",standardKey:"reception",title:"受付",content:"8:00より受付（参加費徴収）",inputType:"text",visible:true,type:"standard"},
    {id:"meta-host",standardKey:"host",title:"主催",content:"吉見SMC",inputType:"text",visible:true,type:"standard"}
  ];
  var DEFAULT_SECTIONS=[
    {id:"section-purpose",standardKey:"purpose",title:"目的",content:"試合を通して少年少女サッカーの普及を目指します。\nチーム間の友好と親善を図り、サッカーの楽しさを知ってもらいます。\n試合経験を通して、選手相互の技術向上を図ります。",visible:true,type:"standard"},
    {id:"section-category",standardKey:"category",title:"対象学年",content:"U9（3年生以下 ※4年生女子も参加可）",visible:true,type:"standard"},
    {id:"section-method",standardKey:"method",title:"試合方法",content:"8人制（最少6名）\n15分ハーフ（15-5-15分）\n暑熱時は、飲水タイムを設けます。",visible:true,type:"standard"},
    {id:"section-substitution",standardKey:"substitution",title:"選手交代",content:"自由（再出場可）\nできるだけ多くの選手が出場できるようご配慮ください。",visible:true,type:"standard"},
    {id:"section-rules",standardKey:"rules",title:"競技規則・ユニフォーム",content:"日本サッカー協会8人制競技規則に準じます。\n細かな運用は、当日の進行状況により主催者判断で調整します。\nユニフォームは正副いずれかを用意し、必要に応じてビブスで対応します。",visible:true,type:"standard"},
    {id:"section-ranking",standardKey:"ranking",title:"順位決定",content:"勝3点・分1点・負0点 → 勝点→得失点差→総得点→当該対戦→抽選",visible:true,type:"standard"},
    {id:"section-referee",standardKey:"referee",title:"審判",content:"当該チームで相談（1審・2審・3審）\n審判服の着用をお願いします。\n笛・時計などは各自でご準備ください。",visible:true,type:"standard"},
    {id:"section-ceremony",standardKey:"ceremony",title:"開会式・閉会式",content:"開会式は行いません。試合開始までに各チーム集合してください。\n全試合終了後、表彰を含む閉会式を行います。",visible:true,type:"standard"},
    {id:"section-fee",standardKey:"fee",title:"参加費",content:"1チーム5,000円（受付にて集金）",visible:true,type:"standard"},
    {id:"section-award",standardKey:"award",title:"表彰",content:"1〜3位にトロフィー\n優秀選手賞：各チーム1名",visible:true,type:"standard"},
    {id:"section-notes",standardKey:"notes",title:"注意事項",content:"代表者会議を受付後に行いますので、本部へお集まりください。\n熱中症・感染症には十分に注意してください。\n飲水は各チームで十分に準備し、選手の体調管理をお願いします。\n会場周辺は路上駐車禁止です。乗り合わせにご協力ください。\nゴミは各チームで持ち帰りをお願いします。",visible:true,type:"standard"},
    {id:"section-rain",standardKey:"rain",title:"雨天時",content:"当日AM6:00頃に実施可否を判断し、各チームへ連絡します。",visible:true,type:"standard"},
    {id:"section-contact",standardKey:"contact",title:"問い合わせ",content:"吉見SMC代表　片山孝俊\n090-3595-1970 / yoshimi.smc.fc@gmail.com",visible:true,type:"standard"}
  ];

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function text(value){return value===undefined||value===null?"":String(value);}
  function makeId(prefix){return (prefix||"item")+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);}
  function normalizeItem(item,index,prefix){
    item=item&&typeof item==="object"?item:{};
    return {
      id:text(item.id)||makeId(prefix),
      standardKey:text(item.standardKey),
      title:text(item.title),
      content:text(item.content),
      inputType:item.inputType==="date"?"date":"text",
      visible:item.visible!==false,
      type:item.type==="standard"?"standard":"custom",
      order:index,
      updatedAt:text(item.updatedAt)
    };
  }
  function normalizeList(list,prefix){
    return (Array.isArray(list)?list:[]).map(function(item,index){return normalizeItem(item,index,prefix);});
  }
  function lineJoin(){
    var values=Array.prototype.slice.call(arguments).map(text).map(function(value){return value.trim();}).filter(Boolean);
    return values.join("\n");
  }
  function legacy(data,key,fallback){
    return Object.prototype.hasOwnProperty.call(data||{},key)?text(data[key]):fallback;
  }
  function migrateLegacy(data){
    data=data&&typeof data==="object"?data:{};
    var meta=clone(DEFAULT_META),sections=clone(DEFAULT_SECTIONS);
    var metaValues={date:"y-date",place:"y-place",reception:"y-uketsuke",host:"y-host"};
    meta.forEach(function(item){item.content=legacy(data,metaValues[item.standardKey],item.content);});
    var byKey={};sections.forEach(function(item){byKey[item.standardKey]=item;});
    byKey.purpose.content=legacy(data,"y-purpose",byKey.purpose.content);
    byKey.category.content=legacy(data,"y-cat",byKey.category.content);
    byKey.method.content=lineJoin(legacy(data,"y-format",""),legacy(data,"y-time",""),legacy(data,"y-format-notes",""))||byKey.method.content;
    byKey.substitution.content=lineJoin(legacy(data,"y-sub",""),legacy(data,"y-sub-notes",""))||byKey.substitution.content;
    byKey.rules.content=legacy(data,"y-rules-extra",byKey.rules.content);
    byKey.ranking.content=legacy(data,"y-rank",byKey.ranking.content);
    byKey.referee.content=lineJoin(legacy(data,"y-ref",""),legacy(data,"y-ref-notes",""))||byKey.referee.content;
    byKey.ceremony.content=legacy(data,"y-ceremony",byKey.ceremony.content);
    byKey.fee.content=legacy(data,"y-fee",byKey.fee.content);
    byKey.award.content=legacy(data,"y-award",byKey.award.content);
    byKey.notes.content=lineJoin(legacy(data,"y-notes",""),legacy(data,"y-parking",""))||byKey.notes.content;
    byKey.rain.content=legacy(data,"y-rain",byKey.rain.content);
    byKey.contact.content=lineJoin(legacy(data,"y-rep",""),legacy(data,"y-contact",""))||byKey.contact.content;
    var oldLabels={purpose:"y-label-purpose",category:"y-label-category",method:"y-label-method",substitution:"y-label-sub",rules:"y-label-rules",ranking:"y-label-rank",referee:"y-label-ref",ceremony:"y-label-ceremony",fee:"y-label-fee",award:"y-label-award",notes:"y-label-notes",rain:"y-label-rain"};
    Object.keys(oldLabels).forEach(function(key){if(data[oldLabels[key]])byKey[key].title=text(data[oldLabels[key]]);});
    return {schemaVersion:SCHEMA_VERSION,meta:normalizeList(meta,"meta"),sections:normalizeList(sections,"section")};
  }
  function createState(saved,legacyData){
    if(saved&&Array.isArray(saved.meta)&&Array.isArray(saved.sections)){
      return {schemaVersion:SCHEMA_VERSION,meta:normalizeList(saved.meta,"meta"),sections:normalizeList(saved.sections,"section")};
    }
    return migrateLegacy(legacyData||{});
  }
  function defaults(){return createState({meta:clone(DEFAULT_META),sections:clone(DEFAULT_SECTIONS)});}
  function activeItems(list){
    return normalizeList(list,"item").filter(function(item){return item.visible&&item.title.trim()&&item.content.trim();});
  }
  function move(list,from,to){
    var copy=clone(Array.isArray(list)?list:[]);
    if(from<0||to<0||from>=copy.length||to>=copy.length||from===to)return normalizeList(copy,"item");
    var item=copy.splice(from,1)[0];copy.splice(to,0,item);return normalizeList(copy,"item");
  }
  function duplicate(list,index){
    var copy=clone(Array.isArray(list)?list:[]);if(index<0||index>=copy.length)return normalizeList(copy,"item");
    var item=clone(copy[index]);item.id=makeId(item.type==="standard"?"copy":"item");item.standardKey="";item.type="custom";item.title=(item.title||"項目")+"（コピー）";item.updatedAt=new Date().toISOString();copy.splice(index+1,0,item);return normalizeList(copy,"item");
  }
  function missingStandards(list,kind){
    var defaultsList=kind==="meta"?DEFAULT_META:DEFAULT_SECTIONS;
    var present={};(list||[]).forEach(function(item){if(item.standardKey)present[item.standardKey]=true;});
    return clone(defaultsList.filter(function(item){return !present[item.standardKey];}));
  }
  function restoreStandard(list,kind,standardKey){
    var source=(kind==="meta"?DEFAULT_META:DEFAULT_SECTIONS).find(function(item){return item.standardKey===standardKey;});
    var copy=clone(Array.isArray(list)?list:[]);if(source)copy.push(clone(source));return normalizeList(copy,kind);
  }
  return {
    SCHEMA_VERSION:SCHEMA_VERSION,
    DEFAULT_META:clone(DEFAULT_META),
    DEFAULT_SECTIONS:clone(DEFAULT_SECTIONS),
    clone:clone,
    makeId:makeId,
    normalizeList:normalizeList,
    migrateLegacy:migrateLegacy,
    createState:createState,
    defaults:defaults,
    activeItems:activeItems,
    move:move,
    duplicate:duplicate,
    missingStandards:missingStandards,
    restoreStandard:restoreStandard
  };
});
