from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html_path = ROOT / "tournament.html"
test_path = ROOT / "scripts" / "tournament-result-ui.test.mjs"
sw_path = ROOT / "sw.js"
pkg_path = ROOT / "package.json"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, got {count}")
    return text.replace(old, new, 1)


html = html_path.read_text(encoding="utf-8")

html = replace_once(
    html,
    '<meta name="app-version" content="20260829-5">',
    '<meta name="app-version" content="20260830-1">',
    "app version",
)

style_anchor = '''    .match-editor{margin:12px 0;padding:13px;border:2px solid rgba(255,157,66,.58);border-radius:12px;background:rgba(255,125,32,.08)}\n'''
style_insert = '''    .match-day-actions{margin:0 0 16px;padding:15px;border:3px solid #ff9d42;border-radius:14px;background:linear-gradient(135deg,rgba(255,125,32,.14),rgba(0,170,255,.08));box-shadow:0 6px 18px rgba(0,0,0,.14)}
    .match-day-kicker{display:inline-flex;align-items:center;gap:5px;margin-bottom:5px;padding:3px 8px;border-radius:99px;background:#c86500;color:#fff;font-size:.66rem;font-weight:1000}
    .match-day-title{color:#fff;font-size:1rem;font-weight:1000}.match-day-copy{margin-top:4px;color:#c8d9ea;font-size:.72rem;line-height:1.6}
    .match-day-buttons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:11px}.match-day-button{min-height:52px;padding:10px 12px;border:2px solid transparent;border-radius:10px;font:inherit;font-size:.78rem;font-weight:1000;cursor:pointer}.match-day-button.edit{background:#c86500;border-color:#ffb066;color:#fff}.match-day-button.share{background:#00794f;border-color:#58d3a3;color:#fff}
    .score-share-panel{margin-top:10px;padding:10px;border:1px solid rgba(88,211,163,.5);border-radius:10px;background:rgba(0,121,79,.09)}.score-share-label{display:block;color:#7fffc0;font-size:.72rem;font-weight:1000}.score-share-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin-top:6px}.score-share-url{width:100%;min-width:0;min-height:42px;padding:8px 10px;border:1px solid rgba(127,255,192,.55);border-radius:8px;background:#092b25;color:#dfffee;font:700 .7rem/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;box-sizing:border-box}.score-share-copy{min-height:42px;padding:8px 11px;border:1px solid #58d3a3;border-radius:8px;background:#0b5d45;color:#fff;font:inherit;font-size:.7rem;font-weight:1000;cursor:pointer}.score-share-note{display:block;margin-top:6px;color:#a9c9bd;font-size:.65rem;line-height:1.5}.score-share-feedback{min-height:20px;margin-top:5px;color:#7fffc0;font-size:.68rem;font-weight:900}
    .score-share-mini{min-height:44px;padding:8px 11px;border:1px solid #0b7a55;border-radius:8px;background:#0b7a55;color:#fff;font:inherit;font-size:.7rem;font-weight:1000;cursor:pointer}.score-entry-mode-banner{display:none;margin:0 0 12px;padding:14px;border:2px solid #0b7a55;border-radius:12px;background:#eafaf3;color:#123d31;font-size:.78rem;line-height:1.6}.score-entry-mode-banner strong{display:block;margin-bottom:3px;font-size:.95rem}.score-entry-mode-banner span{font-weight:700}
    body.score-entry-mode .linked-workflow,body.score-entry-mode .tournament-purpose,body.score-entry-mode .doc-tab-bar,body.score-entry-mode #doc-youkou,body.score-entry-mode #doc-taisen>.panel,body.score-entry-mode #t-guide{display:none!important}body.score-entry-mode #doc-taisen{display:block!important}body.score-entry-mode .score-entry-mode-banner{display:block}
    body[data-theme="light"] .match-day-actions{background:linear-gradient(135deg,#fff7ed,#eef9ff);border-color:#c86500;box-shadow:0 5px 14px rgba(23,50,74,.1)}body[data-theme="light"] .match-day-title{color:#17263c}body[data-theme="light"] .match-day-copy{color:#42546b}body[data-theme="light"] .score-share-panel{background:#eefbf6;border-color:#49a982}body[data-theme="light"] .score-share-label{color:#075f32}body[data-theme="light"] .score-share-url{background:#fff;color:#173b66;border-color:#73b99f}body[data-theme="light"] .score-share-note{color:#42546b}body[data-theme="light"] .score-share-feedback{color:#075f32}
'''
html = replace_once(html, style_anchor, style_insert + style_anchor, "match day styles")

