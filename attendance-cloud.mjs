import { answers, attendanceStore, availableEvents, contactFromForm, contactLabel, reviewRows } from './attendance-cloud-service.mjs';

const $ = id => document.getElementById(id);
const entry = $('cloud-answer');
const login = $('cloud-login');
const params = new URLSearchParams(location.search);
const label = value => answers.find(option => option.value === value)?.label || '未回答';
let auth, store, account, events = [], people = [], mode = 'entry';
let authGeneration = 0, selectionGeneration = 0, subscriptions = [];
let record, conflict, saving = false, dirty = false;
let roster, replies;
let previousPerson = '', previousEvent = '';

function status(message) { $('cloud-status').textContent = message; }
function saveStatus(message) { $('cloud-save-status').textContent = message; }

function selection() {
  return {
    event: events.find(event => event.id === $('cloud-event').value),
    person: people[$('cloud-person').value]
  };
}

function clearSelection() {
  selectionGeneration++;
  for (const unsubscribe of subscriptions) unsubscribe();
  subscriptions = [];
  roster = replies = record = conflict = null;
  dirty = false;
  entry.reset();
  $('cloud-contact').open = false;
  entry.hidden = $('cloud-review').hidden = $('cloud-conflict').hidden = true;
  $('cloud-review-notice').hidden = true;
  $('cloud-import').hidden = true;
  $('cloud-rows').replaceChildren();
  $('cloud-counts').replaceChildren();
  saveStatus('');
}

function option(value, text) { return new Option(text, value); }
function setMode(newMode) {
  if (mode === newMode || !canLeave()) return;
  mode = newMode;
  $('show-entry').setAttribute('aria-pressed', String(mode === 'entry'));
  $('show-review').setAttribute('aria-pressed', String(mode === 'review'));
  $('person-field').hidden = mode === 'review';
  renderEvents();
}

function canLeave() {
  return !saving && (!dirty || confirm('保存していない入力を破棄して移動しますか？'));
}

function renderEvents(preferred = $('cloud-event').value) {
  const person = selection().person;
  const visible = mode === 'review' ? events.filter(event => event.kind === 'match' &&
    account.coachEvents?.[event.id] === true) : person ? availableEvents(events, account, person) : [];
  $('cloud-event').replaceChildren(option('', '日程・試合を選択'), ...visible.map(event =>
    option(event.id, event.date.replace(/-/g, '/') + ' · ' + event.title)));
  $('cloud-event').value = visible.some(event => event.id === preferred) ? preferred : '';
  $('cloud-event').disabled = !visible.length;
  status(visible.length ? '' : '表示できる日程がありません。');
  openSelection();
}

function populate(response) {
  entry.reset();
  for (const radio of entry.querySelectorAll('[name=value]')) radio.checked = radio.value === response.value;
  for (const [key, value] of Object.entries(response.contact || {})) {
    const field = entry.elements.namedItem(key);
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = value === true;
    else field.value = value;
  }
  $('cloud-contact').open = Boolean(contactLabel(response.contact));
}

function localResponse(event, person) {
  if (!event.localEventId) return null;
  try {
    const trial = JSON.parse(localStorage.getItem('yoshimi_smc_attendance_prototype_v1') || '{}');
    const value = trial.answers?.[event.localEventId]?.[person.kind === 'coach' ? 'coaches' : 'players']?.[person.id]?.value || '';
    const contact = person.kind === 'player' ? trial.matchNotes?.[event.localEventId]?.[person.id] || {} : {};
    return value || contactLabel(contact) ? { value, contact } : null;
  } catch { return null; }
}

