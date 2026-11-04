'use strict';

const $ = (id) => document.getElementById(id);
const state = { csrfToken: '', user: null, sheets: [] };
const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function message(id, text = '', isError = false) {
  const element = $(id);
  element.textContent = text;
  element.hidden = !text;
  element.classList.toggle('error', isError);
}

async function api(url, options = {}) {
  const headers = { ...options.headers };
  if (options.method && options.method !== 'GET') headers['X-CSRF-Token'] = state.csrfToken;
  if (options.body && !(options.body instanceof FormData))
    headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || 'The request failed. Please try again.');
    error.status = response.status;
    if (response.status === 401 && state.user) {
      state.user = null;
      $('dashboard-view').hidden = true;
      $('login-view').hidden = false;
      message('login-error', 'Your session ended. Sign in again.', true);
      await refreshCsrf();
    }
    throw error;
  }
  return response;
}

async function refreshCsrf() {
  const response = await fetch('/api/auth/csrf', { cache: 'no-store' });
  if (!response.ok)
    throw new Error(
      'The server is unavailable. Check that the application and MongoDB are running.',
    );
  state.csrfToken = (await response.json()).csrfToken;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderSheets() {
  const search = $('search').value.trim().toLowerCase();
  const sheets = state.sheets.filter((sheet) =>
    `${sheet.title} ${sheet.studentId}`.toLowerCase().includes(search),
  );
  $('sheet-count').textContent = state.sheets.length;
  $('sheets-body').replaceChildren();
  $('empty-records').hidden = sheets.length > 0;
  $('empty-text').textContent = search
    ? 'No records match your search.'
    : 'Your available grade sheets will appear here.';
  sheets.forEach((sheet) => {
    const row = document.createElement('tr');
    const titleCell = document.createElement('td');
    titleCell.append(
      makeElement('span', 'record-title', sheet.title),
      makeElement(
        'span',
        'record-meta',
        `PDF · Semester ${sheet.semester} · ${Math.max(1, Math.ceil(sheet.sizeBytes / 1024))} KB`,
      ),
    );
    row.append(
      titleCell,
      makeElement('td', 'student-cell', sheet.studentId),
      makeElement('td', 'muted', dateFormat.format(new Date(sheet.createdAt))),
    );
    const actions = makeElement('div', 'table-actions');
    const download = makeElement('button', 'button download', 'Download');
    download.type = 'button';
    download.setAttribute('aria-label', `Download ${sheet.studentId} ${sheet.title}`);
    download.addEventListener('click', () =>
      downloadSheet(sheet.fileId, 'workspace-message', download),
    );
    const copy = makeElement('button', 'button quiet', 'Copy ID');
    copy.type = 'button';
    copy.setAttribute('aria-label', `Copy file ID for ${sheet.studentId} ${sheet.title}`);
    copy.addEventListener('click', async () => {
      $('test-file-id').value = sheet.fileId;
      try {
        await navigator.clipboard.writeText(sheet.fileId);
        message(
          'workspace-message',
          'File ID copied. Sign in as another account and paste it into the access test.',
        );
      } catch {
        message('workspace-message', `Copy this file ID: ${sheet.fileId}`);
      }
    });
    actions.append(download, copy);
    const actionCell = document.createElement('td');
    actionCell.append(actions);
    row.append(actionCell);
    $('sheets-body').append(row);
  });
}

async function loadSheets() {
  const response = await api('/api/grade-sheets');
  state.sheets = (await response.json()).sheets;
  renderSheets();
}

async function downloadSheet(fileId, feedbackId, button) {
  if (button) button.disabled = true;
  message(feedbackId);
  try {
    const response = await api(`/api/grade-sheets/${encodeURIComponent(fileId)}/download`);
    const blob = await response.blob();
    const name =
      /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') || '')?.[1] ||
      'grade-sheet.pdf';
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    message(
      feedbackId,
      'Access approved. The server decrypted the grade sheet and your download has started.',
    );
  } catch (error) {
    message(feedbackId, error.message, true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadActivity() {
  const response = await api('/api/activity');
  const { events } = await response.json();
  $('activity-body').replaceChildren();
  $('empty-activity').hidden = events.length > 0;
  events.forEach((event) => {
    const row = document.createElement('tr');
    const person = document.createElement('td');
    person.append(
      makeElement('strong', 'record-title', event.actorName),
      makeElement('span', 'record-meta', event.action),
    );
    const result = document.createElement('td');
    result.append(makeElement('span', `badge ${event.outcome}`, event.outcome));
    row.append(
      person,
      result,
      makeElement('td', '', event.detail),
      makeElement('td', 'muted', timeFormat.format(new Date(event.createdAt))),
    );
    $('activity-body').append(row);
  });
}

async function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach((element) => {
    element.hidden = element.id !== `${tab}-tab`;
  });
  document.querySelectorAll('[data-tab]').forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const title = { records: 'Grade sheets', activity: 'Activity log', guide: 'How it works' }[tab];
  $('page-title').textContent = title;
  $('breadcrumb-title').textContent = title;
  $('page-subtitle').textContent =
    tab === 'records'
      ? state.user.role === 'faculty'
        ? `Manage grade sheets for the ${state.user.department} department.`
        : 'Your academic records, available in one place.'
      : tab === 'activity'
        ? 'A record of sign-ins and file access decisions.'
        : 'Understand what is implemented in phases 1 and 2.';
  if (tab === 'activity') await loadActivity();
}

async function showDashboard(user) {
  state.user = user;
  $('login-view').hidden = true;
  $('dashboard-view').hidden = false;
  window.scrollTo(0, 0);
  $('user-name').textContent = user.name;
  $('user-role').textContent =
    `${user.role === 'faculty' ? 'Faculty' : user.studentId} · ${user.department}`;
  $('user-avatar').textContent = user.name
    .replace(/^Dr\.\s*/, '')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  $('user-avatar').classList.toggle('faculty', user.role === 'faculty');
  const faculty = user.role === 'faculty';
  $('upload-panel').hidden = !faculty;
  $('records-layout').classList.toggle('student-layout', !faculty);
  $('access-scope').textContent = faculty ? user.department : 'Own records';
  $('access-detail').textContent = faculty
    ? 'Faculty access within your department'
    : `Student ID ${user.studentId}`;
  $('activity-scope').textContent = faculty
    ? `Recent activity by ${user.department} accounts.`
    : 'Recent activity from your own account.';
  $('search').value = '';
  message('workspace-message');
  message('upload-feedback');
  message('access-feedback');
  $('upload-form').reset();
  await showTab('records');
  await loadSheets();
  if (faculty) {
    const { students } = await (await api('/api/students')).json();
    $('upload-student').replaceChildren(new Option('Choose a student', ''));
    students.forEach((student) =>
      $('upload-student').add(
        new Option(`${student.studentId} · ${student.name}`, student.studentId),
      ),
    );
    $('upload-button').disabled = students.length === 0;
    if (!students.length)
      message('upload-feedback', 'No student accounts are registered in your department.');
  }
  const health = await (await api('/api/health')).json();
  $('db-status').textContent = health.status === 'ok' ? 'CONNECTED' : 'UNAVAILABLE';
}

document.querySelectorAll('[data-demo]').forEach((button) =>
  button.addEventListener('click', () => {
    $('email').value = button.dataset.demo;
    $('password').value = 'DemoGrades!2026';
    document
      .querySelectorAll('[data-demo]')
      .forEach((other) => other.classList.toggle('selected', other === button));
    message('login-error');
    $('login-button').focus();
  }),
);

$('toggle-password').addEventListener('click', () => {
  const show = $('password').type === 'password';
  $('password').type = show ? 'text' : 'password';
  $('toggle-password').textContent = show ? 'Hide' : 'Show';
  $('toggle-password').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  $('toggle-password').setAttribute('aria-pressed', String(show));
});

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('login-button').disabled = true;
  message('login-error');
  try {
    const response = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('email').value, password: $('password').value }),
    });
    const result = await response.json();
    state.csrfToken = result.csrfToken;
    $('password').value = '';
    await showDashboard(result.user);
  } catch (error) {
    message(state.user ? 'workspace-message' : 'login-error', error.message, true);
  } finally {
    $('login-button').disabled = false;
  }
});

