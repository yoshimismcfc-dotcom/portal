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
const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const indexVersion = indexSource.match(/name=["']app-version["'][^>]*content=["']([^"']+)/i)?.[1];
const swVersion = swSource.match(/APP_VERSION\s*=\s*["']([^"']+)/)?.[1];
if (!indexVersion || !swVersion || indexVersion !== swVersion) {
  fail("PWA", `バージョン不一致 index=${indexVersion || "なし"} sw=${swVersion || "なし"}`);
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
