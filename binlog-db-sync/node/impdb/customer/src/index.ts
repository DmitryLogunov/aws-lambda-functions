import { DBClient } from './core/lib/db-client';
import SyncManager from './lib/sync-manager';

/**
 * The main handler of sync lambda function
 *
 * @param event
 */
export const handler = async (params: any) => {
  const dbSettings = {
    connectionLimit: parseInt(process.env.DB_CONNECTIONS_LIMIT || '2', 10),
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER
  };
  global.dbClient = new DBClient(dbSettings);

  const syncManager = new SyncManager();

  let response;
  try {
    await syncManager.execute(params);
    response = {
      body: JSON.stringify({ incommingParams: params }),
      statusCode: 200
    };
  } catch (e) {
    response = {
      body: JSON.stringify({ error: e.message }),
      statusCode: 400
    };
  }

  return response;
};