async function openSelection() {
  clearSelection();
  $('cloud-save').textContent = '回答を保存';
  previousPerson = $('cloud-person').value;
  previousEvent = $('cloud-event').value;
  const token = selectionGeneration;
  const { event, person } = selection();
  const calendar = $('cloud-calendar');
  calendar.hidden = !event;
  if (!event) return;
  const query = new URLSearchParams({ date: event.date });
  if (event.kind === 'match' && event.localEventId) query.set('event', event.localEventId);
  calendar.href = 'calendar.html?' + query;
  if (mode === 'review') {
    $('cloud-review').hidden = false;
    $('cloud-review-title').textContent = event.title;
    $('cloud-review-meta').textContent = event.date.replace(/-/g, '/') + '　対象 ' +
      (event.targetGrades?.join('・') || '学年未設定');
    $('cloud-review-status').textContent = 'クラウドから読み込んでいます…';
    const failed = () => {
      if (token !== selectionGeneration) return;
      for (const unsubscribe of subscriptions) unsubscribe();
      subscriptions = [];
      roster = replies = null;
      $('cloud-rows').replaceChildren();
      $('cloud-counts').replaceChildren();
      $('cloud-review-status').textContent = '一覧を取得できませんでした。接続や閲覧権限を確認してください。';
    };
    subscriptions.push(store.watchRoster(event.id, value => {
      if (token === selectionGeneration) { roster = value; renderReview(); }
    }, failed));
    subscriptions.push(store.watchAnswers(event.id, value => {
      if (token === selectionGeneration) { replies = value; renderReview(); }
    }, failed));
    return;
  }
  if (!person) return;
  status('回答を読み込んでいます…');
  try {
    const current = await store.get(event.id, person);
    if (token !== selectionGeneration) return;
    record = current;
    status('');
    populate(current);
    $('cloud-contact').hidden = event.kind !== 'match' || person.kind !== 'player';
    $('cloud-import').hidden = !event.open || !localResponse(event, person);
    entry.hidden = false;
    for (const input of entry.querySelectorAll('fieldset, #cloud-contact input, #cloud-contact select, #cloud-contact textarea')) input.disabled = !event.open;
    $('cloud-save').disabled = !event.open;
    if (!event.open) saveStatus('この予定の回答受付は終了しています。');
    if (event.kind === 'match' && person.kind === 'player' && !record.value) {
      const practices = events.filter(item => item.kind === 'practice' && item.date === event.date);
      const previous = await Promise.allSettled(practices.map(item => store.get(item.id, person)));
      if (token === selectionGeneration) $('cloud-review-notice').hidden = !previous.some(item =>
        item.status === 'fulfilled' && item.value.value === 'attending');
    }
  } catch {
    if (token === selectionGeneration) status('回答を取得できませんでした。日程を選び直してください。');
  }
}

function renderReview() {
  if (!roster || !replies) return;
  const { event } = selection();
  const rows = reviewRows(event, roster, replies);
  $('cloud-counts').replaceChildren(...answers.map(answer => {
    const element = document.createElement('span');
    const count = rows.filter(row => row.value === answer.value).length;
    element.textContent = answer.label + ' ' + count + '人';
    return element;
  }));
  const filter = $('cloud-filter').value;
  const visible = rows.filter(row => {
    switch (filter) {
      case 'contact': return Boolean(contactLabel(row.contact));
      case 'ride': return row.contact.ride;
      case 'schedule': return row.contact.early || row.contact.late;
      case 'pending': return !row.value;
      default: return true;
    }
  });
  const body = $('cloud-rows');
  body.replaceChildren(...visible.map(row => {
    const tr = document.createElement('tr');
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = row.grade + '・' + row.name;
    const value = document.createElement('td');
    value.dataset.value = row.value;
    value.textContent = label(row.value);
    const notes = document.createElement('td');
    notes.textContent = contactLabel(row.contact) || '—';
    tr.append(name, value, notes);
    return tr;
  }));
  $('cloud-review-status').textContent = visible.length ? '表示 ' + visible.length + '人' : '該当する団員はいません。';
}

async function saveAnswer(revision = record?.revision) {
  const { event, person } = selection();
  if (!event?.open || !person || revision === undefined || saving) return;
  if (!navigator.onLine) {
    saveStatus('通信が切れています。入力は残っています。接続後に再試行してください。');
    $('cloud-save').textContent = '保存を再試行';
    return;
  }
  const data = new FormData(entry);
  const draft = { value: data.get('value') ?? '', contact: $('cloud-contact').hidden ? {} : contactFromForm(data) };
  const token = selectionGeneration;
  let retry = false;
  saving = true;
  $('cloud-logout').disabled = $('cloud-event').disabled = $('cloud-person').disabled = true;
  for (const control of entry.elements) control.disabled = true;
  $('cloud-conflict').hidden = true;
  saveStatus('クラウドに保存しています…');
  try {
    const savedRevision = await store.save(event.id, person, draft, revision);
    if (token !== selectionGeneration) return;
    record = { ...draft, revision: savedRevision };
    dirty = false;
    if (draft.value) $('cloud-review-notice').hidden = true;
    saveStatus('クラウドに保存しました。');
  } catch (error) {
    if (token !== selectionGeneration) return;
    saveStatus('クラウドに保存できませんでした。入力は残っています。');
    retry = true;
    if (error.message === 'revision-conflict') {
      try {
        conflict = await store.get(event.id, person);
        if (token !== selectionGeneration) return;
        $('cloud-latest').textContent = '別端末で変更されています。クラウドの最新回答は「' +
          label(conflict.value) + '」' + (contactLabel(conflict.contact) ? ' ・ ' + contactLabel(conflict.contact) : '') + 'です。';
        $('cloud-conflict').hidden = false;
      } catch { saveStatus('最新回答を取得できませんでした。接続後に再試行してください。'); }
    }
  } finally {
    saving = false;
    $('cloud-logout').disabled = $('cloud-event').disabled = $('cloud-person').disabled = false;
    if (token === selectionGeneration) {
      for (const control of entry.elements) control.disabled = false;
      $('cloud-save').textContent = retry ? '保存を再試行' : '回答を保存';
    }
  }
}

