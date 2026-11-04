import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, access, unlink } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import mongoose from 'mongoose';
import { readConfig } from '../src/config.js';

const config = readConfig();
const databasePath = path.join(config.mongoRuntimeDir, 'mongodb-data');
const logPath = path.join(config.mongoRuntimeDir, 'mongodb.log');
const ownershipFile = path.join(config.mongoRuntimeDir, 'mongodb-process.json');
const port = new URL(config.mongoUri).port || '27017';

async function openClient() {
  const client = new mongoose.mongo.MongoClient(config.mongoUri, {
    serverSelectionTimeoutMS: 1000,
  });
  try {
    await client.connect();
    await client.db().command({ ping: 1 });
    return client;
  } catch (error) {
    await client.close();
    throw error;
  }
}

async function start() {
  try {
    const client = await openClient();
    await client.close();
    console.log(`Local MongoDB is already running on port ${port}. It was left unchanged.`);
    return;
  } catch {
    /* Start our own portable instance if nothing is listening. */
  }
  let binary = process.env.MONGOD_PATH;
  if (!binary) {
    const manifest = path.join(
      process.env.LOCALAPPDATA || config.dataDir,
      'SecureAcademicSharing',
      'tools',
      'mongodb-path.txt',
    );
    try {
      binary = (await readFile(manifest, 'utf8')).replace(/^\uFEFF/, '').trim();
    } catch {
      throw new Error(
        'MongoDB was not found. Run npm run db:install on Windows, or set MONGOD_PATH in .env.',
      );
    }
  }
  await access(binary);
  await mkdir(databasePath, { recursive: true });
  const child = spawn(
    binary,
    [
      '--dbpath',
      databasePath,
      '--bind_ip',
      '127.0.0.1',
      '--port',
      port,
      '--logpath',
      logPath,
      '--logappend',
    ],
    { detached: true, stdio: 'ignore', windowsHide: true },
  );
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  child.unref();
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const client = await openClient();
      try {
        const status = await client.db('admin').command({ serverStatus: 1 });
        if (status.pid !== child.pid) throw new Error('A different MongoDB process took the port.');
        await writeFile(ownershipFile, JSON.stringify({ pid: child.pid, binary, databasePath }));
        console.log(`MongoDB is ready at 127.0.0.1:${port}`);
        console.log(`Database files: ${databasePath}`);
        console.log('Next: npm run seed, then npm start.');
        return;
      } finally {
        await client.close();
      }
    } catch {
      await delay(300);
    }
  }
  throw new Error(`MongoDB did not become ready. Read ${logPath}`);
}

async function stop() {
  let owned;
  try {
    owned = JSON.parse(await readFile(ownershipFile, 'utf8'));
  } catch {
    throw new Error(
      'No MongoDB instance owned by this project was recorded. No server was stopped.',
    );
  }
  const client = await openClient();
  try {
    const admin = client.db('admin');
    const status = await admin.command({ serverStatus: 1 });
    const options = await admin.command({ getCmdLineOpts: 1 });
    if (
      status.pid !== owned.pid ||
      path.resolve(options.parsed.storage.dbPath) !== path.resolve(databasePath)
    ) {
      throw new Error(
        'This database process is not the one started by this project. It was left running.',
      );
    }
    try {
      await admin.command({ shutdown: 1 });
    } catch (error) {
      if (!['MongoNetworkError', 'MongoServerSelectionError'].includes(error.name)) throw error;
    }
    await unlink(ownershipFile);
    console.log('The project MongoDB process was stopped. All database files were preserved.');
  } finally {
    await client.close();
  }
}

try {
  if (process.argv[2] === 'start') await start();
  else if (process.argv[2] === 'stop') await stop();
  else throw new Error('Use npm run db:start or npm run db:stop.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
