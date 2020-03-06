import mysql, { Pool as IMySQLPool, PoolConnection as IMySQLPoolConnection } from 'promise-mysql';
import { IDBSettings } from '../../../types/config';
import { IDBClient, IDBResult } from '../../../types/db-client';

/**
 * Implemets the base functionality of database  MySQL client
 */
export class MySQLClient implements IDBClient {
  private pool: IMySQLPool;
  private dbSettings: IDBSettings;

  constructor(dbSettings: IDBSettings) {
    this.dbSettings = dbSettings;
    this.pool = mysql.createPool(dbSettings);
    this.refreshConnection();
  }

  /**
   * Implements executing SQL query to database
   *
   * @param sql - Sql query
   * @param values - Values for sql query
   * @returns Promise<IDBResult>
   */

  public async query(sql: string, values: string[] = [], extConnection?: IMySQLPoolConnection): Promise<IDBResult> {
    try {
      const connection: IMySQLPoolConnection = extConnection || (await this.connection());

      const data: any[] = await connection.query(sql, values);
      if (!extConnection) {
        connection.release();
      }
      return { data, status: true };
    } catch (e) {
      return { data: [], status: false, message: e.message };
    }
  }

  /**
   * Closes all connections
   */
  public async close() {
    this.pool.end();
  }

  /**
   * Do some DB queries in SQL transaction
   *
   * @param handlers
   */

  public async doInTransaction(
    handlers: Array<(conn: IMySQLPoolConnection) => {}>,
    extConnection?: IMySQLPoolConnection
  ) {
    const connection: IMySQLPoolConnection = extConnection || (await this.connection());
    try {
      await connection.query('START TRANSACTION');
      for (const handler of handlers) {
        await handler(connection);
      }
      await connection.query('COMMIT');
      await connection.release();
    } catch (e) {
      await connection.query('ROLLBACK');
      await connection.release();
      throw new Error('Database transaction error');
    }
  }

  /**
   * Returns DB connection
   *
   * @returns Promise<IMySQLPoolConnection|null>
   */
  public async connection(): Promise<IMySQLPoolConnection | null> {
    const connection: IMySQLPoolConnection = await this.pool.getConnection();
    if (!connection) {
      return;
    }

    return connection;
  }

  /**
   * Refreshes and checks the DB connection
   */
  private refreshConnection() {
    this.connection()
      .then((connection: IMySQLPoolConnection) => {
        if (!connection) {
          throw new Error('Database connection error');
        }
      })
      .catch((e: Error) => {
        process.exit(1);
      });
  }
}
