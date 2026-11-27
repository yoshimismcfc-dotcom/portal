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
  Intl, FormData, URLSearchParams, location: { hash: "" }, window: { SMCCalendarAttendance: attendance },
  localStorage: { getItem: () => null, setItem() {} }
};
vm.runInNewContext(previewSource.replace('document.addEventListener("DOMContentLoaded",init);', `
  todayISO = () => "2026-11-22";
  holidays["2026-11-23"] = "勤労感謝の日";
  globalThis.preview = {
    state, maxDate, cancelledMatchPracticeUpdates, familyChanged, familyUpdates, familyKey, editableDayEvents, calendarAttendanceSelection, getBoardEvents, groupBoardDays, countAnswers, renderEntryDay, applySharedAnswers, eligibility, matchRestriction,
    matchAttendanceTable, readEntryUpdates, eventListStatus,
    scheduleSummaryRow, scheduleCellSummary, matchCategories, dayHeading, compactCountMarks, scheduleDays, dayButton, detailChoices, attendanceEventTitle,
    setSeason(period) { seasonPeriod = validSeasonPeriod(period); },
    setSharedReady(value) { sharedReady = value; },
    setRecruitment(records) { recruitmentRows = new Map(records); },
    setVisibility(values) { eventVisibility = new Map(values); },
    useGroup(group) { audience = group; },
    sync(events, failed = []) {
      syncWeekendPractices(events, failed);
      calendarMatchesChecked = true;
      syncedCalendarEvents=events.map(calendarAttendanceEvent).filter(Boolean);
      return syncCalendarAttendance(syncedCalendarEvents, false, failed);
    }
  };
`), previewContext);
const preview = previewContext.preview;
for(const [today, end] of [
  ["2026-11-30", "2027-01-31"],
  ["2026-12-01", "2027-02-28"],
  ["2026-12-31", "2027-02-28"],
  ["2027-01-01", "2027-03-31"],
  ["2027-02-28", "2027-04-30"],
  ["2027-12-01", "2028-02-29"],
]){
  assert.equal(preview.maxDate(today),end);
}
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
const saturdayList = () => preview.groupBoardDays(preview.getBoardEvents().filter(event => event.date === "2026-11-28"))[0];
const nextMatch = {...match, sourceId:"second-match", title:"U8（2年）練習試合", label:"U8"};
const linkedPractice = {...practice, sourceId:"one-practice"};
preview.sync([linkedPractice, match, nextMatch]);
assert.equal(preview.calendarAttendanceSelection(saturdayList(),"calendar_fixture").title, match.title);
assert.equal(preview.calendarAttendanceSelection(saturdayList(),"calendar_second-match").title, nextMatch.title);
assert.equal(preview.calendarAttendanceSelection(saturdayList(),"calendar_one-practice").id, practiceId);
assert.equal(preview.calendarAttendanceSelection(saturdayList(),"calendar_missing"), undefined);
preview.sync([linkedPractice, {...linkedPractice, sourceId:"another-practice"}, match]);
assert.equal(preview.calendarAttendanceSelection(saturdayList(),"calendar_one-practice"), undefined);
preview.sync([practice, match, school, holidayBreak]);

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
preview.setSharedReady(true);
preview.state.answers[activity.id]={players:{[athlete.id]:{value:"attending"}}};
assert.match(preview.dayHeading(activityDay, [athlete]), /練習なし/);
assert.match(preview.scheduleSummaryRow([activityDay], [athlete]),
  /スポ少マラソンの団員の出欠集計。対象 1人、参加 1人、未定 0人、不参加 0人/);
preview.useGroup("coaches");
assert.equal(preview.countAnswers([activity], [coach], activityDay).eligible, 1);
assert.match(preview.scheduleSummaryRow([activityDay], [coach]), /スポ少マラソンのコーチの出欠集計。参加 0人、未定 0人、不参加 0人/);
assert.doesNotMatch(preview.scheduleSummaryRow([activityDay], [coach]), /対象|未回答/);
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

