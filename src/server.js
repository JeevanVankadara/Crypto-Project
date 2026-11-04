import { readConfig } from './config.js';
import { connectDatabase } from './db.js';
import { loadSecrets } from './security/secrets.js';
import { createApp } from './app.js';

let connection;
try {
  const config = readConfig();
  const database = await connectDatabase(config);
  connection = database.connection;
  const secrets = await loadSecrets(config, database.models);
  const app = await createApp({ ...database, config, secrets });
  const server = app.listen(config.port, config.host, () => {
    console.log(`Academic Vault: http://${config.host}:${server.address().port}`);
    console.log(`Database: ${connection.name} (local MongoDB)`);
    console.log(`Runtime folder: ${config.dataDir}`);
    console.log('Normal and ABE approaches available; ABE decryption happens in the browser.');
  });
  server.on('error', async (error) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? `Port ${config.port} is in use. Set a different PORT in .env.`
        : error.message,
    );
    await connection.close();
    process.exitCode = 1;
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(async () => {
      await connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch (error) {
  console.error(`Could not start: ${error.message}`);
  console.error('Try: npm run db:start, then npm run seed, then npm start.');
  if (connection) await connection.close();
  process.exitCode = 1;
}
