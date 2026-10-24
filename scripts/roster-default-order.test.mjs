import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {gradeRank,compareGradeAndName,orderedParticipants} from '../camp/participant-order.mjs';

function rosterContext(){
 const source=readFileSync(new URL('../members.html',import.meta.url),'utf8');
 const context={console,Intl,Number,Date,JSON,document:{getElementById(){return {style:{},innerHTML:'',classList:{add(){},remove(){}},addEventListener(){}};},addEventListener(){}},window:{addEventListener(){}},alert(){},onFirebaseReady(){}};
 vm.createContext(context);
 const script=[...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
 assert.ok(script,'団員名簿のJavaScriptが見つかりません');
 vm.runInContext(script,context);
 return {context,source};
}

test('団員名簿は高学年から・学年内はふりがな優先の名前順、order値やFirebaseは変更しない',()=>{
 const {context,source}=rosterContext();
 const records={
  a:{name:'斉藤',kana:'さいとう',grade:'6年',order:0},
  b:{name:'安藤',kana:'あんどう',grade:'6年',order:99},
  c:{name:'小川',kana:'おがわ',grade:'6年',order:1},
  d:{name:'渡辺',kana:'わたなべ',grade:'5年',order:0},
  e:{name:'池田',kana:'いけだ',grade:'5年',order:9},
  f:{name:'年長児',kana:'ねんちょうじ',grade:'年長',order:0}
 };
 let displayed=context.recordsToGrid(records);
 assert.deepEqual(Array.from(displayed['6年'],m=>m.name),['安藤','小川','斉藤']);
 assert.deepEqual(Array.from(displayed['5年'],m=>m.name),['池田','渡辺']);
 assert.deepEqual(Array.from(context.GRADES),['6年','5年','4年','3年','2年','1年','年長']);
 assert.equal(records.b.order,99);
 assert.match(source,/学年・名前順/);
 // A new Firebase child arrives; the next value-render rebuild must insert it in name order.
 records.g={name:'上田',kana:'うえだ',grade:'6年',order:1000};
 displayed=context.recordsToGrid(records);
 assert.deepEqual(Array.from(displayed['6年'],m=>m.name),['安藤','上田','小川','斉藤']);
 context.data=displayed;
 assert.deepEqual(Array.from(context.mobileMembersForGrade('6年'),m=>m.member.name),['安藤','上田','小川','斉藤']);
 assert.match(source,/data=recordsToGrid\(value\);\s*gradeSortState=\{\};\s*render\(\)/);
});

test('ふりがな未登録は氏名で並べ、同じ名前の並びはIDで安定化',()=>{
 const {context}=rosterContext();
 const rows=context.recordsToGrid({
  zz:{name:'やまだ',grade:'4年'},
  ab:{name:'あおき',grade:'4年'},
  c2:{name:'かとう',grade:'4年'},
  c1:{name:'かとう',grade:'4年'}
 });
 assert.deepEqual(Array.from(rows['4年'],m=>m.name),['あおき','かとう','かとう','やまだ']);
 assert.deepEqual(Array.from(rows['4年'].filter(m=>m.name==='かとう'),m=>m.id),['c1','c2']);
});

test('合宿名簿は6年から年長・不明の順、同学年内は日本語の名前順、元データは不変',()=>{
 const rows=[
  {id:'p4',name:'山田',grade:'4年'},
  {id:'p6b',name:'上田',kana:'うえだ',grade:'小学校６年生'},
  {id:'p6a',name:'青木',kana:'あおき',grade:'6年'},
  {id:'p1',name:'池田',grade:'1年生'},
  {id:'pc',name:'コーチ',grade:''},
  {id:'pk',name:'年長児',grade:'年長'},
  {id:'p5',name:'渡辺',grade:'５年'}
 ];
 const snapshot=JSON.stringify(rows),sorted=orderedParticipants(rows);
 assert.deepEqual(sorted.map(x=>x.id),['p6a','p6b','p5','p4','p1','pk','pc']);
 assert.equal(JSON.stringify(rows),snapshot);
 assert.equal(gradeRank('小学 ６ 年生'),6);
 assert.equal(gradeRank('学年未設定'),-100);
 assert.ok(compareGradeAndName({name:'秋山',kana:'あきやま',grade:'5年'},{name:'佐藤',kana:'さとう',grade:'5年'})<0);
});

test('合宿画面の直接一覧は説明ボックスを除去、障害時だけエラーを表示',()=>{
 const source=readFileSync(new URL('../camp/free-app.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/☁️ クラウドの合宿一覧|クラウドから合宿.*件を取得しました。ログイン/);
 assert.match(source,/if\(error\)\{const state=el\('section'/);
 assert.match(source,/all=sortedCampParticipants\(camp.participants\)/);
 assert.match(source,/\.sort\(compareCampParticipants\)/);
 assert.match(source,/const people=\(\)=>sortedCampParticipants\(camp.participants\)/);
 assert.match(source,/rows=entries\(snap.val\(\)\).*\.sort\(\(a,b\)=>compareGradeAndName/);
 assert.match(source,/rosterReadingsById=byId;rosterReadingsByName=byName/);
});
