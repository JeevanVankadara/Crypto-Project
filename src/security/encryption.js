import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Phase 2 baseline: the SERVER owns this AES key and performs decryption.
// This is not attribute-based encryption. The future ABE implementation replaces key handling.
export function encryptGradeSheet(plaintext, keyHex, fileId) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), nonce);
  cipher.setAAD(Buffer.from(fileId));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return JSON.stringify({
    version: 1,
    algorithm: 'AES-256-GCM',
    nonce: nonce.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
}

export function decryptGradeSheet(envelope, keyHex, fileId) {
  const packet = JSON.parse(envelope);
  if (packet.version !== 1 || packet.algorithm !== 'AES-256-GCM')
    throw new Error('Unsupported encrypted file.');
  const nonce = Buffer.from(packet.nonce, 'base64');
  const tag = Buffer.from(packet.tag, 'base64');
  if (nonce.length !== 12 || tag.length !== 16) throw new Error('Invalid encrypted file.');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), nonce);
  decipher.setAAD(Buffer.from(fileId));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(packet.ciphertext, 'base64')),
    decipher.final(),
  ]);
}
