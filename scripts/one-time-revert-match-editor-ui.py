from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
html_path=ROOT/'tournament.html'
index_path=ROOT/'index.html'
sw_path=ROOT/'sw.js'
pkg_path=ROOT/'package.json'

def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly 1 match, got {count}')
    return text.replace(old,new,1)

html=html_path.read_text(encoding='utf-8')
html=replace_once(html,'<meta name="app-version" content="20260830-1">','<meta name="app-version" content="20260830-2">','tournament version')

old_block='''      <div class="match-day-actions" id="match-day-actions">
        <span class="match-day-kicker">試合当日はここ</span>
        <div class="match-day-title">⚽ 試合の変更・スコア入力URL</div>
        <div class="match-day-copy">① 試合を追加・削除する場合は左（上）のボタン。② 得点入力を誰かにお願いする場合は「スコア入力URLを作る」を押し、そのURLをLINEで送ってください。</div>
        <div class="match-day-buttons">
          <button class="match-day-button edit" type="button" onclick="openMatchEditor()">⚽ 試合を追加・削除する</button>
          <button class="match-day-button share" type="button" onclick="prepareScoreEntryUrl(true)">🔗 スコア入力URLを作る</button>
        </div>
'''
new_block='''      <div class="match-day-actions" id="match-day-actions">
        <span class="match-day-kicker">試合当日の入力用</span>
        <div class="match-day-title">📲 スコア入力URL</div>
        <div class="match-day-copy">試合結果の入力を別のコーチなどにお願いするときだけ使います。「スコア入力URLを作る」を押して、表示されたURLをLINEで送ってください。</div>
        <div class="match-day-buttons" style="grid-template-columns:1fr">
          <button class="match-day-button share" type="button" onclick="prepareScoreEntryUrl(true)">🔗 スコア入力URLを作る</button>
        </div>
'''
html=replace_once(html,old_block,new_block,'top match-day actions')

old_editor='''      <div class="match-editor" id="match-editor">
        <div class="match-editor-head">
          <div><div class="match-editor-title">⚽ ここで試合を追加・削除できます</div><div class="match-editor-help">「＋ 追加試合を入れる」で交流戦などを追加できます。下の試合一覧では各試合の「削除」を押せます。変更後は「変更を保存」を押してください。</div></div>
          <div class="match-editor-head-actions"><button class="match-editor-add" type="button" onclick="openManualMatchModal()">＋ 追加試合を入れる</button><button class="match-editor-save" type="button" onclick="openSaveModal('taisen')">💾 変更を保存</button></div>
        </div>
        <details class="match-editor-details" id="match-editor-details" open>
          <summary><span>👇 現在の試合一覧（ここから削除できます）</span><span id="match-editor-count">0試合</span></summary>
          <div class="match-editor-list" id="match-editor-list"></div>
        </details>
        <div class="match-editor-feedback" id="match-editor-feedback" role="status" aria-live="polite"></div>
      </div>'''
new_editor='''      <div class="match-editor" id="match-editor">
        <div class="match-editor-head">
          <div><div class="match-editor-title">⚽ 試合を追加・削除</div><div class="match-editor-help">自動作成した試合を削除できます。交流戦・順位決定戦などの追加試合は順位計算に含めません。変更後は保存してください。</div></div>
          <div class="match-editor-head-actions"><button class="match-editor-add" type="button" onclick="openManualMatchModal()">＋ 追加試合を入れる</button><button class="match-editor-save" type="button" onclick="openSaveModal('taisen')">💾 変更を保存</button></div>
        </div>
        <details class="match-editor-details" id="match-editor-details">
          <summary><span>現在の試合一覧・削除</span><span id="match-editor-count">0試合</span></summary>
          <div class="match-editor-list" id="match-editor-list"></div>
        </details>
        <div class="match-editor-feedback" id="match-editor-feedback" role="status" aria-live="polite"></div>
      </div>'''
html=replace_once(html,old_editor,new_editor,'match editor block')

old_fn='''function openMatchEditor(){
  var editor=document.getElementById("match-editor"),details=document.getElementById("match-editor-details");
  if(details)details.open=true;
  if(editor){editor.scrollIntoView({behavior:"smooth",block:"start"});window.setTimeout(function(){var add=editor.querySelector(".match-editor-add");if(add)add.focus({preventScroll:true});},260);}
}
'''
html=replace_once(html,old_fn,'','openMatchEditor function')
html_path.write_text(html,encoding='utf-8')

index=index_path.read_text(encoding='utf-8')
index=replace_once(index,'<meta name="app-version" content="20260830-1">','<meta name="app-version" content="20260830-2">','index version')
index_path.write_text(index,encoding='utf-8')

sw=sw_path.read_text(encoding='utf-8')
sw=replace_once(sw,'const APP_VERSION = "20260830-1";','const APP_VERSION = "20260830-2";','service worker version')
sw_path.write_text(sw,encoding='utf-8')

pkg=pkg_path.read_text(encoding='utf-8')
pkg=replace_once(pkg,'"version": "20260830.1.0"','"version": "20260830.2.0"','package version')
pkg_path.write_text(pkg,encoding='utf-8')

print('match editor UI reverted; score share retained')
