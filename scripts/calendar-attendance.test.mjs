import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";
import vm from "node:vm";
import {buildAttendanceRows, encodeAttendanceCsv} from "../attendance-preview-csv.mjs";
import {sharedAttendance, sharedEventVisibility} from "../attendance-preview-store.mjs";
import {fileURLToPath} from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const attendance = require(path.join(root, "calendar-attendance.js"));

assert.equal(
  attendance.extractChouseisanUrl("出欠はこちら https://chouseisan.com/s?h=abc123"),
  "https://chouseisan.com/s?h=abc123"
);
assert.equal(
  attendance.extractChouseisanUrl("<a href='https://chouseisan.com/s?h=xyz&amp;k=1'>回答</a>"),
  "https://chouseisan.com/s?h=xyz&k=1"
);
assert.equal(attendance.extractChouseisanUrl("http://chouseisan.com/s?h=unsafe"), "");
assert.equal(attendance.extractChouseisanUrl("https://example.com/?next=https://chouseisan.com.evil.test/"), "");
assert.equal(attendance.formatDate("2026-08-30"), "8月30日（日）");
assert.deepEqual(attendance.targetGrades("", "U7（1年以下）吉見フェスティバル"), ["1年", "年長"]);
assert.deepEqual(attendance.targetGrades("", "U7（1年生）練習試合"), ["1年"]);
assert.deepEqual(attendance.targetGrades("【対象】１年生以下・年長", "U7"), ["1年", "年長"]);
assert.deepEqual(attendance.targetGrades("", "U12 ６〜５年 練習試合"), ["6年", "5年"]);
assert.deepEqual(
  attendance.targetGrades("集合案内<br><b>【対象】５年～３年</b><br>【時間】9時", "U11（5年）新人戦"),
  ["5年", "4年", "3年"]
);
assert.deepEqual(attendance.targetGrades("【対象学年】全学年", ""), ["6年", "5年", "4年", "3年", "2年", "1年", "年長"]);
assert.equal(attendance.targetGrades("【対象】招待選手", "U8（2年）試合"), null);
assert.equal(attendance.targetGrades("", "U12（第4回）試合"), null);

assert.deepEqual(attendance.targetGrades("", "寄居大会（６～３年女子）"), ["6年", "5年", "4年", "3年"]);
assert.deepEqual(attendance.targetGrades("【対象】５年～３年の女子のみ", "U11交流戦"), ["5年", "4年", "3年"]);
assert.deepEqual(attendance.targetGrades("【対象】女子のみ", "U11（5年）大会"), ["5年"]);
assert.equal(attendance.targetGrades("", "U10大会（女子）"), null);
assert(attendance.girlsOnly("", "寄居大会（６～３年女子）"));
assert(attendance.girlsOnly("", "U10大会（女子）"));
assert(attendance.girlsOnly("【対象】全学年の女子", "交流戦"));
assert(!attendance.girlsOnly("【対象】５年・４年", "U11交流戦"));
assert(!attendance.girlsOnly("", "U11交流戦（女子も可）"));
assert(!attendance.girlsOnly("【対象】男女", "U11女子交流戦"));
assert(!attendance.girlsOnly("集合は女子チームと同じ場所", "U11交流戦"));

const parts = attendance.descriptionLinks(
  "集合：8時<br>URL（https://chouseisan.com/s?h=test）<br>" +
  '<a href="https://drive.google.com/file/d/test/view?x=1&amp;y=2">要項</a>。' +
  '<a href="javascript:alert(1)">リンク不可</a>'
);
assert.deepEqual(parts.filter(part => part.href).map(part => part.href), [
  "https://chouseisan.com/s?h=test",
  "https://drive.google.com/file/d/test/view?x=1&y=2"
]);
assert.ok(parts.map(part => part.text).join("").includes("集合：8時\n"));
assert.ok(parts.map(part => part.text).join("").includes("要項"));
assert.equal(attendance.descriptionLinks("https://user:secret@example.com/").some(part => part.href), false);

