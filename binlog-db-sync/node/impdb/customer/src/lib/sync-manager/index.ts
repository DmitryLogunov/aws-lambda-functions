import { PoolConnection as IMySQLPoolConnection } from 'promise-mysql';

import { get } from '../../core/helpers/common';
import { logger } from '../../core/lib';
import BaseSyncManager from '../../core/lib/base-sync-manager';
import { IDBResult } from '../../core/types/db-client';
import { EnumIsActive } from '../../core/types/enums';
import { IKeyValue } from '../../core/types/model';
import { ISyncParams } from '../../core/types/sync';
import ImpdbCustomersModel from '../../models/impdb-customers-model';

/**
 * Implements the base functionality of synchronization
 */
export default class SyncManager extends BaseSyncManager {
  private excludedFromComparingFields: string[];
  private impdbCustomersModel: ImpdbCustomersModel;
  private customerAccountTypeID: number;

  constructor() {
    super();
    this.impdbCustomersModel = new ImpdbCustomersModel({ mainTable: 'impdb.customer' });
    this.excludedFromComparingFields = ['last_modified', 'last_synced'];
  }

  public async sync(params: ISyncParams, connection?: IMySQLPoolConnection) {
    const data = this.getItemData(params);
    if (!data) {
      return;
    }
    const action = get(params, 'Action');
    logger.info(`New event => action: ${action}, data: ${JSON.stringify(data)}`);

    const { exists, equal } = await this.checkAccount(data, connection);

    switch (action) {
      case 'insert':
      case 'update':
        switch (exists) {
          case true:
            if (!equal) {
              return await this.update(data, connection);
            }
            return;
          case false:
            return await this.insert(data, connection);
        }
      case 'delete':
        switch (exists) {
          case true:
            return await this.delete(data, connection);
          case false:
            return { data: null, status: false };
        }
    }
  }

  /**
   *
   * @param customerID
   * @param connection
   */
  private async insert(customerData: IKeyValue, connection?: IMySQLPoolConnection): Promise<IDBResult> {
    const customerID = get(customerData, 'id');
    if (!customerID) {
      logger.info(
        `Warning: Impossible to insert Customer into rcsredb.accounts. CustomerID is undefined. CustomerData: ${customerData}`
      );
      throw Error(`Impossible to insert Customer into rcsredb.accounts. CustomerID is undefined. CustomerData: ${customerData}`);
    }

    const uid = get(customerData, 'uid');
    const mailboxID = get(customerData, 'mailbox_id');
    const externalID = mailboxID ? `${uid}_${mailboxID}` : uid;
    const customerAccountTypeID = await this.getAccountTypeId(connection);

    const insertAccountSQL = `
      INSERT INTO \`rcsredb\`.\`accounts\` (\`external_id\`, \`title\`, \`email\`, \`phone\`, \`is_active\`, \`account_type_id\`, \`source_table\`, \`source_id\`)
      VALUES (${this.nullOrString(externalID)}, ${this.nullOrString(customerData.name)}, 
      ${this.nullOrString(customerData.email)},  ${this.nullOrString(customerData.mobile)},
      ${this.nullOrString(this.isCustomerActive(customerData.is_active))}, ${this.nullOrString(
      String(customerAccountTypeID)
    )}, 'impdb.customer', ${customerID})
    `;

    const accountInsert = await global.dbClient.query(insertAccountSQL, null, connection);
    const accountInsertId = get(accountInsert.data, 'insertId');
    if (!accountInsertId) {
      logger.info(
        `Error: Impossible to insert customer into rcsredb.accounts. MySQL error response (customerID: ${customerID}, sql: ${insertAccountSQL}).`
      );
      throw Error(`Impossible to insert customer into rcsredb.accounts. MySQL error response (customerID: ${customerID}, sql: ${insertAccountSQL})`);
    }

    const { impPod, roleID } = await this.selectCustomer(customerID, connection);
    if (impPod) {
      await this.insertOrUpdateAccountsHasRoles(customerID, accountInsertId, impPod, roleID, connection);
    }

    const selectAccountDataSQL = `SELECT * FROM \`rcsredb\`.\`accounts\` AS a WHERE a.\`id\` = ${accountInsertId}`;
    const dbResultSelectAccount = await global.dbClient.query(selectAccountDataSQL, null, connection);
    logger.info(`The DB result of account inserting: ${JSON.stringify(dbResultSelectAccount)}.`);
    return dbResultSelectAccount;
  }

