import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createPrismaClient } from '../database.js';
import { PERMISSION_CATALOG } from '../modules/authorization/permission-catalog.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDirectory, '../../../../.env'), quiet: true });

export const bootstrapAuthorizationCatalog = async (source: NodeJS.ProcessEnv = process.env) => {
  const { DATABASE_URL } = z.object({ DATABASE_URL: z.string().url() }).parse(source);
  const client = createPrismaClient(DATABASE_URL);
  try {
    for (const permission of PERMISSION_CATALOG) {
      await client.permission.upsert({
        where: { code: permission.code },
        create: permission,
        update: { description: permission.description },
      });
    }
    return { permissions: PERMISSION_CATALOG.length };
  } finally {
    await client.$disconnect();
  }
};

const run = async () => {
  const result = await bootstrapAuthorizationCatalog();
  process.stdout.write(`Catálogo de autorización sincronizado: ${result.permissions} permisos\n`);
};

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void run().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Error desconocido'}\n`);
    process.exitCode = 1;
  });
}
