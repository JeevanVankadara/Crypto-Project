import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { encryptGradeSheet, decryptGradeSheet } from '../security/encryption.js';

export async function saveGradeSheet({ models, config, secrets }, { buffer, ...metadata }) {
  const fileId = randomUUID();
  const destination = path.join(config.storageDir, `${fileId}.enc`);
  await writeFile(destination, encryptGradeSheet(buffer, secrets.encryptionKey, fileId), {
    flag: 'wx',
    mode: 0o600,
  });
  try {
    return await models.GradeSheet.create({ ...metadata, fileId, sizeBytes: buffer.length });
  } catch (error) {
    await unlink(destination).catch(() => {});
    throw error;
  }
}

export async function openGradeSheet({ config, secrets }, fileId) {
  const encrypted = await readFile(path.join(config.storageDir, `${fileId}.enc`), 'utf8');
  return decryptGradeSheet(encrypted, secrets.encryptionKey, fileId);
}

export async function recordAudit(models, user, action, outcome, detail, fileId = null) {
  return models.AuditEvent.create({
    actorId: user._id,
    actorName: user.name,
    department: user.department,
    action,
    outcome,
    detail,
    fileId,
  });
}
