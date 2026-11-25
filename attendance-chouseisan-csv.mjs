const answers = new Map([
  ["○", "attending"], ["〇", "attending"], ["◯", "attending"],
  ["△", "maybe"], ["×", "absent"], ["✖", "absent"],
]);
const weekdayNames = "日月火水木金土";

function csvRows(text) {
  const rows = [];
  let row = [], value = "", quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') value += char;
      else if (text[i + 1] === '"') { value += '"'; i++; }
      else { quoted = false; closed = true; }
    } else if (char === "," || char === "\r" || char === "\n") {
      row.push(value);
      value = "";
      closed = false;
      if (char !== ",") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        rows.push(row);
        row = [];
      }
    } else if (char === '"' && !value && !closed) {
      quoted = true;
    } else if (closed || char === '"') {
      throw new Error("CSVの引用符を確認してください。");
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error("CSVの引用符を確認してください。");
  if (row.length || value || closed) rows.push([...row, value]);
  return rows;
}

export function parseChouseisanCsv(bytes) {
  let text;
  try {
    text = new TextDecoder("utf-8", {fatal:true}).decode(bytes);
  } catch {
    text = new TextDecoder("shift_jis", {fatal:true}).decode(bytes);
  }
  const rows = csvRows(text);
  const header = rows.findIndex(row => row.length > 1 && row[0].trim() === "日程");
  if (header < 0) throw new Error("調整さんからダウンロードした出欠表CSVを選んでください。");
  const names = rows[header].slice(1).map(name => name.trim());
  if (!names.some(Boolean)) throw new Error("CSVに回答者が見つかりません。");
  const dates = rows.slice(header + 1)
    .filter(row => row.some(cell => cell.trim()) && row[0].trim() !== "コメント")
    .map(row => {
      const label = row[0].trim();
      if (!label || row.length !== names.length + 1) throw new Error("CSVの日程と回答欄の数を確認してください。");
      return {label, answers:row.slice(1).map(cell => answers.get(cell.trim()) || "")};
    });
  if (!dates.length) throw new Error("CSVに日程が見つかりません。");
  return {title:header > 0 ? rows[0][0].trim() : "", names, dates};
}

export function matchesChouseisanDate(label, date) {
  const match = label.normalize("NFKC").match(/^(?:(\d{4})[/.-]|(?:(\d{4})年))?(\d{1,2})[/月.-](\d{1,2})(?:日)?\s*(?:\(\s*([日月火水木金土])(?:曜(?:日)?)?\s*\))?(?=\s|$|[^\d])/);
  if (!match) return false;
  const [, slashYear, kanjiYear, month, day, weekday] = match;
  const [year, targetMonth, targetDay] = date.split("-").map(Number);
  return (!(slashYear || kanjiYear) || Number(slashYear || kanjiYear) === year) &&
    Number(month) === targetMonth && Number(day) === targetDay &&
    (!weekday || weekday === weekdayNames[new Date(Date.UTC(year, targetMonth - 1, targetDay)).getUTCDay()]);
}
