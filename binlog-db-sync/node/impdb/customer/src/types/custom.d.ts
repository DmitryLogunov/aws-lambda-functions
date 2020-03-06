/* tslint:disable */

declare namespace NodeJS {
  interface Global {
    dbClient: import('../core/types/db-client').IDBClient;
    config: import('../core/types/config').IConfig;
  }
}
