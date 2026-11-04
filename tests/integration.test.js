import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readConfig } from '../src/config.js';
import { connectDatabase } from '../src/db.js';
import { loadSecrets } from '../src/security/secrets.js';
import { hashPassword } from '../src/security/passwords.js';
import { createApp } from '../src/app.js';
import { saveGradeSheet } from '../src/services/grade-sheets.js';
import { DEMO_USERS, DEMO_PASSWORD, makeSamplePdf } from '../scripts/demo-data.js';

test('baseline works against a real, isolated LOCAL MongoDB database', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'academic-sharing-test-'));
  const dbName = `academic_sharing_test_${randomUUID().replaceAll('-', '')}`;
  const uri = process.env.TEST_MONGODB_URI || `mongodb://127.0.0.1:27017/${dbName}`;
  // Never allow test teardown to delete an ordinary database.
  assert.match(uri, /\/academic_sharing_test_[a-z0-9]+$/);
  const config = readConfig({
    mongoUri: uri,
    dataDir: directory,
    secretsDir: path.join(directory, 'server-secrets'),
    port: 0,
  });
  let database;
  let server;
  let baseUrl;
  let context;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (database) {
      assert.ok(database.connection.name.startsWith('academic_sharing_test_'));
      await database.connection.dropDatabase();
      await database.connection.close();
    }
    // directory is the unique folder returned by mkdtemp, never user-supplied.
    await rm(directory, { recursive: true, force: true });
  });
  async function startApplication() {
    database = await connectDatabase(config);
    const secrets = await loadSecrets(config, database.models);
    context = { ...database, config, secrets };
    const app = await createApp(context);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }
  await startApplication();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = await database.models.User.create(
    DEMO_USERS.map((user) => ({ ...user, passwordHash })),
  );
  await database.models.User.create({
    name: 'ECE student',
    email: 'ece.student@test.local',
    role: 'student',
    department: 'ECE',
    studentId: '23EC101',
    passwordHash,
  });
  const pdfA = await makeSamplePdf(DEMO_USERS[1]);
  const pdfB = await makeSamplePdf(DEMO_USERS[2]);
  const a = await saveGradeSheet(context, {
    buffer: pdfA,
    studentId: '23CS101',
    department: 'CSE',
    semester: '5',
    title: 'Student A grades',
    originalName: '23CS101-semester-5.pdf',
    uploadedBy: users[0]._id,
  });
  const b = await saveGradeSheet(context, {
    buffer: pdfB,
    studentId: '23CS102',
    department: 'CSE',
    semester: '5',
    title: 'Student B grades',
    originalName: '23CS102-semester-5.pdf',
    uploadedBy: users[0]._id,
  });

  function client() {
    return {
      cookie: '',
      csrf: '',
      async request(url, options = {}) {
        const headers = { Cookie: this.cookie, ...(options.headers || {}) };
        if (options.method && options.method !== 'GET' && !options.noCsrf)
          headers['X-CSRF-Token'] = this.csrf;
        if (options.json) {
          headers['Content-Type'] = 'application/json';
          options.body = JSON.stringify(options.json);
        }
        const response = await fetch(baseUrl + url, { ...options, headers });
        const cookie = response.headers.getSetCookie()[0];
        if (cookie) this.cookie = cookie.split(';')[0];
        return response;
      },
      async login(email, extra = {}) {
        this.csrf = (await (await this.request('/api/auth/csrf')).json()).csrfToken;
        const response = await this.request('/api/auth/login', {
          method: 'POST',
          json: { email, password: DEMO_PASSWORD, ...extra },
        });
        assert.equal(response.status, 200, await response.clone().text());
        const data = await response.json();
        this.csrf = data.csrfToken;
        return data;
      },
    };
  }
  const anonymous = client();
  const faculty = client();
  const studentA = client();
  const studentB = client();
  const ece = client();
  const downloadPath = (id) => `/api/grade-sheets/${id}/download`;
  function uploadForm(studentId = '23CS101', buffer = pdfA, type = 'application/pdf') {
    const form = new FormData();
    form.set('studentId', studentId);
    form.set('semester', '5');
    form.set('title', 'Uploaded test grades');
    form.set('file', new Blob([buffer], { type }), 'test.pdf');
    return form;
  }

  await t.test(
    'anonymous access, missing CSRF, invalid credentials, and object injection are rejected',
    async () => {
      assert.equal((await anonymous.request('/api/grade-sheets')).status, 401);
      assert.equal((await anonymous.request(downloadPath(a.fileId))).status, 401);
      assert.equal(
        (
          await anonymous.request('/api/auth/login', {
            method: 'POST',
            noCsrf: true,
            json: { email: DEMO_USERS[0].email, password: DEMO_PASSWORD },
          })
        ).status,
        403,
      );
      anonymous.csrf = (await (await anonymous.request('/api/auth/csrf')).json()).csrfToken;
      assert.equal(
        (
          await anonymous.request('/api/auth/login', {
            method: 'POST',
            json: { email: DEMO_USERS[0].email, password: 'wrong' },
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await anonymous.request('/api/auth/login', {
            method: 'POST',
            json: { email: { $ne: null }, password: DEMO_PASSWORD },
          })
        ).status,
        400,
      );
      const html = await fetch(baseUrl);
      assert.equal(html.status, 200);
      assert.ok(html.headers.get('content-security-policy').includes("script-src 'self'"));
    },
  );

  await t.test(
    'users authenticate without exposing hashes or accepting a forged role',
    async () => {
      await faculty.login(DEMO_USERS[0].email);
      await studentA.login(DEMO_USERS[1].email);
      const result = await studentB.login(DEMO_USERS[2].email, {
        role: 'faculty',
        studentId: '23CS101',
      });
      await ece.login(DEMO_USERS[3].email);
      assert.equal(result.user.role, 'student');
      assert.equal(result.user.studentId, '23CS102');
      assert.equal(result.user.passwordHash, undefined);
      assert.equal((await studentB.request('/api/students')).status, 403);
    },
  );

  await t.test('lists are filtered by ownership and faculty department', async () => {
    const list = async (user) => (await (await user.request('/api/grade-sheets')).json()).sheets;
    assert.deepEqual(
      (await list(studentA)).map((sheet) => sheet.fileId),
      [a.fileId],
    );
    assert.deepEqual(
      (await list(studentB)).map((sheet) => sheet.fileId),
      [b.fileId],
    );
    assert.equal((await list(faculty)).length, 2);
    assert.equal((await list(ece)).length, 0);
  });

  await t.test('owner and authorized faculty receive the exact original PDF', async () => {
    for (const user of [studentA, faculty]) {
      const response = await user.request(downloadPath(a.fileId));
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /application\/pdf/);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdfA);
    }
  });

  await t.test(
    'copied file IDs do not bypass student ownership or faculty department checks',
    async () => {
      for (const user of [studentB, ece]) {
        const response = await user.request(downloadPath(a.fileId));
        assert.equal(response.status, 403);
        assert.ok(!(await response.text()).includes('%PDF-'));
      }
      const events = (await (await studentB.request('/api/activity')).json()).events;
      assert.ok(events.some((event) => event.outcome === 'denied' && event.fileId === a.fileId));
      assert.ok(events.every((event) => event.actorName === DEMO_USERS[2].name));
    },
  );

  await t.test('faculty uploads persist metadata in MongoDB and ciphertext on disk', async () => {
    const response = await faculty.request('/api/grade-sheets', {
      method: 'POST',
      body: uploadForm(),
    });
    assert.equal(response.status, 201, await response.clone().text());
    const { fileId } = await response.json();
    const sheet = await database.models.GradeSheet.findOne({ fileId });
    assert.equal(sheet.studentId, '23CS101');
    assert.equal(sheet.department, 'CSE');
    const stored = await readFile(path.join(config.storageDir, `${fileId}.enc`), 'utf8');
    assert.equal(JSON.parse(stored).algorithm, 'AES-256-GCM');
    assert.ok(!stored.includes('%PDF-'));
    assert.ok(!stored.includes(context.secrets.encryptionKey));
    assert.equal((await studentA.request(downloadPath(fileId))).status, 200);
  });

  await t.test(
    'student uploads, cross-department uploads, invalid PDFs, and oversize files fail',
    async () => {
      assert.equal(
        (await studentA.request('/api/grade-sheets', { method: 'POST', body: uploadForm() }))
          .status,
        403,
      );
      assert.equal(
        (
          await faculty.request('/api/grade-sheets', {
            method: 'POST',
            body: uploadForm('23EC101'),
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await faculty.request('/api/grade-sheets', {
            method: 'POST',
            body: uploadForm('23CS101', Buffer.from('not a PDF')),
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await faculty.request('/api/grade-sheets', {
            method: 'POST',
            body: uploadForm('23CS101', Buffer.alloc(5 * 1024 * 1024 + 1)),
          })
        ).status,
        400,
      );
    },
  );

  await t.test('tampered ciphertext is rejected without releasing any PDF', async () => {
    const filename = path.join(config.storageDir, `${a.fileId}.enc`);
    const original = await readFile(filename, 'utf8');
    const packet = JSON.parse(original);
    const data = Buffer.from(packet.ciphertext, 'base64');
    data[5] ^= 1;
    packet.ciphertext = data.toString('base64');
    await writeFile(filename, JSON.stringify(packet));
    try {
      const response = await faculty.request(downloadPath(a.fileId));
      assert.equal(response.status, 409);
      assert.ok(!(await response.text()).includes('%PDF-'));
    } finally {
      await writeFile(filename, original);
    }
  });

  await t.test('forged origins are rejected and logout invalidates the saved session', async () => {
    assert.equal(
      (
        await faculty.request('/api/auth/logout', {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
        })
      ).status,
      403,
    );
    const oldCookie = studentB.cookie;
    assert.equal((await studentB.request('/api/auth/logout', { method: 'POST' })).status, 200);
    studentB.cookie = oldCookie;
    assert.equal((await studentB.request(downloadPath(b.fileId))).status, 401);
  });

  await t.test(
    'database records, decryption keys, and sessions survive an application restart',
    async () => {
      const keyBefore = context.secrets.encryptionKey;
      await new Promise((resolve) => server.close(resolve));
      server = null;
      await database.connection.close();
      await startApplication();
      assert.equal(context.secrets.encryptionKey, keyBefore);
      assert.equal((await studentA.request('/api/auth/me')).status, 200);
      const response = await studentA.request(downloadPath(a.fileId));
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdfA);
    },
  );
});
