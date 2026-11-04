import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// Uploaded files belong to this Express server project.
export function readConfig(overrides = {}) {
  const dataDir = path.resolve(
    process.env.APP_DATA_DIR || fileURLToPath(new URL('../server-data/', import.meta.url)),
  );
  const mongoRuntimeDir = path.resolve(
    process.env.APP_RUNTIME_DIR ||
      path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'),
        'SecureAcademicSharing',
      ),
  );
  const config = {
    port: Number(process.env.PORT || 3000),
    host: '127.0.0.1',
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/academic_sharing_baseline',
    dataDir,
    mongoRuntimeDir,
    secretsDir: path.join(overrides.dataDir || dataDir, 'server-secrets'),
    ...overrides,
  };
  // This project intentionally uses local MongoDB, never Atlas or another remote host.
  if (
    !/^mongodb:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\/[a-zA-Z0-9_-]+$/.test(config.mongoUri)
  ) {
    throw new Error(
      'MONGODB_URI must name a local MongoDB database, e.g. mongodb://127.0.0.1:27017/academic_sharing_baseline',
    );
  }
  if (!Number.isInteger(config.port) || config.port < 0 || config.port > 65535)
    throw new Error('Invalid PORT.');
  return {
    ...config,
    storageDir: path.join(config.dataDir, 'encrypted-files'),
    secretsFile: path.join(config.secretsDir, 'secrets.json'),
    sampleDir: path.join(config.dataDir, 'sample-grade-sheets'),
    abeAuthorityDir: path.join(config.dataDir, 'abe-authority'),
    abeUserKeysDir: path.join(config.dataDir, 'abe-user-keys'),
  };
}
