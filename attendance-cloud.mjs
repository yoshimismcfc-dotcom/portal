import { answers, attendanceStore, availableEvents, contactFromForm, contactLabel, reviewRows,
  guestCredentials, guestAttendanceStore, latestAttendance } from './attendance-cloud-service.mjs?v=20261121-23';

const $ = id => document.getElementById(id);
const entry = $('cloud-answer');
const login = $('cloud-login');
const params = new URLSearchParams(location.search);
const guest = guestCredentials(location.hash);
const label = value => answers.find(option => option.value === value)?.label || '未回答';
let auth, store, cloudStore, account, events = [], people = [], mode = 'entry';
let authGeneration = 0, selectionGeneration = 0, subscriptions = [];
let record, conflict, saving = false, dirty = false;
let roster, replies, guestLinks, publicNotices = [];
let displayedLink = null;
let guestAlias = '';
let showLogin = params.get('view') === 'review';
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
  roster = replies = guestLinks = record = conflict = null;
  dirty = false;
  entry.reset();
  $('cloud-contact').open = false;
  entry.hidden = $('cloud-review').hidden = $('cloud-conflict').hidden = true;
  $('cloud-review-notice').hidden = true;
  $('cloud-import').hidden = true;
  $('cloud-rows').replaceChildren();
  $('cloud-counts').replaceChildren();
  hideGuestLink();
  $('guest-link-person').replaceChildren();
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
  entry.elements.namedItem('publicName').value = response.publicName && response.publicName !== guestAlias ? response.publicName : '';
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
    $('cloud-date-heading').textContent = shortDate(event.date);
    $('cloud-review-meta').textContent = event.date.replace(/-/g, '/') + '　対象 ' +
      (event.targetGrades?.join('・') || '学年未設定');
    $('cloud-review-status').textContent = 'クラウドから読み込んでいます…';
    $('public-notice-message').value = publicNotices.find(notice => notice.id === event.id)?.message || '';
    $('publish-notice-status').textContent = '';
    const failed = () => {
      if (token !== selectionGeneration) return;
      for (const unsubscribe of subscriptions) unsubscribe();
      subscriptions = [];
      roster = replies = guestLinks = null;
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
    subscriptions.push(store.watchGuestLinks(event.id, value => {
      if (token === selectionGeneration) { guestLinks = value; renderReview(); }
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
  if (!roster || !replies || !guestLinks) return;
  const { event } = selection();
  const rows = reviewRows(event, roster, latestAttendance(replies, guestLinks));
  const previous = $('guest-link-person').value;
  $('guest-link-person').replaceChildren(option('', '団員を選択'), ...rows.map(row => option(row.id,row.grade+'・'+row.name)));
  $('guest-link-person').value = rows.some(row => row.id === previous) ? previous : '';
  $('manage-guest-link').disabled = !event.open;
  $('cloud-counts').replaceChildren(...countRows(rows));
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
  $('cloud-rows').replaceChildren(...attendanceRows(visible));
  $('cloud-review-status').textContent = visible.length ? '表示 ' + visible.length + '人' : '該当する団員はいません。';
}

function shortDate(date) {
  const day = new Date(date+'T00:00:00+09:00');
  return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short'}).format(day);
}

function countRows(rows) {
  return answers.map(answer => {
    const row = document.createElement('tr');
    row.className = 'cloud-table-total';
    const title = document.createElement('th');
    title.scope = 'row';
    title.textContent = answer.label;
    const count = document.createElement('td');
    count.textContent = rows.filter(person => person.value === answer.value).length+'人';
    row.append(title,count,document.createElement('td'));
    return row;
  });
}

function attendanceRows(rows) {
  return rows.map(person => {
    const row = document.createElement('tr');
    const name = document.createElement('th');
    name.scope = 'row';
    name.className = 'cloud-attendance-name';
    if (person.grade) {
      const grade = document.createElement('span');
      grade.className = 'cloud-attendance-grade';
      grade.textContent = person.grade;
      name.append(grade);
    }
    name.append(document.createTextNode((person.grade ? ' ' : '') + person.name));
    const answer = document.createElement('td');
    const symbol = document.createElement('span');
    const marks = {attending:'○',maybe:'△',absent:'×'};
    answer.dataset.value = person.value || '';
    answer.className = 'cloud-attendance-answer';
    answer.setAttribute('aria-label',person.value === undefined ? '表示なし' : label(person.value));
    symbol.textContent = marks[person.value] || '—';
    symbol.setAttribute('aria-hidden','true');
    answer.append(symbol);
    const notes = document.createElement('td');
    notes.textContent = contactLabel(person.contact) || '—';
    row.append(name,answer,notes);
    return row;
  });
}

async function renderPublicMatches() {
  $('public-notices').hidden = false;
  const list = $('public-notice-list');
  const statusLine = $('public-notice-status');
  const [notices,comments] = await Promise.allSettled([cloudStore.publicNotices(),cloudStore.publicCoordination()]);
  if (notices.status === 'fulfilled') publicNotices = notices.value;
  const games = new Map(publicNotices.map(notice => [notice.id,{...notice,rows:[]}]));
  for (const item of comments.status === 'fulfilled' ? comments.value : []) {
    if (!games.has(item.eventId)) games.set(item.eventId,{ ...item,id:item.eventId,rows:[] });
    games.get(item.eventId).rows.push({name:item.name,value:item.value,contact:item});
  }
  const sorted = [...games.values()].sort((a,b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title,'ja'));
  list.replaceChildren(...sorted.map(game => {
    const article = document.createElement('article');
    article.className = 'public-notice';
    article.id = 'notice-'+game.id;
    const heading = document.createElement('h2');
    heading.textContent = shortDate(game.date)+' · '+game.title;
    article.append(heading);
    if (game.message) {
      const message = document.createElement('p');
      message.textContent = game.message;
      article.append(message);
    }
    if (game.rows.length) {
      const wrap = document.createElement('div');
      wrap.className = 'cloud-table-wrap';
      wrap.tabIndex = 0;
      wrap.setAttribute('role','region');
      wrap.setAttribute('aria-label',game.title+'の出欠・コメント');
      const table = document.createElement('table');
      table.className = 'cloud-table';
      const header = table.createTHead().insertRow();
      for (const name of ['参加者',shortDate(game.date),'コメント']) {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.textContent = name;
        header.append(cell);
      }
      const totals = table.createTBody();
      const responses = game.rows.filter(row => row.value !== undefined);
      if (responses.length) totals.append(...countRows(responses));
      table.createTBody().append(...attendanceRows(game.rows));
      wrap.append(table);
      article.append(wrap);
      const caption = document.createElement('small');
      caption.textContent = '人数はコメントが公開されている回答の集計です。';
      article.append(caption);
    }
    const link = document.createElement('a');
    link.href = 'attendance-cloud.html?'+new URLSearchParams({notice:game.id});
    link.textContent = 'この試合の一覧';
    article.append(link);
    return article;
  }));
  statusLine.textContent = notices.status === 'rejected' || comments.status === 'rejected'
    ? '試合の連絡を一部取得できませんでした。' : sorted.length ? '' : '掲載中の試合はありません。';
  const selected = params.get('notice') || guest?.event;
  if (selected && !guest) $('notice-'+selected)?.scrollIntoView({block:'start'});
}

function hideGuestLink() {
  displayedLink = null;
  $('guest-link-url').value = '';
  $('guest-link-result').hidden = $('copy-guest-link').hidden = $('revoke-guest-link').hidden = true;
  $('guest-link-status').textContent = '';
}

async function openGuest() {
  const token = ++authGeneration;
  $('cloud-workspace').hidden = true;
  login.hidden = $('open-cloud-login').hidden = $('cloud-logout').hidden = true;
  try {
    const grant = await store.prepare();
    if (token !== authGeneration) return;
    events = [{ id:guest.event, title:grant.title, date:grant.date, kind:grant.kind, localEventId:grant.localEventId, open:true }];
    people = [{ id:grant.personId, name:grant.personName, kind:'player' }];
    $('cloud-person').replaceChildren(option('0',grant.personName));
    $('cloud-event').replaceChildren(option(guest.event,grant.title));
    $('cloud-tabs').hidden = $('person-field').hidden = $('event-field').hidden = true;
    $('guest-heading').hidden = false;
    $('guest-title').textContent = grant.title;
    $('guest-person').textContent = grant.date.replace(/-/g,'/')+' · '+grant.personName;
    guestAlias = grant.coordinationId ? '保護者 '+grant.coordinationId.slice(0,6).toUpperCase() : '';
    $('coordinate-choice').hidden = grant.kind !== 'match' || !guestAlias;
    $('coordination-alias').textContent = guestAlias ? '空欄の場合は「'+guestAlias+'」と表示します。' : '';
    $('cloud-workspace').hidden = false;
    $('cloud-connect').hidden = true;
    openSelection();
  } catch {
    if (token !== authGeneration) return;
    status('回答用リンクを開けませんでした。公開状況、リンクの有効期限、通信環境をご確認ください。');
    $('cloud-connect').hidden = false;
  }
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
  if (guest && guestAlias) {
    const { ride, early, late } = draft.contact;
    draft.publicName = ride || early || late ? String(data.get('publicName') || '').trim().slice(0,24) || guestAlias : '';
  }
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
    if (guest && guestAlias) renderPublicMatches();
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
  login.hidden = Boolean(user) || !showLogin;
  $('open-cloud-login').hidden = Boolean(user) || showLogin || !auth;
  $('cloud-logout').hidden = !user;
  $('cloud-connect').hidden = true;
  if (!user) {
    status(showLogin ? '登録済みのアカウントでログインしてください。' : '出欠を回答するときは、コーチから届いた回答用リンクを開いてください。');
    return;
  }
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
      error.message === 'cloud-disabled' ? '試合の出欠は公開準備中です。' : 'クラウドに接続できません。利用設定と通信環境をご確認ください。');
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
$('cloud-connect').onclick = () => guest ? openGuest() : signedIn(auth.currentUser);
$('open-cloud-login').onclick = () => { showLogin = true; signedIn(auth.currentUser); };
$('cloud-logout').onclick = () => { if (canLeave()) auth.signOut(); };
$('guest-link-person').onchange = hideGuestLink;
$('manage-guest-link').onclick = async () => {
  const {event} = selection();
  const person = roster?.find(item => item.id === $('guest-link-person').value);
  if (!event?.open || !person) {
    $('guest-link-status').textContent = 'リンクを発行する団員を選んでください。';
    return;
  }
  const button = $('manage-guest-link');
  const token = selectionGeneration;
  button.disabled = true;
  hideGuestLink();
  try {
    const existing = guestLinks?.find(link => link.personId === person.id && link.active && link.expiresAt.toMillis() > Date.now());
    const key = existing?.key || await store.createGuestLink(event,person);
    if (token !== selectionGeneration || person.id !== $('guest-link-person').value) return;
    displayedLink = key;
    const url = new URL('attendance-cloud.html',location.href);
    url.hash = new URLSearchParams({event:event.id,key});
    $('guest-link-url').value = url.href;
    $('guest-link-result').hidden = $('copy-guest-link').hidden = $('revoke-guest-link').hidden = false;
    $('guest-link-url').focus();
    $('guest-link-url').select();
  } catch {
    if (token === selectionGeneration) $('guest-link-status').textContent = 'リンクを発行できませんでした。';
  } finally {
    if (token === selectionGeneration) button.disabled = false;
  }
};
$('copy-guest-link').onclick = async () => {
  const field = $('guest-link-url');
  try {
    await navigator.clipboard.writeText(field.value);
    $('guest-link-status').textContent = '回答用リンクをコピーしました。';
  } catch {
    field.focus();
    field.select();
    $('guest-link-status').textContent = '選択したリンクをコピーしてください。';
  }
};
$('revoke-guest-link').onclick = async () => {
  const {event} = selection(), key = displayedLink;
  if (!event || !key || !confirm('この回答用リンクを無効にしますか？')) return;
  const token = selectionGeneration;
  try {
    await store.revokeGuestLink(event.id,key,guestLinks?.find(link => link.key === key)?.coordinationId);
    if (token !== selectionGeneration) return;
    hideGuestLink();
    $('guest-link-status').textContent = 'リンクを無効にしました。';
  } catch {
    if (token === selectionGeneration) $('guest-link-status').textContent = 'リンクを無効にできませんでした。';
  }
};
$('publish-notice').onclick = async () => {
  const {event} = selection(), message = $('public-notice-message').value.trim();
  if (!event || !message) {
    $('publish-notice-status').textContent = '公開する連絡を入力してください。';
    return;
  }
  if (!confirm('この連絡を、ログインなしで見られるように公開しますか？')) return;
  const token = selectionGeneration;
  try {
    await store.publishNotice(event,message);
    if (token === selectionGeneration) $('publish-notice-status').textContent = '試合の連絡を公開しました。';
    renderPublicMatches();
  } catch {
    if (token === selectionGeneration) $('publish-notice-status').textContent = '連絡を公開できませんでした。';
  }
};
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
      if (!window.firebase.firestore) await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
      const db = window.firebase.firestore(), timestamp = window.firebase.firestore.FieldValue.serverTimestamp;
      cloudStore = attendanceStore(db,timestamp);
      renderPublicMatches();
      if (guest) {
        store = guestAttendanceStore(db,timestamp,guest);
        openGuest();
      } else {
        store = cloudStore;
        if (auth) auth.onAuthStateChanged(signedIn, () => status('認証サービスに接続できませんでした。'));
        else signedIn(null);
      }
    } catch { status('試合の出欠を起動できませんでした。ページを開き直してください。'); }
  });
} else status('認証サービスを読み込めませんでした。');
