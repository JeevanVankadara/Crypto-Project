import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export async function loadSecrets(config, models) {
  await mkdir(config.storageDir, { recursive: true });
  await mkdir(path.dirname(config.secretsFile), { recursive: true, mode: 0o700 });
  try {
    const value = JSON.parse(await readFile(config.secretsFile, 'utf8'));
    if (
      !/^[a-f0-9]{64}$/.test(value.encryptionKey) ||
      !/^[a-f0-9]{96}$/.test(value.sessionSecret)
    ) {
      throw new Error('The saved server secrets are invalid. Restore the original secrets file.');
    }
    return value;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // Never silently replace a missing key if existing ciphertext would become unreadable.
  if (
    (await models.GradeSheet.exists({})) ||
    (await readdir(config.storageDir)).some((name) => name.endsWith('.enc'))
  ) {
    throw new Error(
      `Encrypted grade sheets exist but the server key is missing at ${config.secretsFile}. Restore the original server-data/server-secrets/secrets.json file.`,
    );
  }
  const value = {
    encryptionKey: randomBytes(32).toString('hex'),
    sessionSecret: randomBytes(48).toString('hex'),
  };
  await writeFile(config.secretsFile, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
  return value;
}
