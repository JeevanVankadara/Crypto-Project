'use strict';
const $ = (id) => document.getElementById(id);
let user, publicKey, csrf, privateKey;
const worker = new Worker('/abe/worker.js');
const pending = new Map();
let counter = 0;
worker.onmessage = ({ data }) => {
  const p = pending.get(data.id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(data.id);
  data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
};
worker.onerror = () => {
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(new Error('ABE runtime failed. Build the helper and reload this page.'));
  }
  pending.clear();
};
function cryptoCall(request) {
  return new Promise((resolve, reject) => {
    const id = ++counter;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Crypto operation timed out.'));
    }, 60000);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, request });
  });
}
function notice(text, error = false) {
  $('notice').textContent = text;
  $('notice').hidden = !text;
  $('notice').classList.toggle('error', error);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.method ? { 'X-CSRF-Token': csrf } : {}), ...options.headers },
    cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 401) {
      privateKey = null;
      location.href = '/';
    }
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed.');
  }
  return response;
}
function encode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 32768)
    s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s);
}
function decode(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function save(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function node(tag, text, className) {
  const e = document.createElement(tag);
  e.textContent = text;
  if (className) e.className = className;
  return e;
}
function policy() {
  return `student_${$('student').value.toLowerCase()} OR (role_faculty AND dept_${user.department.toLowerCase()})`;
}
async function load() {
  const { sheets } = await (await api('/api/abe/records')).json();
  $('records').replaceChildren();
  if (!sheets.length)
    $('records').append(
      node('p', 'No ABE sheets yet. Faculty can encrypt and upload the sample PDF.', 'muted'),
    );
  for (const sheet of sheets) {
    const row = node('article', '', 'abe-record');
    row.append(
      node('h3', sheet.title),
      node('p', `${sheet.studentId} · ${sheet.department} · Semester ${sheet.semester}`),
    );
    const buttons = node('div', '', 'record-buttons');
    for (const [label, fn] of [
      ['Decrypt PDF', () => fetchAndDecrypt(sheet.fileId)],
      [
        'Encrypted package',
        async () => {
          const data = await (await api(`/api/abe/records/${sheet.fileId}/package`)).blob();
          save(data, `${sheet.fileId}.abe.json`, 'application/json');
          notice('Ciphertext package downloaded. It still requires an attribute key.');
        },
      ],
      [
        'Copy ID',
        async () => {
          $('file-id').value = sheet.fileId;
          try {
            await navigator.clipboard.writeText(sheet.fileId);
            notice('ABE file ID copied.');
          } catch {
            notice(`File ID: ${sheet.fileId}`);
          }
        },
      ],
    ]) {
      const b = node('button', label, 'button quiet');
      b.type = 'button';
      b.onclick = () => perform(b, fn);
      buttons.append(b);
    }
    row.append(buttons);
    $('records').append(row);
  }
}
async function perform(button, fn) {
  button.disabled = true;
  try {
    await fn();
  } catch (e) {
    notice(e.message, true);
  } finally {
    button.disabled = false;
  }
}
async function decrypt(envelope) {
  if (!privateKey) throw new Error('Load your issued attribute key first.');
  notice('Checking your attribute key and decrypting locally…');
  const result = await cryptoCall({ op: 'decrypt', public: publicKey, key: privateKey, envelope });
  const bytes = decode(result.data);
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-')
    throw new Error('Decrypted content is not a PDF.');
  save(bytes, result.filename, 'application/pdf');
  notice('Decryption succeeded in your browser. Your attribute key satisfies the policy.');
}
async function fetchAndDecrypt(id) {
  if (!privateKey) throw new Error('Load your issued attribute key first.');
  const envelope = await (await api(`/api/abe/records/${encodeURIComponent(id)}/package`)).json();
  await decrypt(envelope);
}
$('key-file').onchange = async () => {
  try {
    const file = $('key-file').files[0];
    if (!file) return;
    if (file.size > 100000) throw new Error('Key file is too large.');
    const key = JSON.parse(await file.text());
    if (!key.publicId || !Array.isArray(key.attributes) || !key.k || !key.k0)
      throw new Error('Choose an issued user attribute key.');
    privateKey = key;
    $('key-status').textContent = `Loaded attributes: ${key.attributes.join(', ')}`;
    notice('Key loaded locally. It will be forgotten when you leave or reload this page.');
  } catch (e) {
    privateKey = null;
    $('key-status').textContent = 'No key loaded';
    notice(e.message, true);
  }
};
$('clear-key').onclick = () => {
  privateKey = null;
  $('key-file').value = '';
  $('key-status').textContent = 'No key loaded';
  notice('Private key forgotten.');
};
$('student').onchange = () => {
  $('policy').textContent = $('student').value
    ? policy()
    : 'Choose a student to see the encryption policy.';
};
$('refresh').onclick = () => perform($('refresh'), load);
$('abe-upload').onsubmit = (event) => {
  event.preventDefault();
  perform($('encrypt-button'), async () => {
    const file = $('pdf-file').files[0];
    if (!file || file.size > 5 * 1024 * 1024) throw new Error('Choose a PDF no larger than 5 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-')
      throw new Error('Choose a valid PDF.');
    notice('Encrypting in your browser…');
    const envelope = await cryptoCall({
      op: 'encrypt',
      public: publicKey,
      policy: policy(),
      fileId: crypto.randomUUID(),
      filename: `${$('student').value}-semester-${$('semester').value}.pdf`,
      data: encode(bytes),
    });
    const form = new FormData();
    form.set('studentId', $('student').value);
    form.set('semester', $('semester').value);
    form.set('title', $('title').value);
    form.set(
      'file',
      new Blob([JSON.stringify(envelope)], { type: 'application/json' }),
      'encrypted.abe.json',
    );
    await api('/api/abe/records', { method: 'POST', body: form });
    notice('Encrypted locally and uploaded. The server received ciphertext only.');
    $('abe-upload').reset();
    $('policy').textContent = 'Choose a student to see the encryption policy.';
    await load();
  });
};
$('try-id').onsubmit = (event) => {
  event.preventDefault();
  perform(event.submitter, () => fetchAndDecrypt($('file-id').value.trim()));
};
$('offline-form').onsubmit = (event) => {
  event.preventDefault();
  perform(event.submitter, async () => {
    const file = $('package-file').files[0];
    if (!file || file.size > 8 * 1024 * 1024)
      throw new Error('Choose an encrypted package under 8 MB.');
    await decrypt(JSON.parse(await file.text()));
  });
};
addEventListener('pagehide', () => {
  privateKey = null;
  worker.terminate();
});
(async () => {
  try {
    csrf = (await (await api('/api/auth/csrf')).json()).csrfToken;
    user = (await (await api('/api/auth/me')).json()).user;
    publicKey = (await (await api('/api/abe/public')).json()).public;
    $('identity').textContent = `${user.name} · ${user.role} · ${user.department}`;
    if (user.role === 'faculty') {
      $('faculty-panel').hidden = false;
      const { students } = await (await api('/api/students')).json();
      for (const s of students)
        $('student').add(new Option(`${s.studentId} · ${s.name}`, s.studentId));
      $('encrypt-button').disabled = !students.length;
    }
    await load();
  } catch (e) {
    notice(e.message, true);
  }
})();