mobile_anchor = '''      .match-editor-head{display:block}.match-editor-head-actions{display:grid;grid-template-columns:minmax(0,1fr);margin-top:9px}.match-editor-add,.match-editor-save{width:100%}.match-editor-item{grid-template-columns:minmax(0,1fr)}.match-editor-delete{width:100%}.ranking-pdf-actions{grid-template-columns:minmax(0,1fr)}.ranking-pdf-button{width:100%}\n'''
mobile_replacement = mobile_anchor + '''      .match-day-buttons{grid-template-columns:1fr}.score-share-row{grid-template-columns:1fr}.score-share-copy{width:100%}\n'''
html = replace_once(html, mobile_anchor, mobile_replacement, "mobile share styles")

panel_anchor = '''  <div class="doc-section" id="doc-taisen">\n    <div class="panel no-print">\n      <div class="sec">📌 大会基本情報</div>\n'''
panel_replacement = '''  <div class="doc-section" id="doc-taisen">
    <div class="score-entry-mode-banner no-print"><strong>📲 試合結果入力専用画面</strong><span>各試合の黄色い「得点」欄へ数字を入力してください。入力内容は自動保存され、順位表へ反映されます。入力が終わったら画面を閉じて大丈夫です。</span></div>
    <div class="panel no-print">
      <div class="match-day-actions" id="match-day-actions">
        <span class="match-day-kicker">試合当日はここ</span>
        <div class="match-day-title">⚽ 試合の変更・スコア入力URL</div>
        <div class="match-day-copy">① 試合を追加・削除する場合は左（上）のボタン。② 得点入力を誰かにお願いする場合は「スコア入力URLを作る」を押し、そのURLをLINEで送ってください。</div>
        <div class="match-day-buttons">
          <button class="match-day-button edit" type="button" onclick="openMatchEditor()">⚽ 試合を追加・削除する</button>
          <button class="match-day-button share" type="button" onclick="prepareScoreEntryUrl(true)">🔗 スコア入力URLを作る</button>
        </div>
        <div class="score-share-panel">
          <label class="score-share-label" for="score-share-url">📲 入力担当者へ送るURL</label>
          <div class="score-share-row"><input class="score-share-url" id="score-share-url" readonly placeholder="「スコア入力URLを作る」を押すと、ここにURLが表示されます"><button class="score-share-copy" type="button" onclick="copyScoreEntryUrl()">URLをコピー</button></div>
          <div class="match-day-buttons" style="margin-top:7px"><button class="score-share-copy" type="button" onclick="copyScoreEntryLineMessage()">📋 LINE用の案内文＋URLをコピー</button><button class="score-share-copy" type="button" onclick="openScoreEntryPreview()">👁 入力画面を確認</button></div>
          <span class="score-share-note">URL作成時に現在の対戦表をクラウドへ保存します。送られた人はURLを開くだけで、試合結果の入力欄へ直接移動できます。</span>
          <div class="score-share-feedback" id="score-share-feedback" role="status" aria-live="polite"></div>
        </div>
      </div>
      <div class="sec">📌 大会基本情報</div>
'''
html = replace_once(html, panel_anchor, panel_replacement, "match day action panel")

