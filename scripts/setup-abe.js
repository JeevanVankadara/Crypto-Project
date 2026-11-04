import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { readConfig } from '../src/config.js';
import { connectDatabase } from '../src/db.js';
import { runCrypto } from './abe-helper.js';
import { DEMO_USERS } from './demo-data.js';
const config = readConfig();
const authorityDir = config.abeAuthorityDir;
const userDir = config.abeUserKeysDir;
const publicDir = path.join(config.dataDir, 'abe');
await mkdir(authorityDir, { recursive: true, mode: 0o700 });
await mkdir(userDir, { recursive: true, mode: 0o700 });
await mkdir(publicDir, { recursive: true });
await mkdir(path.join(config.dataDir, 'abe-encrypted-files'), { recursive: true });
const authorityFile = path.join(authorityDir, 'master.json');
let authority;
try {
  authority = JSON.parse(await readFile(authorityFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const existing = await readdir(path.join(config.dataDir, 'abe-encrypted-files'));
  if (existing.length || (await readdir(userDir)).length)
    throw new Error(
      'ABE files or issued keys already exist. Restore the original authority key; do not replace it.',
    );
  authority = await runCrypto({ op: 'setup' });
  await writeFile(authorityFile, JSON.stringify(authority), { flag: 'wx', mode: 0o600 });
}
await writeFile(
  path.join(publicDir, 'public.json'),
  JSON.stringify({ public: authority.public, publicId: authority.publicId }),
);
const { connection, models } = await connectDatabase(config);
try {
  for (const demo of DEMO_USERS) {
    const user = await models.User.findOne({ email: demo.email });
    if (!user) throw new Error('Run npm run seed before issuing demo attribute keys.');
    // Fixed, administrator-reviewed demo identities; changes in the DB do not grant new key attributes.
    if (
      user.role !== demo.role ||
      user.department !== demo.department ||
      user.studentId !== demo.studentId
    )
      throw new Error(`Review changed identity before issuing a key for ${demo.email}`);
    const filename = `${demo.email.split('@')[0].replaceAll('.', '-')}.key.json`;
    const attrs = [`role_${demo.role}`, `dept_${demo.department.toLowerCase()}`];
    if (demo.studentId) attrs.push(`student_${demo.studentId.toLowerCase()}`);
    const keyFile = path.join(userDir, filename);
    try {
      const existing = JSON.parse(await readFile(keyFile, 'utf8'));
      if (existing.publicId !== authority.publicId)
        throw new Error('Existing user key belongs to a different authority.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const key = await runCrypto({
        op: 'keygen',
        public: authority.public,
        master: authority.master,
        attributes: attrs,
      });
      await writeFile(keyFile, JSON.stringify(key), { flag: 'wx', mode: 0o600 });
    }
    console.log(`${demo.email}: ${filename} (${attrs.join(', ')})`);
  }
  console.log(`User keys for manual distribution: ${userDir}`);
  console.log(
    'Authority master key is in ignored server-data/abe-authority and is never served by Express.',
  );
} finally {
  await connection.close();
}