const coachPractice = { id: "coach-practice", date: matchDay.date, kind: "practice" };
const coachMatchA = { ...fixture, id: "coach-match-a", category: "U12" };
const coachMatchB = { ...fixture, id: "coach-match-b", category: "U12" };
const coachDay = { date: matchDay.date, practice: [coachPractice], matches: [coachMatchA, coachMatchB], activities: [] };
const secondCoach = { id: "coach-two", name: "検証用コーチ2" };
preview.setSharedReady(true);
preview.state.answers[coachPractice.id] = { coaches: { [coach.id]: { value: "attending" }, [secondCoach.id]: { value: "attending" } } };
preview.state.answers[coachMatchA.id] = { coaches: { [coach.id]: { value: "attending" }, [secondCoach.id]: { value: "absent" } } };
preview.state.answers[coachMatchB.id] = { coaches: { [coach.id]: { value: "attending" }, [secondCoach.id]: { value: "maybe" } } };
const coaches = [coach, secondCoach];
assert.match(preview.dayHeading(coachDay, coaches), /のコーチの出欠集計。参加 1人、未定 0人、不参加 1人/);
assert.match(preview.renderEntryDay(coachDay, secondCoach, true), /連絡事項（任意）.*name="message-coach-practice"/);
assert.deepEqual(
  [...preview.renderEntryDay(coachDay, secondCoach, true).matchAll(/name="answer-([^"]+)" value="attending"/g)].map(match => match[1]),
  [coachMatchA.id, coachMatchB.id, coachPractice.id],
);
const practiceNoteForm = new FormData();
practiceNoteForm.set("answer-coach-practice","attending");
practiceNoteForm.set("contact-coach-practice","1");
practiceNoteForm.set("message-coach-practice","練習に遅れます");
const practiceNote = preview.readEntryUpdates(practiceNoteForm, coach, [coachDay])[0];
assert.equal(practiceNote.value, undefined);
assert.equal(practiceNote.contact.message, "練習に遅れます");
assert.doesNotMatch(preview.dayHeading(coachDay, coaches), /対象|未回答/);
assert.match(preview.scheduleSummaryRow([coachDay], coaches), /data-count-event="coach-match-a"[^>]+data-count-group="coaches"[^>]+参加 1人、未定 0人、不参加 1人.*data-count-event="coach-match-b"[^>]+data-count-group="coaches"[^>]+参加 1人、未定 1人、不参加 0人/);
assert.doesNotMatch(preview.scheduleSummaryRow([coachDay], coaches), /対象|未回答/);
const coachCell = preview.dayButton(coachDay, coach);
assert.match(coachCell, /U12 ○/);
assert.equal((coachCell.match(/data-mark=/g)||[]).length, 1);
assert.doesNotMatch(coachCell, /練習 ×|data-mark="absent"/);
const absentPractice = { ...coachDay, practice: [{ ...coachPractice, id: "coach-absent-practice" }] };
preview.state.answers["coach-absent-practice"]={coaches:{[secondCoach.id]:{value:"absent"}}};
assert.match(preview.dayButton(absentPractice, secondCoach), /練習 ×/);
const matchOnly = { ...coachDay, practice: [], matches: [coachMatchA] };
assert.doesNotMatch(preview.dayButton(matchOnly, secondCoach), /data-mark|U12 ×/);
assert.match(preview.renderEntryDay(coachDay, coach, true), /data-coach-practice-note role="status"><strong>× 不参加/);
assert.deepEqual({ ...preview.countAnswers([coachPractice], coaches, coachDay) }, { eligible: 2, attending: 1, maybe: 0, absent: 1 });
const practiceAndMatchForm = new FormData();
practiceAndMatchForm.set("answer-"+coachPractice.id, "attending");
practiceAndMatchForm.set("answer-"+coachMatchA.id, "maybe");
assert(!preview.readEntryUpdates(practiceAndMatchForm, coach, [coachDay]).some(update => update.id === coachPractice.id));
practiceAndMatchForm.set("answer-"+coachMatchB.id, "absent");
assert(preview.readEntryUpdates(practiceAndMatchForm, coach, [coachDay]).some(update => update.id === coachPractice.id));
delete preview.state.answers[coachMatchA.id].coaches[coach.id];
delete preview.state.answers[coachMatchB.id].coaches[coach.id];
assert.match(preview.dayButton(coachDay, coach), /練習 ○/);
assert.equal(preview.state.answers[coachPractice.id].coaches[coach.id].value, "attending");

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
  return preview.scheduleSummaryRow(days, [athlete, extraPlayer]);
};
const practiceWithMatches = preview.groupBoardDays(preview.getBoardEvents()).find(day => day.date === "2026-11-28");
const practiceOnlyPlayer = { id: "practice-only", grade: "4年" };
const youngerMatchPlayer = { id: "younger-match", grade: "2年" };
const practicePeople = [athlete, extraPlayer, practiceOnlyPlayer, youngerMatchPlayer];
const practiceDayHeading = preview.dayHeading(practiceWithMatches, practicePeople);
assert.match(practiceDayHeading, /練習の団員の出欠集計。対象 1人/);
assert.doesNotMatch(practiceDayHeading, /対象 延べ|参加 1人/);
assert.match(preview.dayHeading({ ...practiceWithMatches, matches: [] }, practicePeople), /対象 4人/);
assert.match(preview.dayHeading({ ...practiceWithMatches, practice: [] }, practicePeople), /練習なし/);
const totalsMarkup = categoryRows();
const combinedDay = {
  ...practiceWithMatches,
  activities: [
    { ...activity, date: practiceWithMatches.date },
    { id: "holiday-example", date: practiceWithMatches.date, kind: "activity", title: "祝日の出欠", holidayAvailability: true }
  ]
};
const combinedMarkup = preview.scheduleSummaryRow([combinedDay], [athlete, extraPlayer]);
assert.match(combinedMarkup, /<td class="board-schedule-cell">.*U12 試合.*U8 試合.*class="board-schedule-label">行事<.*スポ少マラソン.*class="board-schedule-label">祝日出欠<.*data-count-event="holiday-example"[^>]+data-count-kind="activity".*<\/td><\/tr>/);

