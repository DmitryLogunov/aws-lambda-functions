import { get, unique } from '../../helpers/common';
import { IKeyValue } from '../../types/model';
import { ISyncParams } from '../../types/sync';
import { logger } from '../index';

import { PoolConnection as IMySQLPoolConnection } from 'promise-mysql';

/**
 * Implements the base functionality for synchronization manager
 */
export default class BaseSyncManager {
  /**
   * The main sync handler (starts the sycnhronization process)
   * @param params
   */
  public async execute(params: ISyncParams) {
    try {
      /** execute sync */
      const executeSync = async (connection: IMySQLPoolConnection) => {
        await this.sync(params, connection);
      };

      await global.dbClient.doInTransaction([executeSync]);
    } catch (e) {
      /** In case it has thrown the error we should rollback updated sync tables */
      throw Error(e.message);
    }
  }

  /**
   * Implements the syncronization logics
   * @param params
   */
  protected async sync(params: ISyncParams, connection: IMySQLPoolConnection): Promise<any> {
    return;
  }

  /**
   * Formats value to DB string format (add `` quotes)
   * @param value
   */
  protected nullOrString(value: null | string): null | string {
    return value ? `'${value}'` : null;
  }

  /**
   * Parses Item data from JSON string
   * @param param
   */
  protected getItemData(params: ISyncParams): IKeyValue {
    let customerData;
    const customerJSONData = get(params, 'Data');
    if (!customerJSONData) {
      logger.info(`Warning: Impossible to insert Customer into rcsredb.accounts. Customer data is undefined.`);
      return;
    }

    try {
      customerData = JSON.parse(customerJSONData);
    } catch (e) {
      logger.info(`Error: Parsing Customer data failed. Params: ${params}`);
      return;
    }

    if (!customerData) {
      logger.info(`Warning: Impossible to insert Customer into rcsredb.accounts. Customer data is empty.`);
      return;
    }

    return customerData;
  }
}
