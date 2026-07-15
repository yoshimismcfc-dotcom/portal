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
if (!commonSource.includes("refreshCoachFolderLabels")) {
  fail("common.js", "旧名称を安全にコーチ専用フォルダへ置き換える処理がありません");
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
if (guideSource.includes("今後1週間の予定リスト")) fail("guide.html", "廃止したカレンダー予定リストの説明が残っています");
if (guideSource.includes("パスワードは「表示」")) fail("guide.html", "廃止したパスワード表示機能の説明が残っています");
if (!guideSource.includes("予選・順位戦・閉会式の時刻も自動再計算")) fail("guide.html", "昼食後の時刻再計算が説明書にありません");
if (!guideSource.includes("参加チーム数・残りチーム数")) fail("guide.html", "試合調整のスマホ集計表示が説明書にありません");
if (guideSource.includes("先に「📊 対戦表を生成」を押してから印刷")) fail("guide.html", "古い対戦表印刷手順が残っています");
const accountsSource = fs.readFileSync(path.join(root, "accounts.html"), "utf8");
if (/<th>パスワード<\/th>/.test(accountsSource)) fail("accounts.html", "保存しないパスワードの列見出しが残っています");
if (/\.pw-(?:cell|text|toggle)/.test(accountsSource)) fail("accounts.html", "廃止したパスワード表示用CSSが残っています");

const gameAdjustSource = fs.readFileSync(path.join(root, "game_adjust.html"), "utf8");
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
if (!commonSource.includes("表示する日程・カテゴリー") || !commonSource.includes(".full-badge{display:none")) {
  fail("common.js", "日程選択の強調または不要な達成チェックの非表示がありません");
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
if (!commonSource.includes("extractDescriptionTime") || !commonSource.includes("descriptionTime")) {
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