assert.equal(Array.from(totalsMarkup.matchAll(/<tr\b/g)).length, 1);
assert.match(totalsMarkup, /scope="row">予定<.*?<td aria-label="試合・行事・祝日の出欠予定なし"><\/td><td class="board-schedule-cell">/);
assert.match(totalsMarkup, /class="board-schedule-label">U12 試合<.*?class="board-schedule-label">U8 試合</);
assert.equal(preview.scheduleCellSummary({ ...practiceWithMatches, matches: [] }, []), "");
assert.equal(preview.scheduleSummaryRow([{ ...practiceWithMatches, matches: [] }], []), "");
const unorderedCategories = ["U10", "U8", "", "U12", "U7", "U11", "U9"].map(category => ({ category }));
assert.deepEqual(Array.from(preview.matchCategories(unorderedCategories).keys()),
  ["U12", "U11", "U10", "U9", "U8", "U7", "その他"]);
assert.doesNotMatch(totalsMarkup, /class="board-schedule-label">U7 試合</);
assert.match(totalsMarkup, /出欠予定なし/);
assert.match(totalsMarkup, /data-count-event="calendar_fixture"[^>]+data-count-group="players"[^>]+参加 1人、未定 0人、不参加 0人.*data-count-event="calendar_fixture-two"[^>]+data-count-group="players"[^>]+参加 0人、未定 1人、不参加 0人/);
preview.setVisibility([["calendar_fixture", true]]);
assert.match(categoryRows(), /data-count-event="calendar_fixture-two"[^>]+data-count-group="players"[^>]+対象 1人、参加 0人、未定 1人、不参加 0人/);
preview.setSharedReady(false);
assert.match(categoryRows(), /集計待ち/);
preview.setSharedReady(true);

const narrowDay = preview.groupBoardDays(preview.getBoardEvents()).find(day => day.date === "2026-11-25");
const narrowHeading = preview.dayHeading(narrowDay, [athlete]);
assert.match(narrowHeading, /href="calendar.html\?date=2026-11-25"/);
assert.match(narrowHeading, /data-count-date="2026-11-25" data-count-kind="practice" data-count-group="players"[^>]*><span class="role-count-label"/);
assert.equal(preview.attendanceEventTitle({ kind:"match", category:"U8", title:"Ｕ８(２年)北坂戸大会" }), "Ｕ８(２年)北坂戸大会");
assert.deepEqual(Array.from(preview.detailChoices(practiceWithMatches,"match","U12"), item=>item.id),
  ["calendar_fixture","calendar_fixture-two"]);
