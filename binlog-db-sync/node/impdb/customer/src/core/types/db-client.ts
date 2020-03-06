import { PoolConnection as IMySQLPoolConnection } from 'promise-mysql';

export interface IDBResult {
  data: any[];
  status: boolean;
  message?: string;
}

export interface IDBClient {
  query: (sql: string, values?: string[], connection?: IMySQLPoolConnection) => Promise<IDBResult>;
  close: () => Promise<void>;
  initDB?: (path: string) => void;
  doInTransaction: (
    handlers: Array<(conn: IMySQLPoolConnection) => {}>,
    extConnection?: IMySQLPoolConnection
  ) => Promise<void>;
}
