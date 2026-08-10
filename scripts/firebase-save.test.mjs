import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storage = new Map();
const statuses = [];
const silentConsole = {
  log() {},
  warn() {},
  error() {}
};

const context = {
  console: silentConsole,
  URL,
  Promise,
  setTimeout,
  clearTimeout,
  CustomEvent: function(type, init) {
    this.type = type;
    this.detail = init.detail;
  },
  localStorage: {
    setItem(key, value) { storage.set(key, value); },
    getItem(key) { return storage.get(key) || null; }
  },
  document: {
    createElement() { return {}; },
    head: { appendChild() {} }
  },
  window: {
    location: { href: "https://example.test/portal/" },
    setTimeout,
    clearTimeout,
    dispatchEvent(event) { statuses.push(event.detail); }
  }
};

vm.createContext(context);
const firebaseSource = fs.readFileSync(path.join(root, "firebase-config.js"), "utf8");
for (const requiredProjectValue of [
  'apiKey:            "AIzaSyCzJUtjC4ODuw2zO7yg4KR6TqILE05_jNk"',
  'messagingSenderId: "155203351289"',
  'appId:             "1:155203351289:web:72d49675b0243684922828"'
]) {
  if (!firebaseSource.includes(requiredProjectValue)) {
    throw new Error("Firebase公式Webアプリ設定と一致していません: " + requiredProjectValue);
  }
}
if (!firebaseSource.includes("function loadFirebaseScript(index)") ||
    !firebaseSource.includes("loadFirebaseScript(index + 1)") ||
    firebaseSource.includes("scripts.forEach(function(src)")) {
  throw new Error("Firebase SDKは app→database→auth の順番で読み込んでください");
}
if (!firebaseSource.includes("finishFirebaseInitialization(false)")) {
  throw new Error("認証SDKが取得できない場合も通常のデータ同期を開始してください");
}
vm.runInContext(firebaseSource, context);

const malicious = '\");globalThis.injected=true;//';
const encodedArg = context.inlineJsArg(malicious);
const decodedArg = encodedArg
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&");
let receivedArg = null;
const argumentContext = { receive(value) { receivedArg = value; } };
vm.runInNewContext(`receive(${decodedArg})`, argumentContext);
if (receivedArg !== malicious || argumentContext.injected) {
  throw new Error("インラインイベント引数の安全化に失敗しました");
}
if (context.normalizeExternalUrl("javascript:alert(1)") !== "") {
  throw new Error("危険なURLスキームを許可しています");
}
if (!context.normalizeExternalUrl("https://example.test/path").startsWith("https://example.test/path")) {
  throw new Error("HTTPS URLが正しく検証されません");
}

context.FIREBASE_READY = true;
let successCalls = 0;
let errorCalls = 0;

context.FIREBASE_DB = {
  ref() { return { set() { return Promise.resolve(); } }; }
};
const success = await context.dbSave(
  "success-test",
  { value: 1 },
  "success-local",
  () => { successCalls += 1; },
  () => { errorCalls += 1; }
);

if (!success.ok || !success.cloudSaved || successCalls !== 1 || errorCalls !== 0) {
  throw new Error("クラウド成功時のコールバック状態が不正です");
}

context.FIREBASE_DB = {
  ref() { return { set() { return Promise.reject(new Error("permission denied")); } }; }
};
const failure = await context.dbSave(
  "failure-test",
  { value: 2 },
  "failure-local",
  () => { successCalls += 1; },
  () => { errorCalls += 1; }
);

if (failure.ok || failure.cloudSaved || !failure.localSaved || successCalls !== 1 || errorCalls !== 1) {
  throw new Error("クラウド失敗時に成功扱いされています");
}
if (storage.get("failure-local") !== JSON.stringify({ value: 2 })) {
  throw new Error("クラウド失敗時の端末保存が確認できません");
}
if (!statuses.some((status) => status.cloudSaved) || !statuses.some((status) => status.error)) {
  throw new Error("保存状態イベントが不足しています");
}

console.log("OK: Firebase保存の成功・失敗判定を検査しました。");