assert.equal(preview.detailChoices(practiceWithMatches,"match","U8").length,1);
assert.equal(preview.detailChoices(practiceWithMatches,"practice","").length,1);
assert.doesNotMatch(narrowHeading, /▦|練習・行事|未回答/);
assert.match(narrowHeading, /data-count-kind="practice" data-count-group="coaches"/);
assert.doesNotMatch(categoryRows(), /category-count-context/);
const formattedCounts = preview.compactCountMarks({ attending: 12, maybe: 10, absent: 11 });
assert.match(formattedCounts, /data-mark="attending"[^>]*><\/i>12/);
assert.match(formattedCounts, /data-mark="maybe"[^>]*><\/i>10/);
assert.match(formattedCounts, /data-mark="absent"[^>]*><\/i>11/);

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

const wholeTeamGirls = makeEvent("埼玉県U10（4年•３年女子）大会", "2026-11-29",
  { label: "全体", sourceId: "whole-girls" });
assert(preview.sync([practice, match, otherFixture, u8, wholeTeamGirls]));
const linkedGirls = preview.getBoardEvents().find(event => event.id === "calendar_whole-girls");
assert.equal(linkedGirls.category, "U10");
assert.deepEqual(Array.from(linkedGirls.targetGrades), ["4年", "3年"]);
assert.equal(preview.eligibility(linkedGirls, { grade: "4年", gender: "f" }, "players"), "");
assert.equal(preview.eligibility(linkedGirls, { grade: "4年", gender: "m" }, "players"), "対象外");
assert(preview.sync([practice, match, otherFixture, u8], ["全体"]));
assert(preview.getBoardEvents().some(event => event.id === "calendar_whole-girls"));

const reserveMatch = makeEvent("U12（6～5年）中部大会　予備日", "2026-11-29",
  { label: "U12", sourceId: "reserve-match" });
const reservePlaceholder = makeEvent("予備日", "2026-11-29",
  { label: "U12", sourceId: "reserve-placeholder" });
const cancelledReserve = { ...reserveMatch, sourceId: "reserve-cancelled", status: "cancelled" };
assert(preview.sync([practice, match, otherFixture, u8, wholeTeamGirls, reserveMatch, reservePlaceholder, cancelledReserve]));
const reserveDay = preview.groupBoardDays(preview.getBoardEvents()).find(day => day.date === "2026-11-29");
assert.deepEqual(Array.from(reserveDay.matches, event => event.id).sort(), ["calendar_reserve-match", "calendar_whole-girls"]);
const linkedReserve = reserveDay.matches.find(event => event.id === "calendar_reserve-match");
assert.deepEqual(Array.from(linkedReserve.targetGrades), ["6年", "5年"]);
assert.equal(preview.countAnswers([linkedReserve], [athlete, extraPlayer]).eligible, 2);
assert.equal(preview.countAnswers([linkedReserve], [athlete, extraPlayer]).attending, 0);
assert.deepEqual(dateIds("2026-11-28"), [practiceId, "calendar_fixture-two", "calendar_u8"]);

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
assert.ok(commonSource.includes("if (!isCalendarPage) return;"), "出欠ページとカレンダーの表示分岐がありません");
const inviteSource = fs.readFileSync(path.join(root, "attendance-line-invite.js"), "utf8");
const inviteContext = {URL,URLSearchParams};
vm.runInNewContext(inviteSource,inviteContext);
const invites = inviteContext.SMCAttendanceLineInvite;
const inviteFixtures = [
  {id:"calendar_same%2Fsecond",date:"2026-11-28",category:"U8",title:"同日の後の試合",startTime:"12:00"},
  {id:"calendar_first",date:"2026-11-27",category:"U12",title:"前日の試合",meeting:"08:00",place:"会場"},
  {id:"calendar_same%2Ffirst",date:"2026-11-28",category:"U8",title:"同日の先の試合",startTime:"09:00"},
];
const inviteBase = "https://example.test/portal/attendance-preview.html?line-invite=1";
const copied = invites.buildMessage(inviteFixtures,inviteBase,String);
assert(copied.indexOf("前日の試合")<copied.indexOf("同日の先の試合"));
assert(copied.indexOf("同日の先の試合")<copied.indexOf("同日の後の試合"));
assert.match(copied,/集合 08:00\n会場 会場/);
assert.doesNotMatch(copied,/chouseisan\.com|調整さん/);
assert.equal((copied.match(/お子さんの名前/g)||[]).length,1);
for(const event of inviteFixtures){
  const link=new URL(invites.matchUrl(event,inviteBase));
  assert.equal(link.pathname,"/portal/attendance-preview.html");
  assert.equal(link.searchParams.get("match"),event.id);
  assert.equal(link.searchParams.get("date"),event.date);
  assert(!link.searchParams.has("line-invite"));
  assert(copied.includes(link.href));
}
assert(commonSource.includes('href="attendance-preview.html?line-invite=1"'));
assert(attendanceHtml.includes('id="match-attendance"'));
assert(attendanceHtml.includes('href="attendance-preview.html?line-invite=1"'));
assert(!attendanceHtml.includes('id="calendar-attendance-copy"'));
assert(!calendarHtml.includes('id="line-invite-copy"'));
const previewHtml = fs.readFileSync(path.join(root, "attendance-preview.html"), "utf8");
assert(previewHtml.includes('id="line-invite-copy"'));
assert(previewHtml.includes('id="line-invite-category"'));
assert(previewHtml.includes('id="export-csv"'));
assert(previewSource.includes('openAttendanceDetail(match.date,"match","",match.id,null,"players")'));
console.log("OK: 試合順・カテゴリー・保護者案内の試合別URLとCSV出力を検査しました。");