  /**
   *
   * @param customerID
   * @param connection
   */
  private async update(customerData: IKeyValue, connection?: IMySQLPoolConnection): Promise<IDBResult> {
    const customerID = get(customerData, 'id');
    if (!customerID) {
      logger.info(
        `Warning: Impossible to update Customer into rcsredb.accounts. CustomerID is undefined. CustomerData: ${customerData}`
      );
      throw Error(`Impossible to update Customer into rcsredb.accounts. CustomerID is undefined. CustomerData: ${customerData}`);
    }

    const selectAccountSQL = `SELECT * FROM \`rcsredb\`.\`accounts\` AS a WHERE a.\`source_id\` = ${customerID} AND a.\`source_table\` = 'impdb.customer'`;
    const selectAccountData = (await global.dbClient.query(selectAccountSQL, null, connection)).data.shift();
    if (!selectAccountData) {
      logger.info(
        `Warning: Impossible to update customer in rcsredb.accounts. The account for customer does not exist (customerID: ${customerID}).`
      );
      throw Error(`Impossible to update customer in rcsredb.accounts. The account for customer does not exist (customerID: ${customerID}).`);
    }

    const { impPod, roleID } = await this.selectCustomer(customerID, connection);
    if (impPod) {
      await this.insertOrUpdateAccountsHasRoles(customerID, selectAccountData.id, impPod, roleID, connection);
    }

    const uid = get(customerData, 'uid');
    const mailboxID = get(customerData, 'mailbox_id');
    const externalID = mailboxID ? `${uid}_${mailboxID}` : uid;
    const customerAccountTypeID = await this.getAccountTypeId(connection);

    const updateAccountSQL = `
      UPDATE \`rcsredb\`.\`accounts\`
      SET 
        source_id = ${this.nullOrString(customerID)},
        external_id = ${this.nullOrString(externalID)},
        is_active = ${this.nullOrString(this.isCustomerActive(customerData.is_active))},
        title = ${this.nullOrString(customerData.name)},
        email = ${this.nullOrString(customerData.email)},
        phone = ${this.nullOrString(customerData.mobile)},
        account_type_id = ${this.nullOrString(String(customerAccountTypeID))}
      WHERE \`id\` = '${selectAccountData.id}'
    `;
    const dbResultUpdateAccount = await global.dbClient.query(updateAccountSQL, null, connection);
    if (!dbResultUpdateAccount.status) {
      logger.error(
        `Fail DB result of account updating: ${JSON.stringify(dbResultUpdateAccount)}, SQL: ${updateAccountSQL}.`
      );
      throw Error(`Fail DB result of account updating: ${JSON.stringify(dbResultUpdateAccount)}, SQL: ${updateAccountSQL}.`);
    }

    const dbResultSelectAccount = await global.dbClient.query(selectAccountSQL, null, connection);
    logger.info(`The DB result of account updating: ${JSON.stringify(dbResultSelectAccount)}.`);
    return dbResultSelectAccount;
  }

  /**
   *
   * @param customerID
   * @param connection
   */
  private async delete(customerData: IKeyValue, connection?: IMySQLPoolConnection): Promise<IDBResult> {
    const customerID = get(customerData, 'id');
    if (!customerID) {
      logger.info(
        `Warning: Impossible to insert Customer into rcsredb.accounts. CustomerID is undefined. CustomerData: ${customerData}`
      );
      throw Error(`Impossible to insert Customer into rcsredb.accounts. CustomerID is undefined. CustomerData: ${customerData}`);
    }
    const deleteCustomerInAccountsHasRolesSQL = `DELETE FROM \`rcsredb\`.\`accounts_has_roles\` WHERE resource_id = ${customerID}`;
    await global.dbClient.query(deleteCustomerInAccountsHasRolesSQL, null, connection);

    const deleteCustomerInAccountsHasClustersSQL = `DELETE FROM \`rcsredb\`.\`accounts_has_clustes\` WHERE resource_id = ${customerID}`;
    await global.dbClient.query(deleteCustomerInAccountsHasClustersSQL, null, connection);

    const deleteCustomerInAccountsHasMembershipsSQL = `DELETE FROM \`rcsredb\`.\`accounts_has_memberships\` WHERE resource_id = ${customerID}`;
    await global.dbClient.query(deleteCustomerInAccountsHasMembershipsSQL, null, connection);

    const selectAccountDataSQL = `SELECT * FROM \`rcsredb\`.\`accounts\` AS a WHERE a.\`source_id\` = ${customerID} AND a.\`source_table\` = 'impdb.customer'`;
    const selectAccountData = (await global.dbClient.query(selectAccountDataSQL, null, connection)).data.shift();
    if (!selectAccountData) {
      logger.info(
        `Warning: Impossible to update customer account in rcsredb.accounts. Customer does not exist (customerID: ${customerID}).`
      );
      throw Error(`Impossible to update customer account in rcsredb.accounts. Customer does not exist (customerID: ${customerID}).`);
    }
    const deleteCustomerAccountSQL = `DELETE FROM \`rcsredb\`.\`accounts\` WHERE id = '${selectAccountData.id}'`;
    const resDeleteCustomerAccount = await global.dbClient.query(deleteCustomerAccountSQL, null, connection);
    const deletedCustomerAccountData = selectAccountData;
    const dbResultDeleteAccount = { data: [deletedCustomerAccountData], status: resDeleteCustomerAccount.status };
    logger.info(`The DB result of account deleting: ${JSON.stringify(dbResultDeleteAccount)}.`);
    return dbResultDeleteAccount;
  }

