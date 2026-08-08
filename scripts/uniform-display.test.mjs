import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "uniform.html"), "utf8");

const paletteAt = source.indexOf("var PALETTE=");
const syncAt = source.indexOf("startUniformSync();");
const renderAt = source.indexOf("function renderFolders()");
if (paletteAt < 0 || renderAt < 0 || syncAt < 0 || !(paletteAt < renderAt && renderAt < syncAt)) {
  throw new Error("ユニフォーム同期は色・一覧描画の定義後に開始してください");
}
if (!source.includes('data-label="氏名・状態"') || !source.includes("escapeHtml(u.lentTo||u.player||'—')")) {
  throw new Error("貸出先の氏名を安全に一覧表示する処理がありません");
}
if (!source.includes('val.filter(function(item){return item && typeof item==="object";})')) {
  throw new Error("Firebase配列内の空要素を除外する処理がありません");
}

if (!source.includes("function availableSingleColors()") || !source.includes('list="uniform-color-options"')) {
  throw new Error("任意カラーを入力・再利用する処理がありません");
}
if (!source.includes('if(!mainColorName){alert("メインカラーを入力してください")')) {
  throw new Error("メインカラーの未入力チェックがありません");
}

if (!source.includes("function exportUniformCSV()") || !source.includes("function uniformCsvCell(value)")) {
  throw new Error("ユニフォームCSV出力処理がありません");
}
if (!source.includes('["背番号","選手名","サイズ","ユニフォーム状態","メインカラー","メイン表示色","サブカラー","サブ表示色","保管・貸出状況","貸出先","貸出日","返却予定日","備考"]')) {
  throw new Error("ユニフォームCSVに必要な列が揃っていません");
}
if (!source.includes('if(/^[=+\\-@\\t\\r]/.test(text))')) {
  throw new Error("CSV数式インジェクション対策がありません");
}

for (const required of [
  "メインカラー（必須）",
  "サブカラー（任意）",
  "mainColorName:mainColorName",
  "subColorName:subColorName",
  'u.mainColorName||u.cname||""',
  'u.mainColorCode||u.ccode',
  '"メインカラー","メイン表示色","サブカラー","サブ表示色"'
]) {
  if (!source.includes(required)) throw new Error("メイン・サブカラー対応が不足しています: " + required);
}
if (!source.includes('subColorName?document.getElementById("u-sub-ccode").value:""')) {
  throw new Error("サブカラー未設定時の互換処理がありません");
}

for (const required of [
  "組み合わせテンプレート",
  'id="uniform-pair-templates"',
  "function buildPairTemplates()",
  "function selectPairTemplate(templateId)",
  'class="template-color-name',
  'p.mainName+(p.subName?" × "+p.subName:"")',
  '"オレンジ赤縦じま":["オレンジ","赤"]',
  '"水色ピンク":["水色","ピンク"]'
]) {
  if (!source.includes(required)) throw new Error("カラーテンプレートの復元が不足しています: " + required);
}

for (const required of [
  "団員名（貸出先）",
  "名前を入力すると「選手に貸出中」、空欄にすると「倉庫保管」",
  "🏠 倉庫保管",
  "選手に貸出中",
  "貸出する",
  "返却する",
  'entry.storageLocation="player"',
  'entry.storageLocation="warehouse"',
  "u.lentTo||u.player||"
]) {
  if (!source.includes(required)) throw new Error("保管状況の分かりやすい表示・自動判定が不足しています: " + required);
}
if (!source.includes("previousHolder!==holderName")) {
  throw new Error("登録画面から貸出先を変更した履歴が保存されません");
}

