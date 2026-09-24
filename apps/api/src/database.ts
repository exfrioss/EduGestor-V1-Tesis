import { Pool } from 'pg';

export interface DatabaseProbe {
  checkAvailability(): Promise<boolean>;
}

export const createDatabaseProbe = (connectionString: string): DatabaseProbe => {
  const pool = new Pool({ connectionString });

  return {
    async checkAvailability() {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    },
  };
};
