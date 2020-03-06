import fs from 'fs';

import { PoolConnection as IMySQLPoolConnection } from 'promise-mysql';

import { errors, operands } from '../application-settings';
import { flatten, get } from '../helpers/common';
import { logger } from '../lib';
import ContextRequestParser from './helpers/context-request-parser';
import DataHelper from './helpers/data-helper';

import { DBClient } from '../lib/db-client';
import { ITables } from '../types/config';
import { IDBClient, IDBResult } from '../types/db-client';
import { IDataJsonApi, IJsonApi, IKeyValue, IQueryParams } from './../types/helpers';
import { ISchema } from './../types/model';

import ApplicationError from '../helpers/application-error';

export default class BaseModel {
  public contextRequestParser: ContextRequestParser;
  public dataHelper: DataHelper;
  public primaryField: string;
  public primaryActionField: string;

  protected dbClient: IDBClient;
  protected schemaPath: string;
  protected mainTable: string;
  protected actionTable: string;

  private limit: number;
  private schema: ISchema;

  constructor(tables: ITables, schemaPath?: string, dbClient?: DBClient) {
    this.dbClient = dbClient || global.dbClient;
    this.schemaPath = schemaPath;
    this.mainTable = tables.mainTable;
    this.actionTable = tables.actionTable || tables.mainTable;
    this.limit = 1000000;

    this.initModel(tables);
  }

  /**
   * Returns validation schema
   *
   * @returns {any}
   */
  public getSchema(): ISchema {
    if (!this.schema) {
      this.schema = JSON.parse(fs.readFileSync(this.schemaPath, 'utf8'));
    }
    return { ...this.schema };
  }

  /**
   * Getter for this.limit
   */
  public getLimit(): number {
    return this.limit;
  }
  /**
   * Formats data to response Json API format
   *
   * @param data
   */
  public async formatDataToResponse(
    data: any[],
    resource: string,
    buildRelationships?: boolean,
    isWaitingManyItemsInResult?: boolean
  ): Promise<IJsonApi[] | IJsonApi> {
    return await this.dataHelper.formatDataToResponse(data, resource, buildRelationships, isWaitingManyItemsInResult);
  }

  /**
   * Returns the rows of 'readTable' filtered by params
   * Use only this.readTable
   *
   * @param ctx {Context}
   * @param page
   * @returns {Promise<IDBResult>}
   */
  public async getByParams(
    requestFilter: IKeyValue,
    table?: string,
    connection?: IMySQLPoolConnection
  ): Promise<IDBResult> {
    const targetTable: string = table || this.mainTable;

    const params = this.contextRequestParser.parseParams(requestFilter);

    const query = await this.sqlQueryBuilder(params);
    const sql = `SELECT * FROM ${targetTable} WHERE ${query.where}`;

    const dbResult = await this.dbClient.query(sql, query.values, connection);
    if (!dbResult.status) {
      throw new ApplicationError(errors.FAIL_REQUEST_TO_DATABASE);
    }

    return dbResult;
  }

  /**
   * Returns the row of 'readTable' filtered by 'field' and 'value (if 'field' is not defined than it's filtered by primary field)
   * Use only this.readTable
   *
   * @param ctx {Context}
   * @returns {Promise<IDBResult>}
   */
  public async getRowByField(
    value: string,
    field?: string,
    table?: string,
    connection?: IMySQLPoolConnection
  ): Promise<IDBResult> {
    const targetTable: string = table || this.mainTable;
    const primaryField = field || this.primaryField;

    const sql = `SELECT * FROM ${targetTable} WHERE ${primaryField}=?`;

    const dbResult = await this.dbClient.query(sql, [value], connection);
    if (!dbResult.data.length) {
      throw new ApplicationError(errors.RESOURCE_NOT_FOUND);
    }

    return dbResult;
  }

  /**
   * Inserts new row into the this.mainTable
   *
   * @param ctx {Context}
   * @param table? {string}
   * @returns {Promise<IDBResult>}
   */
  public async create(
    requestBody: IDataJsonApi,
    table?: string,
    connection?: IMySQLPoolConnection
  ): Promise<IDBResult> {
    const targetTable: string = table || this.actionTable;
    const payload: IKeyValue = await this.contextRequestParser.parseBody(requestBody);

    const [keys, values] = [Object.keys(payload), Object.values(payload)];

    const symbols = '?, '.repeat(keys.length).slice(0, -2);
    const insertKeys = '`' + keys.join('`, `') + '`';
    const sql = `INSERT INTO ${targetTable} (${insertKeys}) VALUES (${symbols})`;

    const createResult = await this.dbClient.query(sql, values, connection);

    if (!createResult.status) {
      throw new ApplicationError(errors.FAIL_REQUEST_TO_DATABASE);
    }

    const insertId = get(createResult, 'data.insertId');
    const byField = this.mainTable === this.actionTable ? this.primaryActionField : 'source_id';
    const dbResult = await this.getRowByField(insertId, byField, targetTable, connection);
    return dbResult;
  }