// The year-end interval crosses into January and uses saved calendar IDs for replies.
preview.setSeason({ start:"2026-12-28", end:"2027-01-07" });
const seasonalPractice = makeEvent("臨時練習（5年・4年）","2026-12-29", { label:"全体", sourceId:"year-practice" });
const firstKick = makeEvent("初蹴り（全学年）","2027-01-02", { label:"全体", sourceId:"first-kick", kind:"event" });
const seasonalMatch = makeEvent("新春交流戦（2年）","2027-01-02", { label:"U8", sourceId:"new-year-match" });
const movedPractice = { ...seasonalPractice, start:"2027-01-04", location:"変更後の会場" };
assert(preview.sync([seasonalPractice, firstKick, seasonalMatch, holidayBreak]));
assert.deepEqual(dateIds("2026-12-30"), []);
assert.deepEqual(dateIds("2027-01-07"), []);
assert.deepEqual(dateIds("2027-01-13"), ["day_2027-01-13"]);
assert.deepEqual(dateIds("2026-12-29"), ["calendar_year-practice"]);
assert.deepEqual(dateIds("2027-01-02"), ["calendar_first-kick", "calendar_new-year-match"]);
const yearDay = () => preview.groupBoardDays(preview.getBoardEvents()).find(day=>day.practice.some(event=>event.id==="calendar_year-practice"));
const eligiblePlayer={id:"year-player",grade:"4年"};
assert.equal(preview.eligibility(yearDay().practice[0],eligiblePlayer,"players"),"");
assert.equal(preview.eligibility(yearDay().practice[0],athlete,"players"),"対象外");
assert.equal(preview.eligibility(yearDay().practice[0],coach,"coaches"),"");
preview.state.answers["calendar_year-practice"]={players:{[eligiblePlayer.id]:{value:"attending",contact:{message:"練習連絡"}}}};
assert(preview.sync([movedPractice, firstKick, seasonalMatch]));
assert.deepEqual(dateIds("2026-12-29"), []);
assert.deepEqual(dateIds("2027-01-04"), ["calendar_year-practice"]);
preview.useGroup("players");
assert.equal(preview.countAnswers(yearDay().practice,[eligiblePlayer],yearDay()).attending,1);
assert.match(preview.matchAttendanceTable(yearDay().practice[0],[eligiblePlayer],"players",yearDay()),/練習連絡/);
assert(preview.sync([seasonalMatch],["全体"]));
assert.deepEqual(dateIds("2027-01-04"), ["calendar_year-practice"]);
assert.deepEqual(dateIds("2027-01-02"), ["calendar_first-kick", "calendar_new-year-match"]);
assert(preview.sync([{ ...movedPractice, status:"cancelled" },firstKick,seasonalMatch]));
assert.deepEqual(dateIds("2027-01-04"), []);
assert(preview.sync([movedPractice,firstKick,seasonalMatch]));
assert.equal(preview.countAnswers(yearDay().practice,[eligiblePlayer],yearDay()).attending,1);
assert(preview.sync([firstKick,seasonalMatch]));
assert.deepEqual(dateIds("2027-01-04"), []);
assert.equal(preview.state.answers["calendar_year-practice"].players[eligiblePlayer.id].value,"attending");
preview.setSeason(null);
assert.deepEqual(dateIds("2026-12-30"), ["day_2026-12-30"]);

