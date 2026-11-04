import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readConfig } from '../src/config.js';
import { connectDatabase } from '../src/db.js';
import { loadSecrets } from '../src/security/secrets.js';
import { hashPassword } from '../src/security/passwords.js';
import { createApp } from '../src/app.js';
import { runCrypto } from '../scripts/abe-helper.js';
import { DEMO_USERS, DEMO_PASSWORD, makeSamplePdf } from '../scripts/demo-data.js';
import { abePolicy } from '../src/routes/abe.js';

test('real ABE integrates with encrypted-only Express storage and local MongoDB', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'academic-abe-test-'));
  const dbName = `academic_sharing_test_${randomUUID().replaceAll('-', '')}`;
  const config = readConfig({
    dataDir: directory,
    secretsDir: path.join(directory, 'secrets'),
    mongoUri: `mongodb://127.0.0.1:27017/${dbName}`,
  });
  let database, server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (database) {
      assert.equal(database.connection.name, dbName);
      await database.connection.dropDatabase();
      await database.connection.close();
    }
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('academic-abe-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  database = await connectDatabase(config);
  const secrets = await loadSecrets(config, database.models);
  const authority = await runCrypto({ op: 'setup' });
  await mkdir(path.join(directory, 'abe'));
  await writeFile(
    path.join(directory, 'abe', 'public.json'),
    JSON.stringify({ public: authority.public, publicId: authority.publicId }),
  );
  const hash = await hashPassword(DEMO_PASSWORD);
  await database.models.User.create(DEMO_USERS.map((u) => ({ ...u, passwordHash: hash })));
  const app = await createApp({ ...database, config, secrets });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  function client() {
    return {
      cookie: '',
      csrf: '',
      async request(url, options = {}) {
        const r = await fetch(base + url, {
          ...options,
          headers: { Cookie: this.cookie, 'X-CSRF-Token': this.csrf, ...options.headers },
        });
        const c = r.headers.getSetCookie()[0];
        if (c) this.cookie = c.split(';')[0];
        return r;
      },
      async login(email) {
        this.csrf = (await (await this.request('/api/auth/csrf')).json()).csrfToken;
        const r = await this.request('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: DEMO_PASSWORD }),
        });
        assert.equal(r.status, 200);
        this.csrf = (await r.json()).csrfToken;
      },
    };
  }
  const faculty = client(),
    other = client(),
    owner = client();
  await faculty.login(DEMO_USERS[0].email);
  await other.login(DEMO_USERS[2].email);
  await owner.login(DEMO_USERS[1].email);
  const ownerKey = await runCrypto({ op: 'keygen', ...authority, attributes: ['student_23cs101'] });
  const otherKey = await runCrypto({ op: 'keygen', ...authority, attributes: ['student_23cs102'] });
  const pdf = await makeSamplePdf(DEMO_USERS[1]);
  const fileId = randomUUID();
  const envelope = await runCrypto({
    op: 'encrypt',
    public: authority.public,
    policy: abePolicy('23CS101', 'CSE'),
    fileId,
    filename: '23CS101-semester-5.pdf',
    data: pdf.toString('base64'),
  });
  function upload(packet) {
    const f = new FormData();
    f.set('studentId', '23CS101');
    f.set('semester', '5');
    f.set('title', 'ABE test');
    f.set(
      'file',
      new Blob([JSON.stringify(packet)], { type: 'application/json' }),
      'encrypted.abe.json',
    );
    return f;
  }
  await t.test('only permitted faculty can store a package with the expected policy', async () => {
    assert.equal(
      (await other.request('/api/abe/records', { method: 'POST', body: upload(envelope) })).status,
      403,
    );
    const bad = structuredClone(envelope);
    bad.header.policy = 'student_23cs102';
    assert.equal(
      (await faculty.request('/api/abe/records', { method: 'POST', body: upload(bad) })).status,
      400,
    );
    const r = await faculty.request('/api/abe/records', { method: 'POST', body: upload(envelope) });
    assert.equal(r.status, 201, await r.clone().text());
    assert.equal(
      (await faculty.request('/api/abe/records', { method: 'POST', body: upload(envelope) }))
        .status,
      409,
    );
  });
  await t.test(
    'ciphertext is fetchable with a copied ID, but an unauthorized key cannot decrypt it',
    async () => {
      const response = await other.request(`/api/abe/records/${fileId}/package`);
      assert.equal(response.status, 200);
      const copied = await response.json();
      assert.deepEqual(copied, envelope);
      await assert.rejects(
        runCrypto({ op: 'decrypt', public: authority.public, key: otherKey, envelope: copied }),
        /Decryption failed/,
      );
      const result = await runCrypto({
        op: 'decrypt',
        public: authority.public,
        key: ownerKey,
        envelope: copied,
      });
      assert.deepEqual(Buffer.from(result.data, 'base64'), pdf);
      const rows = (await (await other.request('/api/abe/records')).json()).sheets;
      assert.equal(rows.length, 0);
    },
  );
  await t.test(
    'stored package contains ciphertext and public policy, not a private key or plaintext PDF',
    async () => {
      const stored = await readFile(
        path.join(directory, 'abe-encrypted-files', `${fileId}.abe.json`),
        'utf8',
      );
      assert.deepEqual(JSON.parse(stored), envelope);
      assert.ok(!stored.includes(pdf.toString('base64')));
      assert.ok(!stored.includes(JSON.stringify(ownerKey)));
      assert.equal((await fetch(base + '/abe-authority/master.json')).status, 404);
      assert.equal(
        (await fetch(base + `/server-data/abe-encrypted-files/${fileId}.abe.json`)).status,
        404,
      );
    },
  );
});