$('logout-button').addEventListener('click', async () => {
  $('logout-button').disabled = true;
  try {
    await api('/api/auth/logout', { method: 'POST' });
    state.user = null;
    state.sheets = [];
    $('sheets-body').replaceChildren();
    $('activity-body').replaceChildren();
    $('dashboard-view').hidden = true;
    $('login-view').hidden = false;
    message('login-error');
    await refreshCsrf();
  } catch (error) {
    message('workspace-message', error.message, true);
  } finally {
    $('logout-button').disabled = false;
  }
});

$('upload-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = $('upload-file').files[0];
  if (!file || file.size > 5 * 1024 * 1024)
    return message('upload-feedback', 'Choose a PDF no larger than 5 MB.', true);
  $('upload-button').disabled = true;
  message('upload-feedback');
  try {
    await api('/api/grade-sheets', { method: 'POST', body: new FormData(event.currentTarget) });
    $('upload-form').reset();
    message('upload-feedback', 'Grade sheet encrypted and saved.');
    await loadSheets();
  } catch (error) {
    message('upload-feedback', error.message, true);
  } finally {
    $('upload-button').disabled = false;
  }
});

$('access-test-form').addEventListener('submit', (event) => {
  event.preventDefault();
  downloadSheet(
    $('test-file-id').value.trim(),
    'access-feedback',
    event.currentTarget.querySelector('button'),
  );
});
$('search').addEventListener('input', renderSheets);
$('refresh-button').addEventListener('click', () =>
  loadSheets().catch((error) => message('workspace-message', error.message, true)),
);
$('refresh-activity').addEventListener('click', () =>
  loadActivity().catch((error) => message('workspace-message', error.message, true)),
);
document
  .querySelectorAll('[data-tab]')
  .forEach((button) =>
    button.addEventListener('click', () =>
      showTab(button.dataset.tab).catch((error) =>
        message('workspace-message', error.message, true),
      ),
    ),
  );

async function init() {
  $('login-button').disabled = true;
  try {
    await refreshCsrf();
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    if (response.ok) await showDashboard((await response.json()).user);
    else if (response.status !== 401)
      throw new Error('Could not restore your session. Check that MongoDB is running.');
  } catch (error) {
    message(state.user ? 'workspace-message' : 'login-error', error.message, true);
  } finally {
    $('login-button').disabled = false;
  }
}
init();