// Holiday availability remains separate from a subsequently confirmed match.
const holidayDate = "2026-11-23";
const holidayId = "day_"+holidayDate;
const holidayMatch = makeEvent("U12（6年）祝日交流戦", holidayDate, {label:"U12",sourceId:"holiday-match"});
const holidayDay = () => preview.groupBoardDays(preview.getBoardEvents()).find(day=>day.date===holidayDate);
assert(preview.sync([]));
assert.equal(holidayDay().practice.length,0);
assert.equal(holidayDay().activities[0].title,"祝日・試合に備えた出欠確認");
assert.match(preview.renderEntryDay(holidayDay(),athlete,true), /試合に備えた出欠確認.*連絡事項（任意）/);
assert(preview.sync([holidayMatch]));
assert.deepEqual(dateIds(holidayDate), ["calendar_holiday-match"]);
preview.state.answers[holidayId]={players:{[athlete.id]:{value:"maybe",contact:{message:"事前連絡"}}}};
assert.deepEqual(dateIds(holidayDate), [holidayId,"calendar_holiday-match"]);
assert.equal(holidayDay().activities[0].holidayReference,true);
assert.match(preview.scheduleSummaryRow([holidayDay()],[athlete]), /参照のみ/);
assert.doesNotMatch(preview.renderEntryDay(holidayDay(),athlete,true), /試合に備えた出欠確認/);
assert.match(preview.matchAttendanceTable(holidayDay().activities[0],[athlete],"players",holidayDay()), /事前連絡/);
assert.match(preview.renderEntryDay(holidayDay(),athlete,true), /祝日交流戦/);
assert(preview.sync([]));
assert.equal(holidayDay().activities[0].holidayReference,false);
assert.equal(preview.countAnswers(holidayDay().activities,[athlete],holidayDay()).maybe,1);

// A parent coach and children use isolated selections even for the same date.
const sibling = {id:"family-sibling",name:"検証用兄弟",grade:"2年"};
const older = {...athlete,id:"family-older"};
const parent = {...coach,id:"family-parent"};
const familyPractice = {id:"family-training",date:"2026-11-28",kind:"practice"};
const olderGame = {id:"family-u12",date:familyPractice.date,kind:"match",targetGrades:["6年"]};
const youngerGame = {id:"family-u8",date:familyPractice.date,kind:"match",targetGrades:["2年"]};
const familyDay = {date:familyPractice.date,practice:[familyPractice],matches:[olderGame,youngerGame],activities:[]};
const practiceAfterCancellation = {...familyDay,matches:[youngerGame]};
preview.state.answers[olderGame.id] = {
  players:{[older.id]:{value:"maybe",contact:{late:true}}},
  coaches:{[parent.id]:{value:"attending"}},
};
const transferRoster = {players:[older,sibling],coaches:[parent]};
const transfers = (day, removed, hasAnswer = () => false) =>
  Array.from(preview.cancelledMatchPracticeUpdates([day],removed,transferRoster,hasAnswer), job => ({...job}));
assert.deepEqual(transfers(practiceAfterCancellation,[olderGame]), [
  {group:"players",personId:older.id,id:familyPractice.id,value:"maybe"},
  {group:"coaches",personId:parent.id,id:familyPractice.id,value:"attending"},
]);
assert.deepEqual(transfers(practiceAfterCancellation,[olderGame],(_event,person) => person===older)
  .map(job => job.personId), [parent.id]);