editor_anchor = '''      <div class="match-editor" id="match-editor">\n        <div class="match-editor-head">\n          <div><div class="match-editor-title">⚽ 試合を追加・削除</div><div class="match-editor-help">自動作成した試合を削除できます。交流戦・順位決定戦などの追加試合は順位計算に含めません。変更後は保存してください。</div></div>\n'''
editor_replacement = '''      <div class="match-editor" id="match-editor">
        <div class="match-editor-head">
          <div><div class="match-editor-title">⚽ ここで試合を追加・削除できます</div><div class="match-editor-help">「＋ 追加試合を入れる」で交流戦などを追加できます。下の試合一覧では各試合の「削除」を押せます。変更後は「変更を保存」を押してください。</div></div>
'''
html = replace_once(html, editor_anchor, editor_replacement, "match editor title")
html = replace_once(
    html,
    '<details class="match-editor-details" id="match-editor-details">\n          <summary><span>現在の試合一覧・削除</span><span id="match-editor-count">0試合</span></summary>',
    '<details class="match-editor-details" id="match-editor-details" open>\n          <summary><span>👇 現在の試合一覧（ここから削除できます）</span><span id="match-editor-count">0試合</span></summary>',
    "match editor details open",
)

result_anchor = '''  h+='<div class="result-entry-help no-print" id="score-entry" tabindex="-1"><div class="result-entry-copy"><strong class="result-entry-title">⚽ 試合結果の入力</strong><span class="result-entry-text">試合終了後、各試合の「得点」欄へ数字を入力してください。順位表・総当たり表へ自動反映されます。</span><span class="result-example">入力例：2 － 1</span></div><div class="result-entry-actions"><span class="rank-update-feedback" role="status" aria-live="polite"></span><span class="result-save-status">得点未入力</span><button class="rank-jump-button" type="button" onclick="scrollToTournamentRankings()">順位表を見る ↓</button></div><div class="result-rank-note">↓ 入力結果は下の順位表へ自動反映されます</div></div>';\n'''
result_replacement = '''  h+='<div class="result-entry-help no-print" id="score-entry" tabindex="-1"><div class="result-entry-copy"><strong class="result-entry-title">⚽ ここに試合結果を入力してください</strong><span class="result-entry-text">試合終了後、各試合の黄色い「得点」欄へ数字を入力してください。入力は自動保存され、順位表・総当たり表へ自動反映されます。</span><span class="result-example">入力例：2 － 1</span></div><div class="result-entry-actions"><span class="rank-update-feedback" role="status" aria-live="polite"></span><span class="result-save-status">得点未入力</span><button class="score-share-mini" type="button" onclick="copyScoreEntryLineMessage()">📲 入力URLをLINE用にコピー</button><button class="rank-jump-button" type="button" onclick="scrollToTournamentRankings()">順位表を見る ↓</button></div><div class="result-rank-note">↓ 入力結果は下の順位表へ自動反映されます。入力後はこの画面を閉じてOKです。</div></div>';\n'''
html = replace_once(html, result_anchor, result_replacement, "result entry guidance")

context_anchor = '''    category: params.get("category") || "",\n    view: params.get("view") || ""\n'''
context_replacement = '''    category: params.get("category") || "",
    saveId: params.get("saveId") || "",
    view: params.get("view") || ""
'''
html = replace_once(html, context_anchor, context_replacement, "saveId context")

context_flag_anchor = '''var _contextHydrated = false;\n\nfunction updateTournamentContextLine(){\n'''
context_flag_replacement = '''var _contextHydrated = false;
if(TOURNAMENT_CONTEXT.saveId && TOURNAMENT_CONTEXT.view==="results")document.body.classList.add("score-entry-mode");

function updateTournamentContextLine(){
'''
html = replace_once(html, context_flag_anchor, context_flag_replacement, "score entry mode flag")

