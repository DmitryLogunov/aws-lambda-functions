export interface IPaginationLinks {
  self: string;
  first?: string;
  prev?: string;
  next?: string;
  last?: string;
}

export interface IJsonApi {
  id?: string;
  type: string;
  attributes?: any;
  relationships?: any;
}

export interface IDataJsonApi {
  data: IJsonApi;
}

export interface IQueryParams {
  field: string;
  operand: string;
  values: string[];
}
export interface IKeyValue {
  [key: string]: string;
}

export interface IQueryWhere {
  delimiter?: string;
  template: string;
  values: string[];
}

export interface IQueryJoin {
  tableAlias: string;
  column: string;
  referenceTable: string;
  referenceTableAlias: string;
  referenceColumn: string;
}

export interface IQuery {
  table: string;
  where: IQueryWhere;
  joins: string[];
  order?: string;
}

export interface IFilters {
  [key: string]: {
    column: string;
    referenceTable?: string;
    referenceJoinColumn?: string;
    referenceQueryColumn?: string;
  };
}

export interface IQueryByAttributes {
  [key: string]: {
    aliases?: IKeyValue;
    wheres: IQueryWhere[];
    join?: string;
  };
}