const otherActive = {...olderGame,id:"other-active"};
assert.deepEqual(transfers({...familyDay,matches:[otherActive]},[olderGame]).map(job => job.personId), [parent.id]);
assert.deepEqual(transfers({...practiceAfterCancellation,practice:[]},[olderGame]), []);
preview.state.answers[youngerGame.id] = {coaches:{[parent.id]:{value:"attending"}}};
assert.deepEqual(transfers(practiceAfterCancellation,[olderGame]).map(job => job.personId), [older.id]);
const otherRemoved = {...olderGame,id:"other-removed"};
preview.state.answers[otherRemoved.id] = {players:{[older.id]:{value:"absent"}}};
assert.deepEqual(transfers({...familyDay,matches:[]},[olderGame,otherRemoved]).map(job => job.personId), [parent.id]);
delete preview.state.answers[olderGame.id];
delete preview.state.answers[youngerGame.id];
delete preview.state.answers[otherRemoved.id];

const familySection = values => ({querySelectorAll:()=>Object.entries(values).map(([key,value])=>({
  dataset:{familyField:key},value
}))});
const entryFor = (group,person,values,day=familyDay) => Array.from(preview.familyUpdates(familySection(values),{group,person},day));
assert.equal(preview.familyKey("players","same"),"players:same");
assert.notEqual(preview.familyKey("players","same"),preview.familyKey("coaches","same"));
for(const player of [older,sibling]){
  assert.equal(entryFor("players",player,{"answer-family-training":"attending"},{...familyDay,matches:[]})[0].value,"attending");
}
const sharedChoices={"answer-family-training":"attending","answer-family-u12":"attending","answer-family-u8":"maybe"};
assert.deepEqual(entryFor("players",older,sharedChoices).map(x=>x.id), ["family-u12"]);
assert.deepEqual(entryFor("players",sibling,sharedChoices).map(x=>x.id), ["family-u8"]);
assert.deepEqual(entryFor("coaches",parent,sharedChoices).map(x=>x.id), ["family-u12","family-u8"]);
assert.equal(preview.familyChanged({value:"attending",contact:{late:true,message:"遅刻"}},
  {value:"attending",contact:{message:"遅刻",late:true}}),false);
assert.equal(preview.familyChanged({value:"maybe"},{value:"attending"}),true);

assert.deepEqual(Array.from(preview.editableDayEvents(familyDay, older, "players", olderGame.id), event => event.id), [olderGame.id]);
assert.deepEqual(Array.from(preview.editableDayEvents(familyDay, sibling, "players", olderGame.id)), []);
assert.deepEqual(Array.from(preview.editableDayEvents(familyDay, parent, "coaches", youngerGame.id), event => event.id), [youngerGame.id]);
assert.match(preview.matchAttendanceTable(olderGame, [older], "players", familyDay, true), /data-participant="family-older" data-participant-group="players"/);
assert.doesNotMatch(preview.matchAttendanceTable(olderGame, [sibling], "players", familyDay, true), /data-participant=/);

// The shared participant list keeps roster order for ties and uses the latest answers.
const rosterForOrder = ["未回答・先", "欠席", "参加・先", "未定", "参加・後", "未回答・後"].map((name, id) => ({id: String(id), name}));
const eventForOrder = {...olderGame,id:"answer-order-example"};
const orderedNames = (group) => Array.from(
  preview.matchAttendanceTable(eventForOrder, rosterForOrder, group).matchAll(/class="match-attendance-name">([^<]*)/g),
  match => match[1]
);
const repliesForOrder = {
  1:{value:"absent"}, 2:{value:"attending"}, 3:{value:"maybe"}, 4:{value:"attending"}
};
preview.state.answers[eventForOrder.id] = {players:{...repliesForOrder},coaches:{...repliesForOrder}};
for (const group of ["players","coaches"]) {
  assert.deepEqual(orderedNames(group), ["参加・先", "参加・後", "未定", "欠席", "未回答・先", "未回答・後"]);
  preview.state.answers[eventForOrder.id][group][0] = {value:"attending"};
  assert.deepEqual(orderedNames(group), ["未回答・先", "参加・先", "参加・後", "未定", "欠席", "未回答・後"]);
}
assert.deepEqual(rosterForOrder.map(person=>person.id), ["0","1","2","3","4","5"]);

assert.match(preview.scheduleSummaryRow([holidayDay()], [athlete]), /class="board-schedule-label">祝日出欠(?:（参考）)?<\/span>/);