  /**
   * Updates the rows filtered by filter
   *
   * @param ctx {Context}
   * @param table? {string}
   * @returns {Promise<IDBResult>}
   */
  public async update(
    requestBody: IDataJsonApi,
    id: string,
    table?: string,
    connection?: IMySQLPoolConnection
  ): Promise<IDBResult> {
    const targetTable: string = table || this.actionTable;
    const payload: IKeyValue = await this.contextRequestParser.parseBody(requestBody);

    const primaryField = this.primaryActionField;

    const params = [{ field: primaryField, operand: 'eq', values: [id] }];
    const query = await this.sqlQueryBuilder(params);

    if (Object.keys(payload).includes('created_by')) {
      delete payload.created_by;
    }

    const [keys, values] = [Object.keys(payload), Object.values(payload)];
    const sets = keys.map(key => '`' + key + '`' + '=?').join(', ');

    const sql = `UPDATE ${this.mainTable} SET ${sets} WHERE ${query.where}`;
    const updateResult = await this.dbClient.query(sql, [...values, ...query.values], connection);

    if (!updateResult.status) {
      throw new ApplicationError(errors.FAIL_REQUEST_TO_DATABASE);
    }

    const affectedRows = get(updateResult, 'data.affectedRows');
    if (!affectedRows) {
      throw new ApplicationError(errors.RESOURCE_NOT_FOUND);
    }

    const changedRows = get(updateResult, 'data.changedRows');

    if (!changedRows) {
      throw new ApplicationError(errors.NO_CONTENT);
    }

    const byField = this.mainTable === this.actionTable ? this.primaryActionField : 'source_id';
    const dbResult = await this.getRowByField(id, byField, targetTable, connection);
    return dbResult;
  }

  /**
   * Deletes the rows from 'actionTable' filtered by filter params
   * Use only this.actionTable
   *
   * @param ctx {Context}
   * @param table? {string}
   * @returns {Promise<IDBResult>}
   */
  public async delete(id: string, table?: string, connection?: IMySQLPoolConnection): Promise<IDBResult> {
    const params = [{ field: this.primaryActionField, operand: 'eq', values: [id] }];
    const query = await this.sqlQueryBuilder(params);

    const sql = `DELETE FROM ${this.mainTable} WHERE ${query.where}`;
    const deleteResult = await this.dbClient.query(sql, query.values, connection);

    if (!deleteResult.status) {
      throw new ApplicationError(errors.FAIL_REQUEST_TO_DATABASE);
    }

    const affectedRows = get(deleteResult, 'data.affectedRows');
    if (!affectedRows) {
      throw new ApplicationError(errors.RESOURCE_NOT_FOUND);
    }

    return { status: true, data: [] };
  }

  /**
   * Formats dbname.dbtable => `dbname`.`dbtable`
   * @param table
   */
  public formatDBTable(table: string): string {
    return table
      .split('.')
      .map((part: string) => `\`${part}\``)
      .join('.');
  }

  /**
   *
   * @param tableName
   */
  public getTableAliases(tableName: string): IKeyValue {
    const schema = this.getSchema();
    const aliases: IKeyValue = {};
    for (const [propertyKey, propertyValue] of Object.entries(schema.properties)) {
      if (Object.keys(propertyValue).includes('alias') && Object.keys(propertyValue.alias).includes(tableName)) {
        aliases[propertyKey] = propertyValue.alias[tableName];
      }
    }

    return aliases;
  }

  /**
   *
   * @param params
   */
  protected sqlQueryBuilder(params: IQueryParams[]): { where: string; values: string[] } {
    if (!params || params.length === 0) {
      return { where: '1', values: [] };
    }

    const operanadsWheres: string[] = [];
    const operanadsValues: any[] = [];
    for (const p of params) {
      operanadsWheres.push(`${p.field} ${operands[p.operand]}`);
      operanadsValues.push(p.values);
    }

    return { where: flatten(operanadsWheres).join(' AND '), values: flatten(operanadsValues) };
  }

  /**
   *
   * @param tables
   * @param relationshipsModels
   */
  private initModel(tables: ITables) {
    if (!this.dbClient) {
      logger.error(`Database client is not established!`);
      process.exit(1);
    }

    const schema = this.getSchema();

    this.dataHelper = new DataHelper(this.schema, tables);
    this.contextRequestParser = new ContextRequestParser(this.schema, tables);

    this.primaryField = this.findPrimaryKey();
    this.primaryActionField = get(schema, `properties.${this.primaryField}.alias.field_name`, this.primaryField);
  }

  /**
   *
   */
  private findPrimaryKey(): string {
    const schema = this.getSchema();
    for (const [propertyKey, propertyValue] of Object.entries(schema.properties)) {
      if (Object.keys(propertyValue).includes('primary') && propertyValue.primary) {
        return propertyKey;
      }
    }

    return 'id';
  }
}