const message = attendance.buildLineMessage([
  {title:"U10 練習試合", start:"2026-09-06", attendanceUrl:"https://chouseisan.com/s?h=u10"},
  {title:"U8 大会", start:"2026-08-30", attendanceUrl:"https://chouseisan.com/s?h=u8"},
  {title:"URLなし", start:"2026-08-31", attendanceUrl:""}
]);
assert.ok(message.includes("【タイトル】U8 大会\n【日付】8月30日（日）\n【調整さんURL】https://chouseisan.com/s?h=u8"));
assert.ok(message.indexOf("U8 大会") < message.indexOf("U10 練習試合"), "日付順になっていません");
assert.equal(message.includes("URLなし"), false);

const categorized = attendance.normalizeEntries([
  {title:"U10 練習試合", start:"2026-09-06", label:"U10", attendanceUrl:"https://chouseisan.com/s?h=cat-u10"}
]);
assert.equal(categorized[0].category, "U10");
assert.equal(categorized[0].color, "#f09300");
assert.equal(attendance.safeCategoryColor("", "U12"), "#8e24aa");
assert.equal(attendance.safeCategoryColor("", "U11"), "#d50000");
assert.equal(attendance.safeCategoryColor("", "U9"), "#e4c441");
assert.equal(attendance.safeCategoryColor("", "U8"), "#7cb342");
assert.equal(attendance.safeCategoryColor("", "U7"), "#0b8043");
assert.equal(attendance.safeCategoryColor("", "全体"), "#616161");
assert.equal(attendance.safeCategoryColor("", "その他"), "#4285f4");
assert.equal(attendance.safeCategoryColor("javascript:alert(1)", "未登録"), "#4285f4");
assert.ok(categorized[0].key.includes("U10 練習試合"), "試合選択用の安定キーがありません");

const selectedMessage = attendance.buildLineMessage([
  {title:"U10だけ", start:"2026-09-06", label:"U10", attendanceUrl:"https://chouseisan.com/s?h=selected"}
]);
assert.ok(selectedMessage.includes("U10だけ"));

const { initialCalendarDay, tokyoDate } = attendance;
assert.equal(tokyoDate("2026-11-21T15:00:00Z"), "2026-11-22");
assert.equal(tokyoDate("2026-11-22T14:59:59Z"), "2026-11-22");
const today = "2026-11-22";
const makeEvent = (title, start, extra = {}) => ({ title, start, allDay: true, ...extra });
const screenshotEvents = [
  makeEvent("U11(5年～3年)4種新人戦", today),
  makeEvent("U7（1年以下）吉見フェスティバル", today),
  makeEvent("U8（2年以下）吉見フェスティバル", today),
  makeEvent("【練習中止】全体練習", today)
];
const upcoming = [
  makeEvent("U12 練習試合", "2026-12-05"),
  makeEvent("全体練習", "2026-11-23", { label: "U12" }),
  makeEvent("【中止】交流戦", "2026-11-24"),
  makeEvent("市民大会", "2026-12-05"),
  makeEvent("U9", "2026-11-25"),
  makeEvent("新人戦", "2026-11-28", { status: "cancelled" })
];
assert.deepEqual(initialCalendarDay([...screenshotEvents, ...upcoming], today).todaysEvents, screenshotEvents);
assert.equal(initialCalendarDay(screenshotEvents, today).practiceOnly, false);
const withoutToday = initialCalendarDay(upcoming, today);
assert.equal(withoutToday.nextDate, "2026-12-05");
assert.deepEqual(withoutToday.nextEvents.map(event => event.title), ["U12 練習試合", "市民大会"]);
assert.equal(initialCalendarDay([makeEvent("低学年練習", today), ...upcoming], today).practiceOnly, true);
assert.equal(initialCalendarDay([makeEvent("文化の日", today, { label: "祝日" })], today).todaysEvents.length, 0);
assert.equal(initialCalendarDay([makeEvent("合宿", "2026-11-21", { end: "2026-11-23" })], today).todaysEvents.length, 1);
assert.equal(initialCalendarDay([makeEvent("午前活動", "2026-11-23", { description: "【種別】ＴＭ" }), ...upcoming], today).nextDate, "2026-11-23");
assert.equal(initialCalendarDay([makeEvent("交流戦（雨天中止）", "2026-11-23")], today).nextDate, "2026-11-23");
assert.equal(initialCalendarDay([makeEvent("活動", "2026-11-23", { kind: "match" })], today).nextDate, "2026-11-23");
assert.equal(initialCalendarDay([makeEvent("練習", "2026-11-23")], today).nextDate, "");

