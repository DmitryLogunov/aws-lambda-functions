import { IResourceRelationships } from './config';
import { IDBResult } from './db-client';
import { IDataJsonApi, IFilters, IJsonApi, IQueryParams } from './helpers';

export interface IBaseModel {
  dataHelper: IModelsDataHelper;
  primaryField: string;
  primaryActionField: string;

  getSchema: () => ISchema;
  formatDataToResponse: (
    data: any[],
    resource: string,
    buildRelationships?: boolean,
    isWaitingManyItemsInResult?: boolean
  ) => Promise<IJsonApi[] | IJsonApi>;
  getByParams: (
    requestFilter: IKeyValue,
    selectFields?: string,
    limit?: string | number,
    page?: number,
    sort?: string,
    table?: string
  ) => Promise<IDBResult>;
  getRowByField: (value: string, field?: string, table?: string) => Promise<IDBResult>;
  create: (requestBody: IDataJsonApi, table?: string) => Promise<IDBResult>;
  update: (requestBody: IDataJsonApi, id: string, table?: string) => Promise<IDBResult>;
  delete: (id: string, table?: string) => Promise<IDBResult>;
}

export interface ISchema {
  $schema: string;
  $comment: string;
  $id: string;
  title: string;
  type: string;
  attributes: string[];
  required?: string[];
  relationships?: IRelationshipsSchema;
  properties: object;
}
export interface IRelationshipsSchemaSection {
  relation_table: string;
  resource_column: string;
  id_column: string;
}

export interface IRelationshipsSchema {
  [key: string]: IRelationshipsSchemaSection;
}

export interface IRelationshipsSection {
  data: { type: string; id: string };
}

export interface IRelationships {
  [key: string]: IRelationshipsSection;
}

export interface IRelationshipsModels {
  [key: string]: {
    model: IBaseModel;
    titleColumn: string;
  };
}

export interface IKeyValue {
  [key: string]: string;
}
export interface IRelationshipsData {
  [key: string]: IKeyValue;
}

export interface IRelationshipsHelper {
  buildRelationships: (data: IKeyValue) => Promise<IRelationships>;
  parseRelationships: (relationships: IRelationships) => Promise<IKeyValue>;
  getFiltersFromSchema: () => IFilters;
  getOneToManyRelationships: (
    resourceID: string,
    relashionshipSettings: IResourceRelationships
  ) => Promise<IRelationships>;
}

export interface IModelsDataHelper {
  formatDataToResponse: (
    data: IKeyValue[],
    resource: string,
    buildRelationships?: boolean,
    isWaitingManyItemsInResult?: boolean
  ) => Promise<IJsonApi[] | IJsonApi>;
  replaceAttributesKeysToActionTableAliases: (payload: IDataJsonApi) => Promise<IDataJsonApi>;
  splitParams: (params: IQueryParams[]) => [string[], string[]];
  getPrimaryField: () => string;
  limitation: (limit: number, page?: number) => string;
  getPayloadFromQueryParams: (params: IQueryParams[]) => IKeyValue;
}
