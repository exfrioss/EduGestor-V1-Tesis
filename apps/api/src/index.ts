import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadEnvironment } from './config.js';
import { createDatabaseProbe } from './database.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDirectory, '../../../.env'), quiet: true });

const environment = loadEnvironment();
const database = createDatabaseProbe(environment.DATABASE_URL);
const app = createApp(database);

app.listen(environment.API_PORT, '0.0.0.0', () => {
  console.log(`EduGestor API escuchando en el puerto ${environment.API_PORT}`);
});