// Exercise the same event list used by the attendance board, entry forms and totals.
const previewSource = fs.readFileSync(path.join(root, "attendance-preview.js"), "utf8");
const previewContext = {
  Intl, URLSearchParams, location: { hash: "" }, window: { SMCCalendarAttendance: attendance },
  localStorage: { getItem: () => null, setItem() {} }
};
vm.runInNewContext(previewSource.replace('document.addEventListener("DOMContentLoaded",init);', `
  todayISO = () => "2026-11-22";
  holidays["2026-11-23"] = "勤労感謝の日";
  globalThis.preview = {
    state, getBoardEvents, groupBoardDays, countAnswers, renderEntryDay, applySharedAnswers, eligibility, matchRestriction,
    matchAttendanceTable, readEntryUpdates, eventListStatus,
    categorySummaryRows, matchCategories, dayHeading, compactCountMarks, scheduleDays,
    setSharedReady(value) { sharedReady = value; },
    setRecruitment(records) { recruitmentRows = new Map(records); },
    setVisibility(values) { eventVisibility = new Map(values); },
    useGroup(group) { audience = group; },
    sync(events, failed = []) {
      syncWeekendPractices(events, failed);
      calendarMatchesChecked = true;
      return syncCalendarAttendance(events.map(calendarAttendanceEvent).filter(Boolean), false, failed);
    }
  };
`), previewContext);
const preview = previewContext.preview;
const practice = makeEvent("全体練習", "2026-11-28T08:00:00+09:00", { label: "全体" });
const match = makeEvent("U12（6年）大会", "2026-11-28", { label: "U12", sourceId: "fixture" });
const cancelledPractice = { ...practice, title: "【練習中止】全体練習" };
const school = makeEvent("小学校の運動会", "2026-11-29", { label: "全体" });
const holidayBreak = makeEvent("年末年始休み", "2027-01-02", { label: "U12", sourceId: "break" });
const dateIds = (date) => Array.from(preview.getBoardEvents().filter(event => event.date === date), event => event.id);
const practiceId = "day_2026-11-28";
preview.state.answers[practiceId] = { players: { demo: { value: "attending" } } };
assert.deepEqual(dateIds("2026-11-28"), []);
assert(preview.sync([practice, match, school, holidayBreak]));
assert.deepEqual(dateIds("2026-11-28"), [practiceId, "calendar_fixture"]);
assert.deepEqual(dateIds("2026-11-29"), []);
assert.deepEqual(dateIds("2027-01-02"), []);
assert(preview.sync([], ["全体", "U12"]));
assert.deepEqual(dateIds("2026-11-28"), [practiceId, "calendar_fixture"]);
assert(preview.sync([cancelledPractice, match, school]));
assert.deepEqual(dateIds("2026-11-28"), ["calendar_fixture"]);
assert(preview.sync([practice, { ...match, status: "cancelled" }]));
assert.deepEqual(dateIds("2026-11-28"), [practiceId]);
assert(preview.sync([]));
assert.deepEqual(dateIds("2026-11-28"), []);
assert.equal(preview.state.answers[practiceId].players.demo.value, "attending");
assert(preview.sync([practice]));
assert.deepEqual(dateIds("2026-11-28"), [practiceId]);
assert.deepEqual(dateIds("2026-11-23"), ["day_2026-11-23"]);
assert.deepEqual(dateIds("2026-11-25"), ["day_2026-11-25"]);