  /**
   *
   * @param customerID
   * @param connection
   */
  private async insertOrUpdateAccountsHasRoles(
    customerID: string,
    accountInsertId: number,
    impPodInSreClustersID: string,
    clustersRoleID: string,
    connection?: IMySQLPoolConnection
  ): Promise<IDBResult> {
    const selectAccountHasCluster = `
        SELECT 
          ahc.id AS accounts_has_clusters_id
        FROM \`rcsredb\`.\`accounts_has_clusters\` AS ahc
        WHERE ahc.source_table = 'impdb.customer' AND ahc.source_id = ${customerID}
      `;
    const accountHasCluster = await global.dbClient.query(selectAccountHasCluster, null, connection);
    const accountHasClusterData = accountHasCluster.data.shift();

    if (!accountHasCluster.status || !accountHasClusterData) {
      const insertResourceContextRolesSQL = `
          INSERT INTO \`rcsredb\`.\`accounts_has_clusters\` (\`resource_id\`, \`context_id\`, \`role_id\`, \`source_id\`, \`source_table\`)
          VALUES (${accountInsertId}, ${impPodInSreClustersID}, ${clustersRoleID}, ${customerID}, 'impdb.customer')
        `;
      return await global.dbClient.query(insertResourceContextRolesSQL, null, connection);
    }

    const updateResourceContextRolesSQL = `
        UPDATE \`rcsredb\`.\`accounts_has_clusters\`
        SET context_id = ${impPodInSreClustersID}
        WHERE id = ${accountHasClusterData.accounts_has_clusters_id}
      `;
    return await global.dbClient.query(updateResourceContextRolesSQL, null, connection);
  }

  /**
   *
   * @param customerID
   * @param impPodInSreClustersID
   * @param connection
   */
  private async selectCustomer(
    customerID: string,
    connection: IMySQLPoolConnection
  ): Promise<{ impPod: string; roleID: string }> {
    const selectCustomerSQL = `
      SELECT 
        sre_clusters.id AS imp_pod,
        r.id AS role_id
      FROM \`impdb\`.\`customer\` AS c
      LEFT JOIN 
        ( 
          SELECT  sre_cl.\`id\`, sre_cl.\`title\` 
          FROM \`rcsredb\`.\`clusters\` AS sre_cl 
          WHERE  sre_cl.source_table = 'rccmrdb.pod'
        ) AS sre_clusters ON CONCAT(IF(c.pod * 1 < 10, 'P0', 'P'), c.pod) = sre_clusters.title
      LEFT JOIN \`rcsredb\`.\`roles\` AS r ON r.key = 'ACCOUNT_RELATES_TO_CLUSTER' 
      WHERE c.id = ${customerID}
    `;

    const customerData = (await global.dbClient.query(selectCustomerSQL, null, connection)).data.shift();
    return { impPod: get(customerData, 'imp_pod'), roleID: get(customerData, 'role_id') };
  }

  /**
   *
   */
  private async getAccountTypeId(connection: IMySQLPoolConnection): Promise<number> {
    if (this.customerAccountTypeID) {
      return this.customerAccountTypeID;
    }
    const selectAccountTypeIDFromDixtionariesSQL = `SELECT id FROM \`rcsredb\`.\`dictionaries\` AS d WHERE d.\`type\` = 'account_type' AND d.\`title\` = 'customer'`;
    const dbResultAccountType = await global.dbClient.query(selectAccountTypeIDFromDixtionariesSQL, null, connection);
    this.customerAccountTypeID = get(dbResultAccountType.data.shift(), 'id');
    return this.customerAccountTypeID;
  }

  /**
   *
   * @param data
   */
  private async checkAccount(data: IKeyValue, connection?: IMySQLPoolConnection) {
    const customerID = get(data, 'id');
    if (!customerID) {
      return { exists: false, equal: false };
    }
    const selectAccountSQL = `SELECT * FROM \`rcsredb\`.\`accounts\` AS a WHERE a.\`source_table\` = 'impdb.customer' AND a.\`source_id\` = '${customerID}'`;
    const accountDBResult = await global.dbClient.query(selectAccountSQL, null, connection);
    if (!get(accountDBResult, 'data') || accountDBResult.data.length === 0) {
      return { exists: false, equal: false };
    }

    const accountData = accountDBResult.data[0];
    return { exists: true, equal: this.isEqual(data, accountData) };
  }

  /**
   *
   * @param data1
   * @param data2
   */
  private isEqual(dataCustomer: IKeyValue, dataAccount: IKeyValue): boolean {
    const accountTableAliases = this.impdbCustomersModel.getTableAliases('rcsredb.accounts');

    /** Excluding from comparing the fields which have datetime values
     *  and automatically change with each data change (e.g. created_at)
     */
    for (const excludedField of this.excludedFromComparingFields) {
      if (Object.keys(accountTableAliases).includes(excludedField)) {
        delete accountTableAliases[excludedField];
      }
    }

    for (const comparingCustomerKey of Object.keys(accountTableAliases)) {
      if (dataCustomer[comparingCustomerKey] !== dataAccount[accountTableAliases[comparingCustomerKey]]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if customer is active
   * @param isActive
   */
  private isCustomerActive(isActive: string | number): EnumIsActive {
    if (isActive && isActive === '2') {
      return EnumIsActive.Active;
    }
    return EnumIsActive.NotActive;
  }
}
