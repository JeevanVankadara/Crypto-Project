import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { encryptGradeSheet, decryptGradeSheet } from '../src/security/encryption.js';

test('encrypted storage round-trips and uses a fresh nonce for each file', () => {
  const key = randomBytes(32).toString('hex');
  const id = randomUUID();
  const plaintext = Buffer.from('%PDF- synthetic private grades: A+, A, B+');
  const a = encryptGradeSheet(plaintext, key, id);
  const b = encryptGradeSheet(plaintext, key, id);
  assert.deepEqual(decryptGradeSheet(a, key, id), plaintext);
  assert.notEqual(JSON.parse(a).nonce, JSON.parse(b).nonce);
  assert.ok(!a.includes('private grades'));
  assert.ok(!a.includes(key));
});

test('modified ciphertext, wrong keys, and swapped file identities are rejected', () => {
  const key = randomBytes(32).toString('hex');
  const id = randomUUID();
  const envelope = encryptGradeSheet(Buffer.from('student grade sheet'), key, id);
  assert.throws(() => decryptGradeSheet(envelope, randomBytes(32).toString('hex'), id));
  assert.throws(() => decryptGradeSheet(envelope, key, randomUUID()));
  const packet = JSON.parse(envelope);
  const bytes = Buffer.from(packet.ciphertext, 'base64');
  bytes[0] ^= 1;
  packet.ciphertext = bytes.toString('base64');
  assert.throws(() => decryptGradeSheet(JSON.stringify(packet), key, id));
  packet.tag = Buffer.alloc(1).toString('base64');
  assert.throws(() => decryptGradeSheet(JSON.stringify(packet), key, id));
});