const marathon = makeEvent("全体練習は中止でスポ少マラソン", "2026-12-05", {
  label: "全体", sourceId: "marathon", location: "テスト会場"
});
const athlete = { id: "same-id", name: "検証用団員", grade: "6年" };
const coach = { id: "same-id", name: "検証用コーチ" };
assert(preview.sync([marathon, match]));
assert(preview.sync([marathon, match]));
assert.deepEqual(dateIds("2026-12-05"), ["calendar_marathon"]);
const activityDay = preview.groupBoardDays(preview.getBoardEvents()).find(day => day.date === "2026-12-05");
const activity = activityDay.activities[0];
assert.equal(activity.title, "スポ少マラソン");
assert.equal(activity.place, "テスト会場");
assert.equal(activity.startTime, "");
assert.equal(activityDay.practice.length, 0);
assert.equal(activityDay.matches.length, 0);
assert.equal(preview.countAnswers([activity], [athlete], activityDay).eligible, 1);
assert.match(preview.renderEntryDay(activityDay, athlete, true), />行事<.*スポ少マラソン/);
preview.useGroup("coaches");
assert.equal(preview.countAnswers([activity], [coach], activityDay).eligible, 1);
assert.match(preview.renderEntryDay(activityDay, coach, true), />行事<.*スポ少マラソン/);
assert(preview.sync([{ ...marathon, title: marathon.title + "中止" }, match]));
assert.deepEqual(dateIds("2026-12-05"), []);
assert(preview.sync([marathon, match]));
assert.deepEqual(dateIds("2026-12-05"), ["calendar_marathon"]);
assert(preview.sync([match]));
assert.deepEqual(dateIds("2026-12-05"), []);

// Two independent clients share only this isolated test database.
const docs = new Map();
const snapshot = () => ({ metadata: {}, docs: Array.from(docs, ([id, data]) => ({ id, data: () => data })) });
const listeners = [];
const answerCollection = {
  doc: id => id,
  onSnapshot(options, receive) { listeners.push(receive); receive(snapshot()); }
};
const db = {
  collection: () => ({ doc: () => ({ collection: () => answerCollection }) }),
  async runTransaction(write) {
    const changes = new Map();
    await write({ get: async id => ({ data: () => docs.get(id), exists: docs.has(id) }), set: (id, data) => changes.set(id, data) });
    changes.forEach((data, id) => docs.set(id, data));
    listeners.forEach(receive => receive(snapshot()));
  }
};
const writer = sharedAttendance(db, () => null, "isolated-test");
const reader = sharedAttendance(db, () => null, "isolated-test");
let remote;
reader.listen(records => { remote = records; preview.applySharedAnswers(records, reader.key); });
const fixtureId = "calendar_fixture";
const matchDay = preview.groupBoardDays(preview.getBoardEvents()).find(day => day.date === "2026-11-28");
const fixture = matchDay.matches[0];
assert.match(preview.renderEntryDay(matchDay, coach, true),
  /出欠だけで保存できます。.*<details class="match-contact"><summary>連絡事項（任意）.*name="lateTime-calendar_fixture"/);
const form = new FormData();
form.set("answer-" + fixtureId, "attending");
form.set("contact-" + fixtureId, "1");
await writer.save("coaches", coach.id, preview.readEntryUpdates(form, coach, [matchDay]), undefined, remote);
assert.equal(remote.get(writer.key(fixtureId, "coaches", coach.id)).value, "attending");
assert.deepEqual(remote.get(writer.key(fixtureId, "coaches", coach.id)).contact, {});
form.set("late-" + fixtureId, "on");
form.set("lateTime-" + fixtureId, "10:30");
form.set("early-" + fixtureId, "on");
form.set("earlyTime-" + fixtureId, "14:00");
await writer.save("coaches", coach.id, preview.readEntryUpdates(form, coach, [matchDay]), undefined, remote);
const coachRow = () => preview.matchAttendanceTable(fixture, [coach], "coaches");
assert.match(coachRow(), /○ 参加/);
assert.match(coachRow(), /早退（14:00）.*遅刻・途中参加（10:30）/);
assert.doesNotMatch(preview.matchAttendanceTable(fixture, [athlete], "players"), /10:30|14:00/);
assert.doesNotMatch(preview.matchAttendanceTable({ ...fixture, id: "same-day-other-fixture" }, [coach], "coaches"), /10:30|14:00/);
form.set("lateTime-" + fixtureId, "10:45");
await writer.save("coaches", coach.id, preview.readEntryUpdates(form, coach, [matchDay]), undefined, remote);
assert.match(coachRow(), /10:45/);
assert.doesNotMatch(coachRow(), /10:30/);
form.delete("late-" + fixtureId);
form.delete("early-" + fixtureId);
await writer.save("coaches", coach.id, preview.readEntryUpdates(form, coach, [matchDay]), undefined, remote);
assert.match(coachRow(), /○ 参加/);
assert.doesNotMatch(coachRow(), /10:45|14:00/);

