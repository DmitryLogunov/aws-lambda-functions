import { IRelationshipsReferenceDBTableColumns } from './relationships';

export interface IDBSettings {
  host: string;
  user: string;
  password: string;
  port: number;
  connectionLimit: number;
}

export interface ILogSettings {
  level: string;
  format: number;
  colorize: boolean;
  transports?: string;
  filename?: string;
}

export interface ITables {
  mainTable: string;
  actionTable?: string;
}

export interface IResourceRelationships {
  name: string;
  type: string;
  referenceTableAlias: string;
  relationshipResource: string;
  methods: string[];
  roleKey?: string;
  relationshipsReferenceDBTableColumns?: IRelationshipsReferenceDBTableColumns;
}
export interface IResource {
  name: string;
  prefix: string;
  methods: string[];
  tables: ITables;
  addOneToManyRelationshipsToResponse?: boolean;
  relationships?: IResourceRelationships[];
}

export interface IRelationshipTable {
  name: string;
  table: string;
}

interface IDBActionTables {
  [key: string]: string;
}
export interface IConfig {
  port: number;
  version?: string;
  resource: string;
  reqGuidHeader: string;
  defaultLimit: number;
  logSettings: ILogSettings;
  dbSettings: IDBSettings;
  actionTables: IDBActionTables;
  dbTables: IRelationshipTable[];
  resources: IResource[];
}

export interface IResourceSettings {
  controller: any;
  model: any;
}

export interface IResourcesSettings {
  [key: string]: IResourceSettings;
}
