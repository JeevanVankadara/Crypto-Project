import mongoose from 'mongoose';
import { createModels } from './models/index.js';

export async function connectDatabase(config) {
  const connection = await mongoose
    .createConnection(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    })
    .asPromise();
  const models = createModels(connection);
  await Promise.all(Object.values(models).map((model) => model.init()));
  return { connection, models };
}
