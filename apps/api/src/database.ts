import { PrismaClient } from '@prisma/client';

export interface DatabaseProbe {
  checkAvailability(): Promise<boolean>;
}

export const createPrismaClient = (datasourceUrl: string): PrismaClient =>
  new PrismaClient({ datasourceUrl });

export const createDatabaseProbe = (client: PrismaClient): DatabaseProbe => ({
  async checkAvailability() {
    await client.$queryRaw`SELECT 1`;
    return true;
  },
});