for (const required of [
  'data-label="背番号"',
  'data-label="氏名・状態"',
  'data-label="状況"',
  'class="status-action is-lent"',
  'class="status-action is-free"',
  'class="edit-icon-btn"',
  ".uni-table{font-size:.74rem}",
  "function openAddForColor(colorLabel,mainName,mainCode,subName,subCode)",
  "「＋追加」からユニフォームを登録できます",
  "色の部分をタップすると、背番号順の一覧を開閉できます",
  'class="cf-summary"',
  'class="cf-add-button"',
  'aria-expanded="false"',
  'class="cf-body" id="',
  'id="fl\'+bodyId+\'">一覧を見る',
  'label.textContent=o?"一覧を見る":"一覧を閉じる"',
  'class="cf-open-hint"',
  'class="cf-add-icon"',
  'class="cf-add-label">この色に追加',
  'classList.add("direct-color")',
  'classList.remove("direct-color")',
  'classList.add("edit-mode")',
  '.uniform-color-section.edit-mode>#uniform-pair-templates',
  'class="custom-color-note template-selection-note"',
  "＋ メイン・サブカラーを選んで追加",
  "function openAddWithColorPicker()",
  "function useCurrentColorsForUniform()",
  "function startCustomColorEntry(role)",
  "＋ 一覧にない色",
  "カラー名（自由入力可）",
  '{name:"グレー",code:"#7b8794"}',
  "この色でユニフォームを登録",
  "備考（特徴・用途）",
  "キーパー用",
  "function setFolderReorderMode(force)",
  "function moveColorFolder(name,delta)",
  'dbSave("uniform_folder_order"',
  'dbListen("uniform_folder_order"',
  "組み合わせテンプレートから選ぶ",
  "＋ テンプレートに色を追加",
  "テンプレートにも追加",
  "function toggleTemplateColorEditor(forceOpen)",
  "function setUniformDetailsReady(ready,colorLabel)",
  "function updateUniformNumberGuide(colorLabel)",
  "この色の登録済み背番号",
  'id="u-duplicate-warning"',
  'oninput="updateDuplicateNumberWarning()"',
  "function findDuplicateUniforms(num,colorName,id)",
  "function updateDuplicateNumberWarning()",
  "同じ番号のまま保存できます",
  "var duplicateItems=findDuplicateUniforms(num,colorName,id)",
  "prepareNextUniformEntry(colorName,num,duplicateItems.length)",
  'uniformColorLabel(item)===colorName',
  "var items=cg.items.slice().sort",
  "Number(a.num)-Number(b.num)",
  'var hdrGrad="linear-gradient(90deg,"',
  'sampleMainCode+" 75%,"',
  'bandSubColor+" 75%,"',
  "var hasSubColor=!!sampleSubName||!!presetPair[1]",
  "return hexLightness(p.c1)>150",
  ".cf-stats{display:flex;gap:8px",
  "background:rgba(5,15,30,.82)",
  ".cf-total{color:#fff",
  "最初に色の組み合わせを選んでください",
  "背番号・サイズ・団員名を入力してください",
  'id="u-save-btn"',
  'id="u-save-close-btn"',
  "保存して次へ",
  "保存して終了",
  "function prepareNextUniformEntry(colorLabel,savedNumber,duplicateCount)",
  'message.classList.add("show")',
  'document.getElementById("u-num").value=""',
  'document.getElementById("u-player").value=""',
  "updateUniformNumberGuide(colorLabel)",
  "if(closeAfter||editing){closeM(\"modal-add\");return;}",
  "prepareNextUniformEntry(colorName,num,duplicateItems.length)",
  "長押しすると順番を変更できます",
  "function addCurrentPairTemplate()",
  "function wireTemplateLongPress()",
  "function movePairTemplate(index,delta)",
  'dbSave("uniform_color_templates"',
  'dbListen("uniform_color_templates"'
]) {
  if (!source.includes(required)) throw new Error("スマホ縦表示または共有テンプレート管理が不足しています: " + required);
}

for (const required of [
  'id="uniform-condition-filter"',
  'id="condition-filter-count"',
  'id="u-condition"',
  "var UNIFORM_CONDITIONS=[",
  '{id:"unused",label:"未使用"',
  '{id:"like_new",label:"未使用に近い"',
  '{id:"good",label:"目立った傷や汚れなし"',
  '{id:"fair",label:"やや傷や汚れあり"',
  '{id:"damaged",label:"傷や汚れあり"',
  '{id:"poor",label:"全体的に状態が悪い"',
  "function conditionBadge(value)",
  "function setConditionFilter(value)",
  'if(_conditionFilter==="__unset")return !condition',
  'condition:condition',
  'alert("ユニフォームの状態を選択してください")',
  'conditionLabel(u.condition)',
  'class="condition-badge condition-unset"'
]) {
  if (!source.includes(required)) throw new Error("ユニフォーム状態の登録・表示・絞り込みが不足しています: " + required);
}

for (const required of [
  "靴下在庫",
  'id="socks-section-body"',
  'id="sock-list"',
  'id="modal-sock"',
  'id="sock-quantity"',
  "function toggleSocksSection(forceOpen)",
  "function renderSocks()",
  "function buildSockTemplates()",
  "function selectSockTemplate(templateId)",
  "function openSockAdd()",
  "function openSockEdit(id)",
  "function saveSock()",
  "function deleteSock()",
  'dbSave("uniform_socks"',
  'dbListen("uniform_socks"',
  'KS="smc_uniform_socks_v1"',
  'entry.quantity=quantity',
  '在庫数を0以上の整数で入力してください',
  '左右1組を「1足」',
  'main+" 75%,"+sub+" 75%,',
  '色ごとの在庫数だけを管理します'
]) {
  if (!source.includes(required)) throw new Error("靴下の色別在庫管理が不足しています: " + required);
}
if (!source.includes("setTimeout(function(){_templateLongPressed=true;setTemplateReorderMode(true);},600)")) {
  throw new Error("テンプレートの長押し判定がありません");
}
if (!(source.indexOf('id="color-folders"') < source.indexOf("＋ メイン・サブカラーを選んで追加"))) {
  throw new Error("補助操作ボタンは色一覧より下に配置してください");
}
if (source.includes("①") || source.includes("②")) {
  throw new Error("追加画面に分かりづらい手順番号を表示しないでください");
}

for (const required of [
  'id="main-color-options"',
  'id="sub-color-options"',
  "登録済みの色から選択",
  "function buildSingleColorPalettes()",
  "function chooseSharedColor(role,name,code)",
  "loadColorTemplates().forEach(function(template)",
  'toLocaleLowerCase("ja")'
]) {
  if (!source.includes(required)) throw new Error("全員の登録済みカラーを共有・重複排除する処理が不足しています: " + required);
}

console.log("uniform display tests passed");
