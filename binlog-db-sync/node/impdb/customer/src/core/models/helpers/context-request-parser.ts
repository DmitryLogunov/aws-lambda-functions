import { get } from '../../helpers/common';
import { ITables } from '../../types/config';
import { IDataJsonApi, IKeyValue, IQueryParams } from '../../types/helpers';
import { ISchema } from '../../types/model';
import { operands } from './../../application-settings';

import { errors } from '../../application-settings';
import ApplicationError from '../../helpers/application-error';

export default class ContextRequestParser {
  private regexp: RegExp;
  private operands: string[];
  private mainTable: string;

  constructor(schema: ISchema, tables: ITables) {
    this.regexp = /^filter\[(.+?)\](\[(.+?)\])?$/;
    this.operands = Object.keys(operands);
    this.mainTable = tables.mainTable;
  }

  /**
   * Parses object from JSON:API data format to <key:value> Object
   *
   * @param data - ctx.request.body
   * @returns {IKeyValue}
   */
  public async parseBody(data: IDataJsonApi): Promise<IKeyValue> {
    const attributes = get(data, 'data.attributes');
    return { ...attributes };
  }

  /**
   * Transform querystring from client to IQueryParams[]
   *
   * @param {IKeyValue} params
   * @returns {IQueryParams[]}
   */
  public parseParams(params: IKeyValue): IQueryParams[] {
    const filter: IQueryParams[] = [];

    for (const key in params) {
      if (params.hasOwnProperty(key)) {
        const [field, operandFromClient] = this.getProps(key);
        if (!field || !operandFromClient) {
          continue;
        }

        const valueByFilter = params[key];
        const values = Array.isArray(valueByFilter) ? [...valueByFilter] : [valueByFilter];
        const operand = values.length === 1 ? operandFromClient : operandFromClient === 'eq' ? 'in' : 'nin';
        filter.push({ field, operand, values });
      }
    }

    return filter;
  }

  /**
   * Return object as { id: 'ASC', title: 'DESC' }
   *
   * @param {string[] | string = []} params
   * @returns {IKeyValue}
   */
  public getSorting(params: string[] | string = []): { keys: string[]; condition: IKeyValue } {
    const result: { condition: IKeyValue; keys: string[] } = { keys: [], condition: {} };

    const iterableParams = this.getIterableValues(params);

    for (const key of iterableParams) {
      let sortKey = null;
      let operand = null;

      if (key[0] === '-') {
        sortKey = key.slice(1);
        operand = 'DESC';
      } else {
        sortKey = key;
        operand = 'ASC';
      }

      const chainTable = this.mainTable.concat('.', sortKey);
      const dbKey = chainTable
        .split('.')
        .map((part: string) => `\`${part}\``)
        .join('.');

      result.condition[dbKey] = operand;
      result.keys.push(sortKey);
    }
    return result;
  }

  /**
   * Check querystring by this.regex and returns key and value
   *
   * @param {string} queryString
   * @returns {string[]}
   */
  private getProps(queryString: string): string[] {
    const keys = queryString.match(this.regexp);
    if (!keys) {
      throw new ApplicationError(errors.INVALID_QUERY_PARAMETER(queryString));
    }

    const result = [keys[1], keys[3] || 'eq'];
    if (!this.operands.includes(result[1])) {
      throw new ApplicationError(errors.INVALID_QUERY_OPERAND(result[1]));
    }

    return result;
  }

  private getIterableValues(values: any): string[] {
    if (values && !values.length) {
      return [];
    }

    const iterableParams = Array.isArray(values) ? values.join(',').split(',') : String(values).split(',');
    return iterableParams;
  }
}