const otherFixture = { ...match, sourceId: "fixture-two" };
assert(preview.sync([practice, match, otherFixture]));
preview.setVisibility([["calendar_fixture", true]]);
assert.deepEqual(dateIds("2026-11-28"), [practiceId, "calendar_fixture-two"]);
assert.match(preview.matchAttendanceTable(fixture, [coach], "coaches"), /○ 参加/);
assert.equal(preview.eventListStatus(fixture, false), "出欠表から除外中");
assert(preview.sync([practice, match, otherFixture]));
assert.deepEqual(dateIds("2026-11-28"), [practiceId, "calendar_fixture-two"]);
preview.setVisibility([["calendar_fixture", false]]);
assert.deepEqual(dateIds("2026-11-28"), [practiceId, "calendar_fixture", "calendar_fixture-two"]);
const legacyFixture = preview.state.events.find(event => event.id === "calendar_fixture");
legacyFixture.hidden = true;
assert(dateIds("2026-11-28").includes("calendar_fixture"), "Synced restoration overrides a legacy local exclusion");
assert(preview.sync([practice, otherFixture]));
assert(!dateIds("2026-11-28").includes("calendar_fixture"), "Restoration cannot reopen a calendar deletion");
assert.equal(preview.eventListStatus(preview.state.events.find(event => event.id === "calendar_fixture"), false), "カレンダー対象外");

const u8 = makeEvent("U8（2年）交流戦", "2026-11-28", { label: "U8", sourceId: "u8" });
assert(preview.sync([practice, match, otherFixture, u8]));
preview.useGroup("players");
preview.setSharedReady(true);
const extraPlayer = { id: "invited", name: "検証用・個別招集", grade: "5年" };
preview.setRecruitment([["calendar_fixture", { decisions: { [extraPlayer.id]: "include" } }]]);
preview.state.answers.calendar_fixture = { players: { [athlete.id]: { value: "attending" } } };
preview.state.answers["calendar_fixture-two"] = { players: { [athlete.id]: { value: "maybe" } } };
const categoryRows = () => {
  const days = preview.groupBoardDays(preview.getBoardEvents()).filter(day => ["2026-11-25", "2026-11-28"].includes(day.date));
  const byDate = new Map(days.map(day => [day.date, preview.matchCategories(day.matches)]));
  return preview.categorySummaryRows(days, byDate, [athlete, extraPlayer]);
};
const totalsMarkup = categoryRows();
assert.match(totalsMarkup, />U12試合<.*?>U8試合</);
const unorderedCategories = ["U10", "U8", "", "U12", "U7", "U11", "U9"].map(category => ({ category }));
assert.deepEqual(Array.from(preview.matchCategories(unorderedCategories).keys()),
  ["U12", "U11", "U10", "U9", "U8", "U7", "その他"]);
assert.doesNotMatch(totalsMarkup, /U7試合/);
assert.match(totalsMarkup, /試合なし/);
assert.match(totalsMarkup, /U12の試合集計。延べ・2試合　対象 延べ3人、参加 1人、未定 1人、不参加 0人、未回答 1人/);
preview.setVisibility([["calendar_fixture", true]]);
assert.match(categoryRows(), /U12の試合集計。対象 1人、参加 0人、未定 1人、不参加 0人、未回答 0人/);
preview.setSharedReady(false);
assert.match(categoryRows(), /集計待ち/);
preview.setSharedReady(true);