listen_anchor = '''    renderLinkedTournamentDates();\n    updateTournamentContextLine();\n    if(_activeGameAdjustDateId && !_contextHydrated){\n      _contextHydrated = true;\n      hydrateLinkedDate(_activeGameAdjustDateId, _activeDateMeta);\n    }\n'''
listen_replacement = '''    renderLinkedTournamentDates();
    updateTournamentContextLine();
    if(TOURNAMENT_CONTEXT.saveId && !_contextHydrated){
      var directSave=_allSaves[TOURNAMENT_CONTEXT.saveId];
      if(directSave&&directSave.type==="taisen"){
        _contextHydrated=true;
        applySaveEntry(directSave);
        renderLinkedTournamentDates();
        updateTournamentContextLine();
        focusRequestedTournamentView();
        return;
      }
    }
    if(_activeGameAdjustDateId && !_contextHydrated){
      _contextHydrated = true;
      hydrateLinkedDate(_activeGameAdjustDateId, _activeDateMeta);
    }
'''
html = replace_once(html, listen_anchor, listen_replacement, "direct score link hydration")

function_anchor = '''function matchResultKey(blockIndex,home,away){\n'''
share_functions = r'''function openMatchEditor(){
  var editor=document.getElementById("match-editor"),details=document.getElementById("match-editor-details");
  if(details)details.open=true;
  if(editor){editor.scrollIntoView({behavior:"smooth",block:"start"});window.setTimeout(function(){var add=editor.querySelector(".match-editor-add");if(add)add.focus({preventScroll:true});},260);}
}
function latestStandaloneTaisenSaveId(){
  var title=gv("t-title"),date=gv("t-date");
  var candidates=Object.entries(_allSaves).filter(function(pair){
    var item=pair[1],data=item&&item.data||{};
    return item&&item.type==="taisen"&&!item.gameAdjustDateId&&data["t-title"]===title&&data["t-date"]===date;
  }).sort(function(a,b){return (b[1].savedAt||"").localeCompare(a[1].savedAt||"");});
  return candidates.length?candidates[0][0]:"";
}
function makeTaisenShareEntry(){
  var savedAt=new Date().toISOString(),name=gv("t-title")||"吉見SMC 対戦表";
  var entry={
    name:name,type:"taisen",savedAt:savedAt,gameAdjustDateId:_activeGameAdjustDateId||"",
    dateIso:_activeDateMeta.dateIso||gv("t-date")||"",dateLabel:_activeDateMeta.dateLabel||"",category:_activeDateMeta.category||"",
    data:collectFields(TAISEN_FIELDS)
  };
  entry.data.teams=JSON.stringify(captureTeamValues());
  if(_lastTournamentSchedule)entry.data.optimizedSchedule=JSON.stringify(_lastTournamentSchedule);
  entry.data.matchResults=JSON.stringify(_matchResults);
  return entry;
}
function scoreEntryUrlForSave(saveId){
  var url=new URL(location.href);url.hash="";url.search="";
  url.searchParams.set("saveId",saveId);url.searchParams.set("view","results");
  return url.toString();
}
function setScoreShareFeedback(text){
  var feedback=document.getElementById("score-share-feedback");if(feedback)feedback.textContent=text||"";
}
function setScoreShareUrl(url){
  var field=document.getElementById("score-share-url");if(field)field.value=url||"";
}
function saveTaisenForScoreShare(done){
  if(!_lastTournamentSchedule){var built=buildTaisen(true);if(built===false)return;}
  var linkedExisting=_activeGameAdjustDateId?linkedEntries(_activeGameAdjustDateId,"taisen")[0]:null;
  var id=linkedExisting?linkedExisting[0]:latestStandaloneTaisenSaveId();
  if(!id)id="sv_"+Date.now();
  _allSaves[id]=makeTaisenShareEntry();
  localStorage.setItem(SAVE_KEY,JSON.stringify(_allSaves));
  setScoreShareFeedback("クラウドへ保存してURLを作成しています…");
  dbSave("tournament_saves",_allSaves,SAVE_KEY,function(){
    renderLinkedTournamentDates();
    var url=scoreEntryUrlForSave(id);setScoreShareUrl(url);setScoreShareFeedback("✅ スコア入力URLを作成しました。このURLを入力担当者へ送ってください。");
    if(typeof done==="function")done(url,id);
  });
}
function copyScoreShareText(text,success){
  function ok(){setScoreShareFeedback(success||"✅ コピーしました");}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(ok).catch(function(){window.prompt("下の内容をコピーしてください",text);});return;}
  window.prompt("下の内容をコピーしてください",text);ok();
}
function prepareScoreEntryUrl(copyAfterCreate){
  saveTaisenForScoreShare(function(url){if(copyAfterCreate)copyScoreShareText(url,"✅ URLをコピーしました。LINEに貼り付けて送れます。");});
}
function copyScoreEntryUrl(){
  var field=document.getElementById("score-share-url");
  if(field&&field.value){copyScoreShareText(field.value,"✅ URLをコピーしました。LINEに貼り付けて送れます。");return;}
  prepareScoreEntryUrl(true);
}
function scoreEntryLineText(url){
  var title=gv("t-title")||"大会";
  return "【試合結果入力のお願い】\n"+title+"の試合結果入力をお願いします。\n\n下のURLを開き、各試合終了後に黄色い『得点』欄へ数字を入力してください。\n入力内容は自動保存され、順位表へ反映されます。\n\n"+url+"\n\nよろしくお願いします🙇";
}
function copyScoreEntryLineMessage(){
  var field=document.getElementById("score-share-url");
  if(field&&field.value){copyScoreShareText(scoreEntryLineText(field.value),"✅ LINE用の案内文とURLをコピーしました。");return;}
  saveTaisenForScoreShare(function(url){copyScoreShareText(scoreEntryLineText(url),"✅ LINE用の案内文とURLをコピーしました。");});
}
function openScoreEntryPreview(){
  var field=document.getElementById("score-share-url");
  if(field&&field.value){window.open(field.value,"_blank","noopener");return;}
  saveTaisenForScoreShare(function(url){window.open(url,"_blank","noopener");});
}

'''
html = replace_once(html, function_anchor, share_functions + function_anchor, "score share functions")