async function signedIn(user) {
  const token = ++authGeneration;
  clearSelection();
  account = null;
  events = people = [];
  $('cloud-person').replaceChildren();
  $('cloud-event').replaceChildren();
  $('cloud-workspace').hidden = true;
  login.hidden = Boolean(user);
  $('cloud-logout').hidden = !user;
  $('cloud-connect').hidden = true;
  if (!user) { status('登録済みのアカウントでログインしてください。'); return; }
  if (!user.emailVerified) { status('メールアドレスの確認を済ませ、ログインし直してください。'); return; }
  status('クラウドの利用権限を確認しています…');
  try {
    const grant = await store.account(user.uid);
    const schedule = await store.events();
    if (token !== authGeneration) return;
    account = grant;
    events = schedule.filter(event => !event.cancelled);
    people = Object.entries(grant.players || {}).map(([id, profile]) => ({ ...profile, id, kind: 'player' }));
    if (grant.coachId) people.push({ id: grant.coachId, name: grant.coachName || 'コーチ本人', kind: 'coach' });
    $('cloud-person').replaceChildren(...people.map((person, index) =>
      option(index, [person.grade, person.name].filter(Boolean).join('・'))));
    $('show-review').hidden = !events.some(event => event.kind === 'match' && grant.coachEvents?.[event.id] === true);
    $('cloud-workspace').hidden = false;
    mode = params.get('view') === 'review' && !$('show-review').hidden ? 'review' : 'entry';
    $('show-entry').setAttribute('aria-pressed', String(mode === 'entry'));
    $('show-review').setAttribute('aria-pressed', String(mode === 'review'));
    $('person-field').hidden = mode === 'review';
    renderEvents(events.find(event => event.localEventId && event.localEventId === params.get('event'))?.id);
  } catch (error) {
    if (token !== authGeneration) return;
    status(error.message === 'account-inactive' ? '利用権限が登録されていません。クラブの管理者へご連絡ください。' :
      error.message === 'cloud-disabled' ? 'クラウド出欠は公開準備中です。' : 'クラウドに接続できません。利用設定と通信環境をご確認ください。');
    $('cloud-connect').hidden = false;
  }
}

for (const answer of answers) {
  const element = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'value';
  input.value = answer.value;
  element.append(input, answer.label);
  $('cloud-answer-options').append(element);
}
$('show-entry').onclick = () => setMode('entry');
$('show-review').onclick = () => setMode('review');
$('cloud-person').onchange = () => {
  if (canLeave()) renderEvents();
  else $('cloud-person').value = previousPerson;
};
$('cloud-event').onchange = () => {
  if (canLeave()) openSelection();
  else $('cloud-event').value = previousEvent;
};
$('cloud-filter').onchange = renderReview;
entry.oninput = () => { dirty = true; };
entry.onsubmit = event => { event.preventDefault(); saveAnswer(); };
$('cloud-import').onclick = () => {
  const { event, person } = selection();
  const legacy = localResponse(event, person);
  if (!legacy) return;
  const text = 'この端末の試作回答：' + label(legacy.value) +
    (contactLabel(legacy.contact) ? ' ・ ' + contactLabel(legacy.contact) : '');
  if (!confirm(text + '\n入力欄に読み込みます。確認してから保存してください。')) return;
  populate(legacy);
  dirty = true;
  saveStatus(record.revision ? 'クラウドに既存の回答があります。置き換える場合は内容を確認して保存してください。' : '試作回答1件を読み込みました。内容を確認して保存してください。');
};
$('cloud-use-latest').onclick = () => {
  if (!conflict) return;
  record = conflict;
  conflict = null;
  populate(record);
  dirty = false;
  $('cloud-conflict').hidden = true;
  saveStatus('クラウドの最新回答を表示しました。');
};
$('cloud-keep-draft').onclick = () => { if (conflict) saveAnswer(conflict.revision); };
$('cloud-connect').onclick = () => signedIn(auth.currentUser);
$('cloud-logout').onclick = () => { if (canLeave()) auth.signOut(); };
login.onsubmit = async event => {
  event.preventDefault();
  const input = new FormData(login);
  const button = login.querySelector('button');
  button.disabled = true;
  try {
    await auth.signInWithEmailAndPassword(input.get('email'), input.get('password'));
    login.reset();
  } catch { status('ログインできません。登録済みのメールアドレスとパスワードを確認してください。'); }
  finally { button.disabled = false; }
};
if (typeof window.onFirebaseReady === 'function') {
  window.onFirebaseReady(async () => {
    try {
      auth = window.FIREBASE_AUTH;
      if (!auth) throw Error('auth-unavailable');
      if (!window.firebase.firestore) await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
      store = attendanceStore(window.firebase.firestore(), window.firebase.firestore.FieldValue.serverTimestamp);
      auth.onAuthStateChanged(signedIn, () => status('認証サービスに接続できませんでした。'));
    } catch { status('クラウド出欠を起動できませんでした。ページを開き直してください。'); }
  });
} else status('認証サービスを読み込めませんでした。');
