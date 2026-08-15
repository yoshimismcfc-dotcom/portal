import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "uniform.html"), "utf8");

for (const required of [
  ".stat-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))",
  ".stat-card .sl{font-size:clamp(.54rem,2.35vw,.7rem)",
  "white-space:nowrap",
]) {
  if (!source.includes(required)) throw new Error("在庫集計がスマートフォンで横1段になっていません: " + required);
}

const paletteAt = source.indexOf("var PALETTE=");
const syncAt = source.indexOf("startUniformSync();");
const renderAt = source.indexOf("function renderFolders()");
if (paletteAt < 0 || renderAt < 0 || syncAt < 0 || !(paletteAt < renderAt && renderAt < syncAt)) {
  throw new Error("ユニフォーム同期は色・一覧描画の定義後に開始してください");
}
if (!source.includes('data-label="氏名・状態"') || !source.includes("escapeHtml(displayName||'—')")) {
  throw new Error("貸出先の氏名を安全に一覧表示する処理がありません");
}
if (!source.includes('val.filter(function(item){return item&&typeof item==="object";})')) {
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
  "新規貸出は団員名簿から選択します。",
  "🏠 倉庫保管",
  "🗓 貸出予定",
  "選手に貸出中",
  "今すぐ貸し出す",
  "現在の貸出を返却",
  'entry.storageLocation="player"',
  'entry.storageLocation="warehouse"',
  "function uniformHolderName(item)"
]) {
  if (!source.includes(required)) throw new Error("保管状況の分かりやすい表示・自動判定が不足しています: " + required);
}
if (!source.includes("previousHolder!==holderName") || !source.includes("memberId:selectedMemberId".replace(":selectedMemberId","=selectedMemberId"))) {
  throw new Error("登録画面から貸出先を変更した履歴が保存されません");
}

