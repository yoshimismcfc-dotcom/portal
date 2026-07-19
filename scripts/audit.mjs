import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith(".html")).sort();
const failures = [];

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function isExternal(reference) {
  return /^(?:[a-z]+:)?\/\//i.test(reference) || /^(?:mailto:|tel:|data:|javascript:)/i.test(reference);
}

for (const file of htmlFiles) {
  const source = fs.readFileSync(path.join(root, file), "utf8");

  const ids = new Map();
  for (const match of source.matchAll(/\bid=["']([^"']+)["']/gi)) {
    ids.set(match[1], (ids.get(match[1]) || 0) + 1);
  }
  for (const [id, count] of ids) {
    if (count > 1) fail(file, `id="${id}" が ${count} 回あります`);
  }

  for (const match of source.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith("#") || raw.includes("${") || isExternal(raw)) continue;
    let target = raw.split(/[?#]/, 1)[0];
    if (!target) continue;
    if (target.startsWith("/portal/")) target = target.slice("/portal/".length);
    else if (target.startsWith("/")) continue;
    const localPath = path.resolve(root, target);
    if (!localPath.startsWith(root + path.sep) && localPath !== root) {
      fail(file, `範囲外の参照です: ${raw}`);
    } else if (!fs.existsSync(localPath)) {
      fail(file, `リンク先がありません: ${raw}`);
    }
  }

  for (const match of source.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      new Function(match[1]);
    } catch (error) {
      fail(file, `インラインJavaScript構文エラー: ${error.message}`);
    }
  }

  if (/\bcaches\.delete\s*\(/.test(source) || /\.unregister\s*\(/.test(source)) {
    fail(file, "HTML内でService Workerまたはキャッシュを強制削除しています");
  }
  if (/\b_roster\b/.test(source)) fail(file, "未定義の旧変数 _roster が残っています");
  if (/\b(?:pw|password|passcode)\s*[:=]\s*["'][^"']+["']/i.test(source)) {
    fail(file, "平文の認証情報らしき値が埋め込まれています");
  }
  for (const link of source.matchAll(/<a\b[^>]*\btarget=["']_blank["'][^>]*>/gi)) {
    if (!/\brel=["'][^"']*\bnoopener\b/i.test(link[0])) {
      fail(file, "新しいタブで開くリンクに rel=noopener がありません");
    }
  }
  const headSource = source.match(/<head>[\s\S]*?<\/head>/i)?.[0] || "";
  if (file !== "offline.html" && !/<script\s+src=["']common\.js["']><\/script>/i.test(headSource)) {
    fail(file, "共通JavaScript common.js がheadで読み込まれていません");
  }
  if (file !== "offline.html" && !/<header class=["']site-header["']><\/header>/i.test(source)) {
    fail(file, "共通ヘッダーのマウント先が一元化されていません");
  }
  if (!/name=["']robots["'][^>]*noindex/i.test(headSource)) {
    fail(file, "検索除外設定がありません");
  }
  if (/name=["']smc-access["']/i.test(headSource)) {
    fail(file, "廃止した管理者ゲート設定が残っています");
  }
}

for (const file of ["common.js", "firebase-config.js", "sw.js"]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  try {
    new Function(source);
  } catch (error) {
    fail(file, `JavaScript構文エラー: ${error.message}`);
  }
}

const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const commonCssSource = fs.readFileSync(path.join(root, "common.css"), "utf8");
const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const firebaseSource = fs.readFileSync(path.join(root, "firebase-config.js"), "utf8");
if (!swSource.includes('fetch(request, {cache:"no-store"})') || !swSource.includes('["style","script"]')) {
  fail("sw.js", "起動時にJavaScript・CSSをネットワーク優先で更新していません");
}
if (!firebaseSource.includes("var latest =") || !firebaseSource.includes('localStorage.setItem(localKey, JSON.stringify(latest))')) {
  fail("firebase-config.js", "Firebase取得後にクラウド値を正として端末キャッシュを最新化していません");
}
const indexVersion = indexSource.match(/name=["']app-version["'][^>]*content=["']([^"']+)/i)?.[1];
const swVersion = swSource.match(/APP_VERSION\s*=\s*["']([^"']+)/)?.[1];
if (!indexVersion || !swVersion || indexVersion !== swVersion) {
  fail("PWA", `バージョン不一致 index=${indexVersion || "なし"} sw=${swVersion || "なし"}`);
}
if (!commonCssSource.includes("--body-tail: #e8eef7")) {
  fail("common.css", "ライトモードのページ背景が暗色のままです");
}

const tournamentSource = fs.readFileSync(path.join(root, "tournament.html"), "utf8");
const tournamentVersion = tournamentSource.match(/name=["']app-version["'][^>]*content=["']([^"']+)/i)?.[1];
if (tournamentVersion !== swVersion) {
  fail("PWA", `tournament.html のバージョンが一致しません: ${tournamentVersion || "なし"}`);
}
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const expectedPackageVersion = swVersion ? `${swVersion.replace("-", ".")}.0` : "";
if (packageJson.version !== expectedPackageVersion) {
  fail("PWA", `package.json のバージョンが一致しません: ${packageJson.version || "なし"}（期待値 ${expectedPackageVersion || "なし"}）`);
}

for (const legacyFile of ["album.html", "heat.html", "init-data.html", "kaikei.html"]) {
  const source = fs.readFileSync(path.join(root, legacyFile), "utf8");
  if (!/name=["']robots["'][^>]*noindex/i.test(source)) {
    fail(legacyFile, "旧ページに noindex がありません");
  }
}

const membersSource = fs.readFileSync(path.join(root, "members.html"), "utf8");
if (!membersSource.includes('MEMBER_PATH = "members_v2"')) fail("members.html", "団員単位の保存パスがありません");
if (/var INIT\s*=\s*\{[\s\S]*?name\s*:/m.test(membersSource)) fail("members.html", "HTML内に団員名簿が残っています");
if (/localStorage\.setItem\([^\n]*smc_members/i.test(membersSource)) fail("members.html", "団員名簿を端末へ保存しています");
if (!membersSource.includes("next[grade]=next[grade].filter")) fail("members.html", "Firebase名簿の空データを除外していません");

const commonSource = fs.readFileSync(path.join(root, "common.js"), "utf8");
const calendarSource = fs.readFileSync(path.join(root, "calendar.html"), "utf8");
if (!commonSource.includes("refreshCoachFolderLabels")) {
  fail("common.js", "旧名称を安全にコーチ専用フォルダへ置き換える処理がありません");
}
if (!commonSource.includes("controllerchange") || !commonSource.includes("event.persisted")) {
  fail("common.js", "アプリ更新時または復元表示時に最新版を取得する処理がありません");
}
if (/window\.location\.reload\s*\(/.test(commonSource)) {
  fail("common.js", "入力中の画面を消す強制再読込が残っています");
}
if (!commonSource.includes("forecast_days=8") || !commonSource.includes("offset<8") || !commonSource.includes("auto-alert-status")) {
  fail("common.js", "自動アラートが8日先検索または予報確認状況表示に対応していません");
}
if (!commonSource.includes("現在アラートはありません") || !commonSource.includes("予報を取得できませんでした")) {
  fail("common.js", "自動アラートの正常・エラー状態表示がありません");
}
if (!commonSource.includes("setupDisclosureAccessibility")) {
  fail("common.js", "タップ式の説明項目にキーボード操作を追加していません");
}
if (!commonSource.includes("setupResponsiveTables") || !commonCssSource.includes("table.mobile-stack")) {
  fail("共通UI", "スマホ向け表レイアウトの共通処理がありません");
}
for (const responsiveFile of ["accounts.html", "members.html", "duty.html", "accounting.html", "weather.html", "heat.html", "guide.html"]) {
  const responsiveSource = fs.readFileSync(path.join(root, responsiveFile), "utf8");
  if (!responsiveSource.includes("mobile-stack")) fail(responsiveFile, "スマホ向け表レイアウトが適用されていません");
}
const guideSource = fs.readFileSync(path.join(root, "guide.html"), "utf8");
if (!guideSource.includes("次の屋外練習を8日先まで") || !guideSource.includes("予報確認状況")) {
  fail("guide.html", "自動アラートの8日先検索と状態表示が説明されていません");
}
if (guideSource.includes("今後1週間の予定リスト")) fail("guide.html", "廃止したカレンダー予定リストの説明が残っています");
if (guideSource.includes("パスワードは「表示」")) fail("guide.html", "廃止したパスワード表示機能の説明が残っています");
if (!guideSource.includes("予選・順位戦・閉会式の時刻も自動再計算")) fail("guide.html", "昼食後の時刻再計算が説明書にありません");
if (!guideSource.includes("参加チーム数・残りチーム数")) fail("guide.html", "試合調整のスマホ集計表示が説明書にありません");
if (guideSource.includes("先に「📊 対戦表を生成」を押してから印刷")) fail("guide.html", "古い対戦表印刷手順が残っています");
const accountsSource = fs.readFileSync(path.join(root, "accounts.html"), "utf8");
const coachSource = fs.readFileSync(path.join(root, "coach.html"), "utf8");
const financeSource = fs.readFileSync(path.join(root, "finance.html"), "utf8");
const todoSource = fs.readFileSync(path.join(root, "todo.html"), "utf8");
if (/<th>パスワード<\/th>/.test(accountsSource)) fail("accounts.html", "保存しないパスワードの列見出しが残っています");
if (/\.pw-(?:cell|text|toggle)/.test(accountsSource)) fail("accounts.html", "廃止したパスワード表示用CSSが残っています");
if (!coachSource.includes("立替・購入相談") || !coachSource.includes("finance.html?from=coach&view=request")) {
  fail("coach.html", "コーチ専用フォルダに会計さんへの立替・購入相談入口がありません");
}
if (!coachSource.includes("共有タスク") || !coachSource.includes("todo.html?from=coach")) {
  fail("coach.html", "コーチ専用フォルダにホーム連動のやることリスト入口がありません");
}
if (!financeSource.includes('dbListen("family_finance"') || !financeSource.includes('dbSave("family_finance"') || !financeSource.includes("applyFinanceEntryContext")) {
  fail("finance.html", "会計さんへの入力が共通Firebaseデータまたはコーチ入口に連動していません");
}
if (!todoSource.includes('dbListen("todo"') || !todoSource.includes('dbSave("todo"') || !todoSource.includes('id="todo-back"')) {
  fail("todo.html", "やることリストが共通Firebaseデータまたはコーチ入口に連動していません");
}
if (/dbListen\("todo"[\s\S]*?Array\.isArray\(val\)\s*&&\s*val\.length\s*>\s*0/.test(todoSource)) {
  fail("todo.html", "Firebaseの空配列を受け入れず、全件削除後に古いタスクが残る可能性があります");
}
const readmeSource = fs.readFileSync(path.join(root, "README.md"), "utf8");
if (!readmeSource.includes("AI・Codexへ修正を依頼する共通プロンプト") || !readmeSource.includes("空配列や空データ")) {
  fail("README.md", "再利用可能な修正プロンプトまたは空データ同期の注意事項がありません");
}
if (!guideSource.includes("会計業務（相談・集金・会計報告）") || !guideSource.includes("申請中・了解・支払い済・差戻し")) {
  fail("guide.html", "現行の会計画面と状態変更手順が説明されていません");
}
if (!guideSource.includes("立替・購入相談") || !guideSource.includes("共有タスク") || !guideSource.includes("同じFirebaseデータ")) {
  fail("guide.html", "コーチ共有の会計・やることリスト連動が説明されていません");
}

const refereeSource = fs.readFileSync(path.join(root, "referee.html"), "utf8");
const assistantRuleNumbers = Array.from({ length: 8 }, (_, index) => refereeSource.includes(`<div class="rule-num">${index + 1}</div>`) ? index + 1 : 0);
if (assistantRuleNumbers.join(",") !== "1,2,3,4,5,6,7,8") {
  fail("referee.html", "副審の心得が1〜8の順で揃っていません");
}
for (const requiredText of ["10〜15m素早く移動", "主審とのアイコンタクト", "少なくとも片足の一部", "時計2個", "判定と次の再開の監視を優先", "copyAssistantPrinciples", "IFAB競技規則2026/27"]) {
  if (!refereeSource.includes(requiredText)) fail("referee.html", `副審の心得に必要な内容がありません: ${requiredText}`);
}
if (refereeSource.includes("キック前にGKが動きゴールインしなかった場合はフラッグアップ")) {
  fail("referee.html", "PK時の古い一律フラッグアップ説明が残っています");
}
if (!refereeSource.includes('body[data-theme="light"] .rule-title') || !refereeSource.includes("principles-source")) {
  fail("referee.html", "副審の心得のライトモードまたは出典表示がありません");
}
if (!guideSource.includes("副審の心得をLINEコピー") || !guideSource.includes("IFAB競技規則2026/27")) {
  fail("guide.html", "副審の心得・LINEコピー・現行規則の説明がありません");
}
for (const marker of ["offside-body-parts", "returning-offside-diagram", "deliberate-play-diagram", "tab-changes"]) {
  if (!refereeSource.includes(marker)) fail("referee.html", `審判ガイドの必須図解がありません: ${marker}`);
}
if (!refereeSource.includes("頭・胴体・足") || !refereeSource.includes("手や腕だけ")) fail("referee.html", "オフサイド判定対象の身体部分が説明されていません");
if (!refereeSource.includes("8秒を超えると相手のコーナーキック") || !refereeSource.includes("最後の5秒")) fail("referee.html", "GKの8秒ルールが最新内容ではありません");
if (!refereeSource.includes("入れば蹴り直し") || !refereeSource.includes("偶発的な二度触り")) fail("referee.html", "PKの偶発的な二度触りが説明されていません");
if (refereeSource.includes("WBGT25℃以上：ハーフタイムに5分以上")) fail("referee.html", "根拠のない固定飲水時間が残っています");
if (!guideSource.includes("戻りオフサイド") || !guideSource.includes("GKの8秒ルール")) fail("guide.html", "審判ガイドの図解・改正説明がありません");

const gameAdjustSource = fs.readFileSync(path.join(root, "game_adjust.html"), "utf8");
const dutyMatchSource = fs.readFileSync(path.join(root, "duty_match.html"), "utf8");
const accountingSource = fs.readFileSync(path.join(root, "accounting.html"), "utf8");
if (!gameAdjustSource.includes("renderGameAdjustImmediately") || !gameAdjustSource.includes("connectGameAdjustCloud") || !gameAdjustSource.includes("firebase-config.js?retry=")) {
  fail("game_adjust.html", "試合調整に即時表示またはFirebase自動再接続がありません");
}
if (!gameAdjustSource.includes('window.addEventListener("online"') || !gameAdjustSource.includes('document.addEventListener("visibilitychange"')) {
  fail("game_adjust.html", "通信回復・画面復帰時の自動再接続がありません");
}
if (!guideSource.includes("端末データを先に即時表示") || !guideSource.includes("裏側で自動再接続")) {
  fail("guide.html", "試合調整の自動復旧が説明されていません");
}
if (!gameAdjustSource.includes("duty_match.html") || !gameAdjustSource.includes("tournament.html") || !gameAdjustSource.includes("accounting.html") || !gameAdjustSource.includes("date-related-links")) {
  fail("game_adjust.html", "カテゴリー／目標下に大会関連ページへの入口がありません");
}
if (!dutyMatchSource.includes('dbListen("duty_match"') || !dutyMatchSource.includes('dbSave("duty_match"')) {
  fail("duty_match.html", "大会任務分担が共通Firebaseデータを使用していません");
}
if (!tournamentSource.includes('dbListen("tournament_saves"') || !tournamentSource.includes('dbSave("tournament_saves"')) {
  fail("tournament.html", "大会要項・対戦表が共通Firebaseデータを使用していません");
}
if (!gameAdjustSource.includes("linkedDateIso") || !gameAdjustSource.includes("&dateIso=")) {
  fail("game_adjust.html", "大会関連ページへ日程IDと年月日を引き継いでいません");
}
if (!dutyMatchSource.includes("ensureLinkedMatch") || !dutyMatchSource.includes("gameAdjustDateId") || !dutyMatchSource.includes("_showAllMatches")) {
  fail("duty_match.html", "大会任務分担が試合調整の日程別データとして表示されません");
}
if (!dutyMatchSource.includes("copyDutyTemplate") || !dutyMatchSource.includes("cloneDutyTemplate")) {
  fail("duty_match.html", "大会任務分担にコピー可能な標準テンプレートがありません");
}
if (!tournamentSource.includes("hydrateLinkedDate") || !tournamentSource.includes("linked-tournament-dates") || !tournamentSource.includes("linkedEntries")) {
  fail("tournament.html", "大会要項・対戦表に日程別一覧または選択日程の読込処理がありません");
}
if (!tournamentSource.includes("copyTournamentTemplate") || !tournamentSource.includes("TOURNAMENT_TEMPLATES")) {
  fail("tournament.html", "大会要項・対戦表にコピー可能なテンプレートがありません");
}
if (!tournamentSource.includes("linkedExisting") || !tournamentSource.includes("gameAdjustDateId: _activeGameAdjustDateId")) {
  fail("tournament.html", "要綱・対戦表が日程単位で更新保存されません");
}
if (!accountingSource.includes("ensureLinkedAccounting") || !accountingSource.includes("gameAdjustDateId") || !accountingSource.includes("LINK_CONTEXT")) {
  fail("accounting.html", "会計・決算書が試合調整の日程別データとして開きません");
}
if (!accountingSource.includes('dbListen("accounting"') || !accountingSource.includes('dbSave("accounting"')) {
  fail("accounting.html", "会計・決算書が共通Firebaseデータを使用していません");
}
if (!accountingSource.includes("copyAccountingTemplate") || !accountingSource.includes("linkedAccountingTemplate")) {
  fail("accounting.html", "会計・決算書にコピー可能な標準テンプレートがありません");
}
if (!guideSource.includes("試合調整の日程ID") || !guideSource.includes("会計テンプレートをコピー") || !guideSource.includes("既存の未連携データは削除されません")) {
  fail("guide.html", "日程連動・テンプレート・既存データ互換の説明がありません");
}
if (!gameAdjustSource.includes('id="new-note"') || !gameAdjustSource.includes('id="edit-note"')) {
  fail("game_adjust.html", "日程の追加・編集画面に備考入力欄がありません");
}
if (!gameAdjustSource.includes("class='date-note'") || !gameAdjustSource.includes("data.備考[d.id] = note")) {
  fail("game_adjust.html", "日程備考の保存またはカテゴリー／目標下の表示がありません");
}
const gameAdjustRenderStart = gameAdjustSource.indexOf('"<br><span style=\'color:#ffaa66');
const gameAdjustNoteIndex = gameAdjustSource.indexOf("((data.備考 || {})[d.id]", gameAdjustRenderStart);
const gameAdjustLinksIndex = gameAdjustSource.indexOf('"<span class=\'date-related-links', gameAdjustRenderStart);
if (gameAdjustRenderStart < 0 || gameAdjustNoteIndex < 0 || gameAdjustLinksIndex < 0 || gameAdjustNoteIndex > gameAdjustLinksIndex) {
  fail("game_adjust.html", "備考がカテゴリー／目標の直下に配置されていません");
}
if (!gameAdjustSource.includes("min-height:25px") || !gameAdjustSource.includes("date-edit-hint") || !gameAdjustSource.includes("font-size:.72rem")) {
  fail("game_adjust.html", "大会関連ボタンの縦幅またはタップ編集表示の大きさが調整されていません");
}
if (!gameAdjustSource.includes('id="new-tournament-name"') || !gameAdjustSource.includes('id="edit-tournament-name"')) {
  fail("game_adjust.html", "日程の追加・編集画面に大会名入力欄がありません");
}
if (!gameAdjustSource.includes("date-tournament-name") || !gameAdjustSource.includes("d.tournamentName = tournamentName")) {
  fail("game_adjust.html", "大会名の保存または日付下の表示がありません");
}
if (!guideSource.includes("大会名は日付の下")) {
  fail("guide.html", "大会名の入力・表示方法が説明書にありません");
}
if (!guideSource.includes("備考は残りチーム数のすぐ下")) {
  fail("guide.html", "日程備考の入力・表示方法が説明書にありません");
}
if (!guideSource.includes("Firebaseを正") || !guideSource.includes("コンパクトな大会関連ボタン")) {
  fail("guide.html", "起動時の最新データ取得または試合調整の配置変更が説明書にありません");
}
if (!commonSource.includes("enhanceGameAdjustMobile") || !commonSource.includes("game-adjust-date-nav")) {
  fail("common.js", "試合調整のスマホ用日程切り替え表示がありません");
}
if (!commonSource.includes('body[data-theme="light"].game-adjust-enhanced')) {
  fail("common.js", "ライトモードの試合調整表に文字色補正がありません");
}
if (!commonSource.includes("game-adjust-legend-item") || !commonSource.includes("cleanCategoryLabel")) {
  fail("common.js", "試合調整の凡例または日程カテゴリー表示がありません");
}
if (!commonSource.includes("ga-mobile-summary") || !commonSource.includes("参加チーム数：")) {
  fail("common.js", "参加数・残り数のスマホ向け集約表示がありません");
}
if (!commonSource.includes('data-summary="note"') || !commonSource.includes('data-summary-row="note"')) {
  fail("common.js", "備考が残りチーム数の下へ集約表示されません");
}
if (!dutyMatchSource.includes("person-quick-edit") || !dutyMatchSource.includes("openEditDutyPersons")) {
  fail("duty_match.html", "未定または担当者名から直接編集するスマホ操作がありません");
}
if (!commonSource.includes("表示する日程") || !commonSource.includes(".full-badge{display:none")) {
  fail("common.js", "日程選択の強調または不要な達成チェックの非表示がありません");
}
if (!commonSource.includes("game-adjust-category-filter") || !commonSource.includes("categoryKey")) {
  fail("common.js", "試合調整にカテゴリー絞り込みがありません");
}
if (!commonSource.includes("dateSortValue") || !commonSource.includes("visibleEntries") || !commonSource.includes("fiscalMonthIndex")) {
  fail("common.js", "試合調整の日程選択が4月始まりの年度順になっていません");
}
if (!commonSource.includes("ACTIVE_DATE_KEY") || !commonSource.includes("rememberActiveDate") || !commonSource.includes("option.value = entry.dateId")) {
  fail("common.js", "選択中の試合日程を列番号ではなく日程IDで保持していません");
}
if (!commonSource.includes("dateSortValue(dateIso, label)") || !commonSource.includes("fiscalYear * 10000")) {
  fail("common.js", "複数年度の日程を西暦込みの年度順で並べていません");
}
if (!gameAdjustSource.includes("data-date-id") || !gameAdjustSource.includes("data-date-iso") || !gameAdjustSource.includes("var savedDateIso")) {
  fail("game_adjust.html", "日程ID・ISO日付または保存済み年を編集画面へ引き継いでいません");
}
if (/function openEditDate[\s\S]*?new Date\(\)\.getFullYear\(\)/.test(gameAdjustSource)) {
  fail("game_adjust.html", "日程編集時に保存済みの年ではなく端末の今年を使用しています");
}
if (!guideSource.includes("選択中の日程は日程IDで保持")) {
  fail("guide.html", "年をまたぐ日程選択の保持が説明されていません");
}
if (!guideSource.includes("カテゴリーで絞り込み") || !guideSource.includes("年度順（4月→翌年3月）")) {
  fail("guide.html", "試合調整の年度順表示とカテゴリー絞り込みが説明書にありません");
}
if (!commonSource.includes("enhanceTournamentPrinting") || !commonSource.includes("ensureLunchBreakRows")) {
  fail("common.js", "対戦表の昼食休憩を印刷へ確実に反映する処理がありません");
}
if (!commonSource.includes("adjustedRoundTimes") || !commonSource.includes("finalsStart")) {
  fail("common.js", "昼食後の予選・順位戦時刻を再計算する処理がありません");
}
if (!commonSource.includes("const finalsStart = cursor") || !commonSource.includes('finalsTable.querySelectorAll(".tr-break-td")')) {
  fail("common.js", "順位戦前の固定10分休憩を削除する処理がありません");
}
if (!guideSource.includes("固定10分休憩はありません")) {
  fail("guide.html", "任意休憩の説明がありません");
}
if (!commonSource.includes('data-print-target="tournament-schedule"') || !commonSource.includes("tournament-print-enhanced-style")) {
  fail("common.js", "対戦表の印刷専用デザインがありません");
}
if (!commonSource.includes("#doc-taisen #t-date") || !commonSource.includes("min-inline-size:0")) {
  fail("common.js", "対戦表の期日入力欄にスマホ向け横幅補正がありません");
}
if (!commonSource.includes("enhanceCalendarUpcomingAgenda") || !commonSource.includes("calendar-upcoming-agenda") || !commonSource.includes("calendar-event-card")) {
  fail("common.js", "カレンダー下の今後の予定表示がありません");
}
if (!commonSource.includes("extractDescriptionTime") || !commonSource.includes("descriptionTime") || !commonSource.includes('normalize("NFKC")')) {
  fail("common.js", "説明欄の時間範囲を予定カードへ反映する処理がありません");
}
if (!commonSource.includes("calendar-upcoming-refresh") || !commonSource.includes('refreshButton.addEventListener("click"') || commonSource.includes("CACHE_TTL")) {
  fail("common.js", "今後の予定がページ表示時に最新情報へ更新される構造ではありません");
}
const calendarColorMappings = [
  ['color: "#8e24aa", label: "U12"', '<span class="leg-dot" style="background:#8e24aa"></span>U12'],
  ['color: "#d50000", label: "U11"', '<span class="leg-dot" style="background:#d50000"></span>U11'],
  ['color: "#f09300", label: "U10"', '<span class="leg-dot" style="background:#f09300"></span>U10'],
  ['color: "#e4c441", label: "U9"', '<span class="leg-dot" style="background:#e4c441"></span>U9'],
  ['color: "#7cb342", label: "U8"', '<span class="leg-dot" style="background:#7cb342"></span>U8'],
  ['color: "#0b8043", label: "U7"', '<span class="leg-dot" style="background:#0b8043"></span>U7']
];
for (const [cardMapping, legendMapping] of calendarColorMappings) {
  if (!commonSource.includes(cardMapping) || !calendarSource.includes(legendMapping)) {
    fail("calendar.html", "Googleカレンダーと予定カードのカテゴリー色が一致していません");
  }
}
if (!guideSource.includes("Google Calendar API") || !guideSource.includes("利用制限")) {
  fail("guide.html", "今後の予定のAPI連携と利用制限が説明書にありません");
}

const rulesPath = path.join(root, "database.rules.json");
if (fs.existsSync(rulesPath)) {
  try {
    const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
    if (!rules.rules?.members_v2?.$memberId?.[".validate"]) fail("database.rules.json", "団員データの入力検証がありません");
  } catch (error) {
    fail("database.rules.json", `JSONを読み込めません: ${error.message}`);
  }
}

const precacheBlock = swSource.match(/const PRECACHE_URLS\s*=\s*\[([\s\S]*?)\];/)?.[1] || "";
for (const match of precacheBlock.matchAll(/["']\.\/([^"']*)["']/g)) {
  const target = match[1] || "index.html";
  if (!fs.existsSync(path.join(root, target))) fail("sw.js", `事前キャッシュ対象がありません: ./${match[1]}`);
}

if (failures.length) {
  console.error(`\n${failures.length} 件の問題が見つかりました:`);
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`OK: ${htmlFiles.length} HTMLページ、共通JavaScript、PWA設定を検査しました。`);
