import { get } from '../../helpers/common';
import { IResource, ITables } from '../../types/config';
import { IDataJsonApi, IFilters, IJsonApi, IKeyValue, IQueryParams } from '../../types/helpers';
import { IRelationshipsHelper, IRelationshipsModels, ISchema } from '../../types/model';

export default class DataFormatterHelper {
  private schema: ISchema;
  private relationshipsHelper: IRelationshipsHelper;
  private relationshipsFiltersFromSchema: IFilters;
  private relationshipsTitlesFiltersFromSchema: string[];

  constructor(schema: ISchema, tables: ITables, relationshipsModels?: IRelationshipsModels) {
    this.schema = schema;
    this.relationshipsFiltersFromSchema = {};
    this.relationshipsTitlesFiltersFromSchema = [];
  }

  /**
   * Formats an array of data objects to JSON:API
   *
   * @param data
   * @returns {IJsonApi[]}
   */

  public async formatDataToResponse(
    data: IKeyValue[],
    resource: string,
    buildRelationships?: boolean,
    isWaitingManyItemsInResult?: boolean
  ): Promise<IJsonApi[] | IJsonApi> {
    if (!data.length) {
      return [];
    }
    if (!Array.isArray(data)) {
      return [];
    }

    const responseData = await Promise.all(
      data.map(item => this.formatDataItemToJsonApi(item, resource, buildRelationships))
    );
    if (typeof isWaitingManyItemsInResult === 'undefined' || !isWaitingManyItemsInResult) {
      return responseData.length > 1 ? responseData : responseData[0];
    }
    return responseData;
  }

  /**
   * Replaces keys with them aliases in payload\
   *
   * @param payload
   * @returns {Promise<any>}
   */
  public async replaceAttributesKeysToActionTableAliases(payload: IDataJsonApi): Promise<IDataJsonApi> {
    const newPayload: IDataJsonApi = {
      data: {
        attributes: {},
        id: payload.data.id,
        relationships: {},
        type: payload.data.type
      }
    };

    for (const key in payload.data.attributes) {
      if (payload.data.attributes.hasOwnProperty(key)) {
        for (const [fieldTitle, fieldData] of Object.entries(this.schema.properties)) {
          if (get(fieldData, 'alias.field_name') === key) {
            newPayload.data.attributes[fieldTitle] = payload.data.attributes[key];
          }
        }
      }
    }

    return newPayload;
  }

  /**
   * Returns 'payload' (IKeyValue) builded from 'queryParams' (IQueryParams[])
   *
   * @param params
   */
  public getPayloadFromQueryParams(params: IQueryParams[]): IKeyValue {
    const payload: IKeyValue = {};

    for (const paramsItem of params) {
      const filterTitle = paramsItem.field;

      const filterAttributeTitles = filterTitle.split(',').map((a: string) => a.trim());
      for (let filterAttributeTitle of filterAttributeTitles) {
        if (this.relationshipsTitlesFiltersFromSchema.includes(filterAttributeTitle)) {
          if (!Object.keys(this.relationshipsFiltersFromSchema[filterAttributeTitle]).includes('referenceTable')) {
            filterAttributeTitle = this.relationshipsFiltersFromSchema[filterAttributeTitle].column;
          } else {
            continue;
          }
        }

        payload[filterAttributeTitle] = paramsItem.values[0];
      }
    }

    return payload;
  }

  /**
   * Returns the limitation in SQL format (such as 'LIMIT start, limit')
   *
   * @param page
   * @returns {string}
   */
  public limitation(limit: number, page: number = 0): string {
    const limits = page >= 0 ? `LIMIT ${limit * page}, ${limit}` : '';
    return limits;
  }

  /**
   * Format a data object to JSON:API
   *
   * @param object
   * @returns {IJsonApi}
   */
  private async formatDataItemToJsonApi(
    data: IKeyValue,
    resource: string,
    buildRelationships?: boolean
  ): Promise<IJsonApi> {
    const id: string = String(data.id || null);
    const responseData: IJsonApi = { id, type: resource };

    const attributes: IKeyValue = {};

    for (const key in data) {
      if (key === 'id') {
        continue;
      }
      if (this.schema.attributes && this.schema.attributes.includes(key)) {
        attributes[key] = data[key] ? String(data[key]) : null;
        continue;
      }
    }

    if (attributes && Object.keys(attributes).length) {
      responseData.attributes = { ...attributes };
    }

    if (typeof buildRelationships === 'undefined' || buildRelationships) {
      responseData.relationships = await this.relationshipsHelper.buildRelationships(data);

      const resourceSettings: IResource = get(
        global.config.resources.filter((r: IResource) => (r.name = resource)),
        '[0]'
      );
      if (resourceSettings && resourceSettings.addOneToManyRelationshipsToResponse) {
        const resourceOneToManyRelationshipsPromises = [];
        const resourceOneToManyRelationshipsNames = [];
        for (const relationshipSettings of resourceSettings.relationships) {
          if (Object.keys(responseData.relationships).includes(relationshipSettings.name)) {
            continue;
          }
          resourceOneToManyRelationshipsPromises.push(
            this.relationshipsHelper.getOneToManyRelationships(id, relationshipSettings)
          );
          resourceOneToManyRelationshipsNames.push(relationshipSettings.name);
        }

        if (!resourceOneToManyRelationshipsPromises) {
          return responseData;
        }

        const resourceOneToManyRelationshipsPromisesResolved = await Promise.all(
          resourceOneToManyRelationshipsPromises
        );

        for (let index = 0; index < resourceOneToManyRelationshipsNames.length; index++) {
          responseData.relationships[resourceOneToManyRelationshipsNames[index]] =
            resourceOneToManyRelationshipsPromisesResolved[index];
        }
      }
    }

    return responseData;
  }
}
