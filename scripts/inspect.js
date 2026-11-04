import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readConfig } from '../src/config.js';
import { connectDatabase } from '../src/db.js';

let connection;
try {
  const config = readConfig();
  const database = await connectDatabase(config);
  connection = database.connection;
  console.log(`Local database: ${connection.name}`);
  console.log(`Encrypted storage: ${config.storageDir}`);
  console.log(`Secret file location (contents are never printed): ${config.secretsFile}`);
  const users = await database.models.User.find()
    .select('name role department studentId -_id')
    .lean();
  console.table(users);
  const sheets = await database.models.GradeSheet.find()
    .select('fileId studentId semester title -_id')
    .lean();
  console.table(sheets);
  if (sheets[0]) {
    const packet = JSON.parse(
      await readFile(path.join(config.storageDir, `${sheets[0].fileId}.enc`), 'utf8'),
    );
    console.log('Stored file example:', {
      algorithm: packet.algorithm,
      nonceBytes: Buffer.from(packet.nonce, 'base64').length,
      ciphertextBytes: Buffer.from(packet.ciphertext, 'base64').length,
      containsPlaintextPdfHeader:
        Buffer.from(packet.ciphertext, 'base64').subarray(0, 5).toString() === '%PDF-',
    });
  }
  console.log(
    'The database stores metadata. The .enc files contain ciphertext. The baseline server holds the AES key.',
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (connection) await connection.close();
}