const narrowDay = preview.groupBoardDays(preview.getBoardEvents()).find(day => day.date === "2026-11-25");
const narrowHeading = preview.dayHeading(narrowDay, [athlete]);
assert.match(narrowHeading, /href="calendar.html\?date=2026-11-25"/);
assert.match(narrowHeading, /board-date[^>]*>11\/25（水）<\/span><span class="event-count-summary"/);
assert.doesNotMatch(narrowHeading, /▦|練習・行事|未回答/);
assert.match(narrowHeading, /board-target-count" aria-hidden="true">対象 1人/);
assert.match(totalsMarkup, /board-target-count" aria-hidden="true">対象 延べ3人/);
assert.match(categoryRows(), /board-target-count" aria-hidden="true">対象 1人/);
assert.doesNotMatch(categoryRows(), /category-count-context/);
assert.match(preview.compactCountMarks({ attending: 12, maybe: 10, absent: 11 }),
  /○12<\/span><span class="count-maybe">△10<\/span><span class="count-no">×11/);

const girlsFixture = { id: "girls-fixture", kind: "match", title: "寄居大会（６～３年女子）", targetGrades: null };
const girl = { id: "g", grade: "6年", gender: "f" };
const boy = { id: "b", grade: "6年", gender: "m" };
const youngerGirl = { id: "y", grade: "2年", gender: "f" };
const unregistered = { id: "u", grade: "5年" };
assert.equal(preview.countAnswers([girlsFixture], [girl, boy, youngerGirl, unregistered]).eligible, 1);
assert.equal(preview.eligibility(girlsFixture, unregistered, "players"), "対象要確認");
assert.equal(preview.eligibility(girlsFixture, boy, "coaches"), "");
assert.equal(preview.matchRestriction(girlsFixture, boy, "include"), "対象外");
assert.equal(preview.matchRestriction(girlsFixture, youngerGirl, "include"), "");
assert.equal(preview.matchRestriction(girlsFixture, girl, "exclude"), "招集対象外");
assert.equal(preview.eligibility({ ...girlsFixture, title: "交流戦（６～３年）" }, boy, "players"), "");

const unifiedSchedule = preview.scheduleDays(preview.getBoardEvents(), "");
const listedDay = unifiedSchedule.find(day => day.date === "2026-11-28");
assert.equal(unifiedSchedule.filter(day => day.date === "2026-11-28").length, 1);
assert(listedDay.canAdd);
assert(listedDay.events.some(event => event.id === "calendar_fixture"));
assert(listedDay.events.some(event => event.id === "calendar_fixture-two"));
assert(unifiedSchedule.find(day => day.date === "2026-11-25").events.some(event => event.id === "day_2026-11-25"));
const excludedSchedule = preview.scheduleDays(preview.getBoardEvents(), "excluded");
assert(excludedSchedule.some(day => day.events.some(event => event.id === "calendar_fixture")));
assert(!excludedSchedule.some(day => day.events.some(event => event.id === "calendar_fixture-two")));

const visibilityStore = sharedEventVisibility(db, () => null, "isolated-test");
docs.set("calendar_fixture", { excluded: false });
await visibilityStore.importExcluded(["calendar_fixture", "calendar_fixture-two"]);
assert.equal(docs.get("calendar_fixture-two").excluded, true);
assert.equal(docs.get("calendar_fixture").excluded, false);

const csvEvent = { ...fixture, kindLabel: "試合", status: "active", statusLabel: "出欠受付中" };
const csvExcluded = { ...csvEvent, id: "excluded", status: "excluded", statusLabel: "出欠表から除外中" };
const csvInactive = { ...csvEvent, id: "inactive", status: "inactive", statusLabel: "カレンダー対象外" };
const csvOptions = { groups: ["players", "coaches"], states: ["active"], format: "detail" };
const csvPeople = (event, group) => group === "players" ? [
  { ...athlete, value: "attending", contactText: '=1+2, "引用"\n次の行', contact: { lateTime: "10:30" } },
  { name: "検証用・未回答", grade: "6年" }, { name: "検証用・対象外", restricted: "対象外", grade: "5年" }
] : [{ ...coach, value: "absent" }];
const fixtures = [csvEvent, csvExcluded, csvInactive];
const exportRows = options => buildAttendanceRows(fixtures, { ...csvOptions, ...options }, csvPeople);
assert.equal(exportRows({}).length, 5);
assert.equal(exportRows({ groups: ["coaches"] }).length, 2);
assert.equal(exportRows({ groups: ["players"] }).length, 4);
assert.equal(exportRows({ answer: "unanswered" }).length, 2);
assert.equal(exportRows({ answer: "restricted" }).length, 2);
assert.equal(exportRows({ grade: "6年" }).length, 4);
assert.equal(exportRows({ kind: "practice" }).length, 1);
assert.equal(exportRows({ from: "2026-12-01" }).length, 1);
assert.equal(exportRows({ format: "roster" }).length, 2);
assert.equal(exportRows({ format: "contact" }).length, 2);
assert.equal(exportRows({ format: "summary" }).length, 3);
assert.deepEqual(exportRows({ format: "summary" })[1].slice(-6), [2, 1, 0, 0, 1, 1]);
assert.equal(exportRows({ format: "summary", states: ["active", "excluded", "inactive"] }).length, 7);
assert.equal(exportRows({ states: ["excluded", "inactive"], eventId: "inactive" })[1][6], "カレンダー対象外");
const encoded = encodeAttendanceCsv(exportRows({format:"contact"}));
assert.equal(encoded[0], "\uFEFF");
assert(encoded.includes('"\'=1+2, ""引用""\n次の行"'));

const commonSource = fs.readFileSync(path.join(root, "common.js"), "utf8");
const calendarHtml = fs.readFileSync(path.join(root, "calendar.html"), "utf8");
const attendanceHtml = fs.readFileSync(path.join(root, "attendance.html"), "utf8");
assert.ok(commonSource.includes("const UPCOMING_DAYS = 90"), "カレンダーの取得期間が90日になっていません");
assert.ok(commonSource.includes("end.setDate(end.getDate() + UPCOMING_DAYS)"), "90日設定がAPI取得期間へ使われていません");
assert.ok(commonSource.includes('href="attendance.html#match-attendance"'), "カレンダーから参加案内への入口がありません");
assert.ok(commonSource.includes("if (!isCalendarPage) return;"), "出欠ページとカレンダーの表示分岐がありません");
assert.ok(attendanceHtml.includes('id="match-attendance"'), "出欠ページに試合参加案内の本体がありません");
assert.ok(attendanceHtml.includes('id="calendar-attendance-copy"'), "出欠ページにLINE一括コピーボタンがありません");
assert.ok(attendanceHtml.includes('id="calendar-attendance-category"'), "カテゴリー別の一括選択がありません");
assert.ok(attendanceHtml.includes('id="calendar-attendance-select-all"'), "全選択ボタンがありません");
assert.ok(attendanceHtml.includes('id="calendar-attendance-clear"'), "選択解除ボタンがありません");
assert.ok(commonSource.includes("selectedAttendanceKeys"), "選択した試合だけをコピーする処理がありません");
assert.ok(commonSource.includes("selectedEvents"), "LINE文生成へ選択結果を反映していません");
assert.ok(commonSource.includes("category.style.backgroundColor"), "カテゴリー色を画面へ反映していません");
assert.ok(attendanceHtml.includes('src="calendar-attendance.js"'), "出欠ページで調整さんURLの安全な抽出処理を読み込んでいません");
assert.equal(calendarHtml.includes('id="calendar-attendance-copy"'), false, "カレンダーHTMLに管理用のコピーボタンを重複配置しないでください");

console.log("OK: 調整さんURLの安全な抽出、試合・カテゴリー選択、カテゴリー色、LINE案内文、画面の役割分担を検査しました。");
