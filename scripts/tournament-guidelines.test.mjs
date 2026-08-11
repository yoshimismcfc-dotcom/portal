import assert from "node:assert/strict";
import {createRequire} from "node:module";
import fs from "node:fs";

const require=createRequire(import.meta.url);
const G=require("../tournament-guidelines.js");
const source=fs.readFileSync(new URL("../tournament.html",import.meta.url),"utf8");

const defaults=G.defaults();
assert.equal(defaults.meta.length,4,"基本情報の標準4項目がある");
assert.equal(defaults.sections.length,13,"本文の標準13項目がある");
assert.equal(new Set([...defaults.meta,...defaults.sections].map(item=>item.id)).size,17,"標準IDが重複しない");

const edited=G.clone(defaults);
edited.sections[0].title="大会のねらい";
edited.sections[1].visible=false;
edited.sections[2].content="";
assert.deepEqual(G.activeItems(edited.sections).slice(0,2).map(item=>item.standardKey),["purpose","substitution"],"非表示と空欄は出力対象外");

const originalIds=edited.sections.map(item=>item.id);
const moved=G.move(edited.sections,0,3);
assert.equal(moved[3].id,originalIds[0],"並べ替えてもIDを維持する");
assert.deepEqual(moved.map(item=>item.order),moved.map((_,index)=>index),"順番を自動採番する");

const duplicated=G.duplicate(defaults.sections,0);
assert.equal(duplicated.length,defaults.sections.length+1,"項目を複製できる");
assert.notEqual(duplicated[1].id,duplicated[0].id,"複製時に一意IDを作る");
assert.equal(duplicated[1].type,"custom","複製項目は追加項目として扱う");
assert.equal(duplicated[1].standardKey,"","複製しても標準項目の復元判定を壊さない");

const withoutCeremony=defaults.sections.filter(item=>item.standardKey!=="ceremony");
assert.ok(G.missingStandards(withoutCeremony,"section").some(item=>item.standardKey==="ceremony"),"削除した標準項目を検出する");
const restored=G.restoreStandard(withoutCeremony,"section","ceremony");
assert.equal(restored.at(-1).standardKey,"ceremony","標準項目を復元できる");

const persisted=G.createState({meta:defaults.meta,sections:withoutCeremony});
assert.equal(persisted.sections.some(item=>item.standardKey==="ceremony"),false,"新形式で削除した標準項目を勝手に復活させない");

const legacy=G.createState(null,{
  "y-date":"2026-10-04",
  "y-place":"北小学校",
  "y-cat":"U10",
  "y-format":"8人制",
  "y-time":"15分ハーフ",
  "y-ceremony":"開会式のみ行います。",
  "y-label-purpose":"開催目的"
});
assert.equal(legacy.meta.find(item=>item.standardKey==="date").content,"2026-10-04","旧期日を移行する");
assert.equal(legacy.sections.find(item=>item.standardKey==="category").content,"U10","旧カテゴリーを移行する");
assert.equal(legacy.sections.find(item=>item.standardKey==="method").content,"8人制\n15分ハーフ","旧複数欄を本文へ統合する");
assert.equal(legacy.sections.find(item=>item.standardKey==="ceremony").content,"開会式のみ行います。","旧開閉会式を移行する");
assert.equal(legacy.sections.find(item=>item.standardKey==="purpose").title,"開催目的","旧項目名を移行する");

const custom={id:"custom-stable",title:"持ち物",content:"帽子\n飲み物",visible:true,type:"custom",order:99};
const normalized=G.normalizeList([...defaults.sections,custom],"section");
assert.equal(normalized.at(-1).id,"custom-stable","追加項目のIDを維持する");
assert.equal(normalized.at(-1).order,normalized.length-1,"追加項目も順番を正規化する");

assert.ok(source.includes("guideline-content-input guideline-meta-textarea") && source.includes("function autoResizeGuidelineTextarea(field)"),
  "受付などの基本情報を折り返し、自動で高さを広げてください");
assert.doesNotMatch(source, /kind==="meta"\)[\s\S]{0,180}type="text" data-guideline-field="content"/,
  "基本情報の長文を1行入力欄で隠さないでください");
assert.match(source, /\.req-info\{[^}]*table-layout:fixed/,
  "要項プレビューの基本情報表を用紙幅内に固定してください");
assert.match(source, /\.req-info th,\.req-info td\{[^}]*white-space:pre-wrap;overflow-wrap:anywhere/,
  "要項プレビューの基本情報を改行・折り返し表示してください");
assert.ok(source.includes("max-inline-size:100%!important") && source.includes("grid-template-columns:minmax(0,1fr)"),
  "iPhoneの日付入力と基本情報カードを横幅内に収めてください");

console.log("tournament-guidelines tests passed");