html_path.write_text(html, encoding="utf-8")

# Keep browser/PWA cache versions aligned so the visible change reaches installed devices.
sw = sw_path.read_text(encoding="utf-8")
sw = replace_once(sw, 'const APP_VERSION = "20260829-5";', 'const APP_VERSION = "20260830-1";', "service worker version")
sw_path.write_text(sw, encoding="utf-8")

pkg = pkg_path.read_text(encoding="utf-8")
pkg = replace_once(pkg, '"version": "20260829.5.0"', '"version": "20260830.1.0"', "package version")
pkg_path.write_text(pkg, encoding="utf-8")

test = test_path.read_text(encoding="utf-8")
required_anchor = '''  "＋ 追加試合を入れる",\n'''
required_replacement = '''  "＋ 追加試合を入れる",
  "⚽ 試合を追加・削除する",
  "🔗 スコア入力URLを作る",
  "LINE用の案内文＋URLをコピー",
  "ここに試合結果を入力してください",
  "function prepareScoreEntryUrl(copyAfterCreate)",
  "function copyScoreEntryLineMessage()",
  'url.searchParams.set("saveId",saveId)',
  'url.searchParams.set("view","results")',
'''
test = replace_once(test, required_anchor, required_replacement, "result UI test requirements")
test += '''\nassert.match(html,/<details class="match-editor-details" id="match-editor-details" open>/,"試合追加・削除一覧は初期状態で開いて表示してください");\nassert.ok(html.includes('body.score-entry-mode #doc-taisen>.panel'),"共有URLでは設定画面を隠し、得点入力に集中できるようにしてください");\n'''
test_path.write_text(test, encoding="utf-8")

print("one-time tournament score-share patch applied")