for (const required of [
  'KR="smc_uniform_recovery_snapshot_v1"',
  "function captureDeviceUniformSnapshot()",
  "function missingDeviceUniforms()",
  "function restoreDeviceInventory()",
  'dbSave("uniform_backups/"+backupId',
  "function ensureUniformCloudReady()",
  'meta&&meta.authoritative',
  "_uniformPersistedSnapshot=cloneUniformItems(cloudUniforms)",
  "function writeUniformWithConflictCheck(next,expected)",
  'FIREBASE_DB.ref("uniform").transaction',
  "ほかの端末で在庫が更新されました。古いデータでの上書きを停止",
  "function ensureDailyUniformBackup(items)",
  'FIREBASE_DB.ref("uniform_backups/"+key).transaction',
  "function openUniformBackupCenter()",
  "function loadUniformBackups()",
  "function createManualUniformBackup()",
  "function restoreSelectedUniformBackup()",
  'id="modal-uniform-backup"',
  "🔐 管理者用・バックアップ",
  "復元前の現在データも自動保存されます",
  "安全バックアップを作成できなかったため、在庫の変更を中止しました",
  "現在のクラウド在庫へ追加しますか？",
  "現在の\"+loadU().length+\"着は削除・変更しません"
]) {
  if (!source.includes(required)) throw new Error("倉庫在庫の復元・自動バックアップ対策が不足しています: " + required);
}
for (const functionName of ["saveFolderColorChange","saveUni","deleteUni","confirmDel","doLend","doReturn"]) {
  const start = source.indexOf("function " + functionName + "(");
  if (start < 0 || !source.slice(start, start + 150).includes("ensureUniformCloudReady()")) {
    throw new Error(functionName + " はクラウド同期完了前の上書きを防止してください");
  }
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

for (const required of [
  'var UNIFORM_ILLUSTRATIONS={',
  '"緑":{src:"assets/uniform-goalkeeper-green.svg"',
  '"黄色":{src:"assets/uniform-goalkeeper-yellow.svg"',
  '"白":{src:"assets/uniform-white.svg"',
  '"オレンジ × 赤":{src:"assets/uniform-orange-red-stripes.svg"',
  '"オレンジ赤縦じま":{src:"assets/uniform-orange-red-stripes.svg"',
  '"オレンジ赤縦縞":{src:"assets/uniform-orange-red-stripes.svg"',
  '"白 × 黒":{src:"assets/uniform-white-black.svg"',
  '"白黒":{src:"assets/uniform-white-black.svg"',
  '"白 × 赤":{src:"assets/uniform-white-red.svg"',
  '"白赤":{src:"assets/uniform-white-red.svg"',
  '"白 × 青":{src:"assets/uniform-white-blue-collar.svg"',
  '"白青":{src:"assets/uniform-white-blue-collar.svg"',
  '"水色 × ピンク":{src:"assets/uniform-water-pink.svg"',
  '"水色ピンク":{src:"assets/uniform-water-pink.svg"',
  '"水色 × オレンジ":{src:"assets/uniform-water-orange.svg"',
  '"水色オレンジ":{src:"assets/uniform-water-orange.svg"',
  '"オレンジ × 紺":{src:"assets/uniform-orange-navy.svg"',
  '"オレンジ紺":{src:"assets/uniform-orange-navy.svg"',
  'class="cf-uniform-illustration"',
  '.cf-summary:has(.cf-uniform-illustration) .cf-name',
  'function uniformIllustrationFor(colorName)',
  'var illustration=uniformIllustrationFor(cname)',
  '/^オレンジ赤縦(?:じま|縞)(?:×赤)?$/.test(compact)',
  '/^白赤(?:×赤)?$/.test(compact)',
  '/^白青(?:×青)?$/.test(compact)',
  '+illustrationHtml'
]) {
  if (!source.includes(required)) throw new Error("色カードのユニフォームイラスト表示が不足しています: " + required);
}
if (!source.includes("靴下在庫・入力") || !source.includes("タップして追加・数量変更")) {
  throw new Error("靴下の入力場所を示す案内がありません");
}
if (!fs.existsSync(path.join(root, "assets", "uniform-water-pink.svg"))) {
  throw new Error("水色×ピンクのユニフォームイラストがありません");
}
if (!fs.existsSync(path.join(root, "assets", "uniform-orange-navy.svg"))) {
  throw new Error("オレンジ×紺のユニフォームイラストがありません");
}
if (!fs.existsSync(path.join(root, "assets", "uniform-water-orange.svg"))) {
  throw new Error("水色×オレンジのユニフォームイラストがありません");
}
if (!fs.existsSync(path.join(root, "assets", "uniform-orange-red-stripes.svg"))) {
  throw new Error("オレンジ×赤縦縞のユニフォームイラストがありません");
}
if (!fs.existsSync(path.join(root, "assets", "uniform-white-black.svg"))) {
  throw new Error("白×黒のユニフォームイラストがありません");
}
if (!fs.existsSync(path.join(root, "assets", "uniform-white-red.svg"))) {
  throw new Error("白×赤のユニフォームイラストがありません");
}
if (!fs.existsSync(path.join(root, "assets", "uniform-white-blue-collar.svg"))) {
  throw new Error("白×青の襟付きユニフォームイラストがありません");
}
if (!fs.existsSync(path.join(root, "assets", "uniform-white.svg"))) {
  throw new Error("白ユニフォームのイラストがありません");
}
if (!fs.existsSync(path.join(root, "assets", "uniform-goalkeeper-green.svg")) || !fs.existsSync(path.join(root, "assets", "uniform-goalkeeper-yellow.svg"))) {
  throw new Error("キーパー用ユニフォームのイラストがありません");
}

for (const required of [
  "背番号別（大会用）",
  'id="uniform-number-view"',
  'id="number-overview-list"',
  "function setUniformView(view)",
  "function renderNumberOverview()",
  "function showColorFromNumber(colorName)",
  "compareUniformNumberLabels",
  'class="number-overview-row"',
  'class="number-color-chip"',
  'class="number-color-free">倉庫 ',
  'class="number-color-lent">貸出 ',
  'data-color-name="',
  'renderStats();renderFolders();renderNumberOverview();renderPants();renderSocks();',
  'setConditionFilter(value){_conditionFilter=String(value||"");renderFolders();renderNumberOverview();}'
]) {
  if (!source.includes(required)) throw new Error("大会用の背番号別表示が不足しています: " + required);
}

for (const required of [
  "正・副ユニフォームの番号確認",
  'id="pair-primary-color"',
  'id="pair-secondary-color"',
  'id="pair-summary"',
  'id="pair-results"',
  "function availableUniformColorNames()",
  "function setPairColor(role,value)",
  "function renderPairComparison(filteredData)",
  'verdictText="使用可"',
  'verdictText="貸出確認"',
  'verdictText="不足"',
  'pair.primary.length&&pair.secondary.length',
  'primaryFree&&secondaryFree',
  'class="pair-side-count"',
  "倉庫 '+free",
  "貸出 '+lent",
  'renderPairComparison(data);'
]) {
  if (!source.includes(required)) throw new Error("正副2色の背番号比較が不足しています: " + required);
}

for (const required of [
  "パンツ在庫・入力",
  "タップして色・サイズ・在庫数を登録",
  'id="pants-section-body"',
  'id="pants-list"',
  'id="modal-pants"',
  'id="pants-main-name"',
  'id="pants-size"',
  'id="pants-quantity"',
  "function togglePantsSection(forceOpen)",
  "function renderPants()",
  "function buildPantsTemplates()",
  "function selectPantsTemplate(templateId)",
  "function openPantsAdd()",
  "function openPantsEdit(id)",
  "function savePants()",
  "function persistPants(items)",
  "function deletePants()",
  'dbSave("uniform_pants"',
  'dbListen("uniform_pants"',
  'KP="smc_uniform_pants_v1"',
  'entry.size=size;entry.quantity=quantity',
  'var saveRequest=persistPants(items);renderPants();',
  'result&&result.cloudSaved',
  "クラウドに保存しました。",
  "クラウドに保存できませんでした。",
  "パンツのサイズを入力してください",
  "同じ色・サイズのパンツはすでに登録されています",
  "サイズ '+escapeHtml(item.size||\"—\")+'　在庫 '",
  "パンツを色・サイズ別に管理します",
  'renderPants();renderSocks();',
  '"modal-pants"'
]) {
  if (!source.includes(required)) throw new Error("パンツの色・サイズ別在庫管理が不足しています: " + required);
}
if ((source.match(/function savePants\(/g) || []).length !== 1) {
  throw new Error("パンツの画面保存処理とクラウド保存処理は別の関数名にしてください");
}

for (const required of [
  "function goalkeeperSingleColor(mainName,subName)",
  "function normalizeGoalkeeperUniforms(items)",
  "function normalizeGoalkeeperTemplates(items)",
  'goalkeeperSingleColor(item.mainColorName||item.cname,item.subColorName)',
  'item.subColorName="";item.subColorCode=""',
  'item.memo=addGoalkeeperMemo(item.memo)',
  'if(meta&&meta.authoritative&&(goalkeeperMigration.changed||loanMigration.changed)&&!_uniformWriteInFlight)saveU(_unifData,"uniform_data_normalization")',
  'if(meta&&meta.authoritative&&goalkeeperTemplates.changed)dbSave("uniform_color_templates"',
  'class="cf-color-edit-button"',
  "function openFolderColorEdit(colorName)",
  "function saveFolderColorChange()",
  'id="modal-folder-color"',
  "この色に入っているすべての背番号を一括で変更します",
  '"緑":{src:"assets/uniform-goalkeeper-green.svg"',
  '"黄色":{src:"assets/uniform-goalkeeper-yellow.svg"'
]) {
  if (!source.includes(required)) throw new Error("キーパー色の単色化または帯からの色変更が不足しています: " + required);
}
if (!source.includes("setTimeout(function(){_templateLongPressed=true;setTemplateReorderMode(true);},600)")) {
  throw new Error("テンプレートの長押し判定がありません");
}
for (const required of [
  'id="folder-categories"',
  "function normalizeCategoryLabels(value)",
  "function categoryLabelsForFolder(colorName,items)",
  'class="cf-category-list" aria-label="使用カテゴリー"',
  'dbSave("uniform_color_categories"',
  'dbListen("uniform_color_categories"'
]) {
  if (!source.includes(required)) throw new Error("色帯の使用カテゴリー表示・保存が不足しています: " + required);
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
