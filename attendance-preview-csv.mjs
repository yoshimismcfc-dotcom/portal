export const formatNames = {
  detail: "出欠明細",
  summary: "予定別集計",
  roster: "参加者名簿",
  contact: "連絡事項一覧"
};

const statuses = { attending: "参加", maybe: "未定", absent: "不参加", unanswered: "未回答" };
const scheduleHeaders = ["日付", "予定名", "種類", "カテゴリー", "開始時刻", "会場", "予定の状態", "区分"];

export function buildAttendanceRows(events, options, readPeople) {
  const extra = options.format === "summary" ?
    ["対象人数", ...Object.values(statuses), "対象外"] :
    ["氏名", "学年", "出欠", "最終更新"];
  if (options.format === "contact" || (options.comments && options.format !== "summary")) {
    extra.push("到着予定", "退出予定", "連絡事項", "備考");
  }
  const rows = [[...scheduleHeaders, ...extra]];
  for (const event of events) {
    if (!options.states.includes(event.status)) continue;
    if (options.eventId && event.id !== options.eventId) continue;
    if ((options.from && event.date < options.from) || (options.to && event.date > options.to)) continue;
    if (options.kind && event.kind !== options.kind) continue;
    if (options.category && event.category !== options.category) continue;
    for (const group of options.groups) {
      const base = [event.date, event.title, event.kindLabel, event.category || "", event.startTime || "", event.place || "",
        event.statusLabel, group === "players" ? "団員" : "コーチ"];
      const people = readPeople(event, group).filter(person => group !== "players" || !options.grade || person.grade === options.grade);
      if (options.format === "summary") {
        const eligible = people.filter(person => !person.restricted);
        const counts = Object.keys(statuses).map(status => eligible.filter(person => (person.value || "unanswered") === status).length);
        rows.push([...base, eligible.length, ...counts, people.length - eligible.length]);
        continue;
      }
      for (const person of people) {
        const status = person.restricted ? "restricted" : (person.value || "unanswered");
        if (options.answer && options.answer !== status) continue;
        if (options.format === "roster" && status !== "attending") continue;
        if (options.format === "contact" && !person.contactText) continue;
        const answer = person.restricted ? person.restricted + (person.value ? "（記録："+statuses[person.value]+"）" : "") : statuses[status];
        const row = [...base, person.name, person.grade || "", answer, person.updatedAt || ""];
        if (options.comments || options.format === "contact") {
          row.push(person.contact?.lateTime || "", person.contact?.earlyTime || "", person.contactText || "", person.note || "");
        }
        rows.push(row);
      }
    }
  }
  return rows;
}

export function encodeAttendanceCsv(rows) {
  function cell(value) {
    let text = String(value ?? "");
    if (/^(?:[\t\r\n]|[\s\u200b\ufeff]*[=+\-@＝＋－＠])/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n");
}
