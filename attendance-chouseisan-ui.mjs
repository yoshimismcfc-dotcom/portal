import { matchesChouseisanDate, parseChouseisanCsv } from "./attendance-chouseisan-csv.mjs";

export function initChouseisanImport({context, eventLabel, nameKey, saveAnswer}) {
  const byId = id => document.getElementById("chouseisan-" + id);
  const dialog = byId("dialog"), form = byId("form"), file = byId("file"), group = byId("group");
  const fields = byId("fields"), events = byId("events"), people = byId("people");
  const status = byId("status"), save = byId("save");
  let data, saving = false, previewKey = "";

  function option(value, label) {
    return new Option(label, value);
  }

  function selectRow(label, values, placeholder, selected) {
    const wrapper = document.createElement("label");
    const select = document.createElement("select");
    select.append(option("", placeholder), ...values.map(([value, title]) => option(value, title)));
    select.value = selected || "";
    wrapper.append(document.createTextNode(label), select);
    return wrapper;
  }

  function plan() {
    const current = context(group.value);
    const targets = [...events.querySelectorAll("select")].map(input => input.value);
    const ids = [...people.querySelectorAll("select")].map(input => input.value);
    const repeated = list => list.some((id, index) => id && list.indexOf(id) !== index);
    const jobs = [];
    let unmatched = 0, existing = 0, ineligible = 0;
    if (repeated(targets) || repeated(ids)) {
      return {jobs, message:"同じ予定または同じ人が複数選ばれています。選択を見直してください。"};
    }
    data.dates.forEach((row, dateIndex) => {
      const target = current.events.find(event => event.id === targets[dateIndex] &&
        matchesChouseisanDate(row.label, event.date));
      row.answers.forEach((value, personIndex) => {
        if (!value) return;
        const person = current.people.find(item => item.id === ids[personIndex]);
        if (!target || !person) { unmatched++; return; }
        if (current.existing(target, person)) { existing++; return; }
        if (!current.eligible(target, person)) { ineligible++; return; }
        jobs.push({personId:person.id, eventId:target.id, value});
      });
    });
    return {jobs, baseline:current.baseline, message:
      jobs.length+"件を取り込み可能。照合先未選択 "+unmatched+"件、回答済み "+existing+"件、対象外 "+ineligible+"件。"};
  }

  function refresh() {
    if (!data) return;
    const ready = plan();
    previewKey = JSON.stringify(ready.jobs);
    status.textContent = ready.message;
    save.disabled = !ready.jobs.length;
  }

  function renderSelections() {
    const current = context(group.value);
    events.replaceChildren(...data.dates.map(row => {
      const options = current.events.filter(event => matchesChouseisanDate(row.label, event.date))
        .map(event => [event.id, eventLabel(event)]);
      return selectRow(row.label, options, options.length ? "予定を選ぶ" : "同日の受付中の予定なし");
    }));
    people.replaceChildren(...data.names.map(name => {
      const matches = current.people.filter(person => nameKey(person.name) === nameKey(name));
      const options = current.people.map(person => [person.id, [person.name, person.grade].filter(Boolean).join("・")]);
      return selectRow(name || "名前が空欄", options, "取り込まない", name && matches.length === 1 ? matches[0].id : "");
    }));
    fields.hidden = false;
    refresh();
  }

  byId("close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", event => {
    if (saving) event.preventDefault();
  });
  file.addEventListener("change", async () => {
    const selected = file.files[0];
    data = undefined;
    fields.hidden = true;
    save.disabled = true;
    status.textContent = "";
    if (!selected) return;
    try {
      const parsed = parseChouseisanCsv(await selected.arrayBuffer());
      if (!dialog.open || file.files[0] !== selected) return;
      data = parsed;
      if (data.title.includes("コーチ")) group.value = "coaches";
      else if (data.title.includes("団員")) group.value = "players";
      byId("source").textContent = [data.title, data.names.length+"人・"+data.dates.length+"日程"].filter(Boolean).join("｜");
      renderSelections();
    } catch (error) {
      if (dialog.open && file.files[0] === selected) status.textContent = error.message;
    }
  });
  group.addEventListener("change", renderSelections);
  events.addEventListener("change", refresh);
  people.addEventListener("change", refresh);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!data || saving) return;
    const ready = plan();
    if (!ready.jobs.length || previewKey !== JSON.stringify(ready.jobs)) {
      refresh();
      status.textContent = "現在の予定または回答が変わりました。"+status.textContent;
      return;
    }
    if (!window.confirm(ready.jobs.length+"件を出欠表の空欄に保存しますか？")) return;
    saving = true;
    const controls = [...form.elements].filter(input => !input.disabled);
    controls.forEach(input => { input.disabled = true; });
    status.textContent = "出欠を保存中…";
    let saved = 0, conflicts = 0, failed = 0;
    try {
      for (const job of ready.jobs) {
        try {
          if (await saveAnswer(group.value, job, ready.baseline)) saved++;
          else conflicts++;
        } catch {
          failed++;
        }
      }
    } finally {
      saving = false;
      controls.forEach(input => { input.disabled = false; });
      refresh();
      status.textContent = "保存済み "+saved+"件、別の更新があったため保留 "+conflicts+"件、保存エラー "+failed+"件。"+status.textContent;
    }
  });

  return function openImportDialog() {
    form.reset();
    fields.hidden = true;
    data = undefined;
    save.disabled = true;
    status.textContent = "";
    dialog.showModal();
  };

}
