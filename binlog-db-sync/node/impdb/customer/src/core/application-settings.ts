import { IKeyValue } from './types/model';

export const errors = {
  BAD_REQUEST: {
    code: 400,
    message: 'bad request'
  },
  CONTROLLER_METHOD_NOT_ALLOWED: {
    code: 400,
    message: 'controller method not allowed'
  },
  COULD_NOT_RESOLVE_DATABASE_ACTION_MODELS: {
    code: 400,
    message: 'could not resolve database action models'
  },
  FAIL_REQUEST_TO_DATABASE: {
    code: 400,
    message: 'an error occurred while requesting to the database'
  },
  INCORRECT_RELATIONSHIPS_CONTEXT: {
    code: 400,
    message: 'incorrect relationshps context'
  },
  INCORRECT_RELATIONSHIPS_DATA: {
    code: 400,
    message: 'incorrect relationshps data'
  },
  INVALID_DATA: {
    code: 400,
    message: 'invalid data'
  },
  INVALID_ID: {
    code: 400,
    message: 'id must be a number'
  },
  INVALID_PAGE_NUMBER: {
    code: 400,
    message: 'page[number] must be a number'
  },
  INVALID_PAGE_SIZE: {
    code: 400,
    message: 'page[size] must be a number'
  },
  INVALID_QUERY_OPERAND: (detail: string) => {
    return {
      code: 400,
      message: `invalid query operand - ${detail}`
    };
  },
  INVALID_QUERY_PARAMETER: (detail: string) => {
    return {
      code: 400,
      message: `invalid query parameter - ${detail}`
    };
  },
  METHOD_NOT_ALLOWED: {
    code: 405,
    message: 'method not allowed'
  },
  NO_CONTENT: {
    code: 204,
    message: 'no content'
  },
  RESOURCE_NOT_FOUND: {
    code: 404,
    message: 'resource not found'
  },
  UNDEFINED_ACCOUNT_TYPE: {
    code: 400,
    message: 'undefined account type'
  },
  UNDEFINED_DATABSE_ACTION_TABLE_SOURCE_ID: {
    code: 400,
    message: 'undeifined database action table source_id'
  },
  UNKNOWN_DATABASE_ERROR: {
    code: 400,
    message: 'unknown database error'
  },
  UNKNOWN_RESOURCE_TYPE: (detail: string) => {
    return {
      code: 400,
      message: `unknown resource type - ${detail}`
    };
  },
  UNKNOWN_SORT_PARAMETER: (detail: string) => {
    return {
      code: 400,
      message: `unknown sort parameter - ${detail}`
    };
  },
  VALIDATE_ERROR: (detail: string) => {
    return { code: 400, message: detail };
  }
};

export const operands: IKeyValue = {
  eq: '=?',
  gt: '>?',
  gte: '>=?',
  in: 'IN',
  like: 'LIKE',
  lt: '<?',
  lte: '<=?',
  ne: '<>?',
  nin: 'NOT IN'
};

export const defaultRelationshipsReferenceDBTableColumns = {
  contextIdColumn: 'context_id',
  resourceIdColumn: 'resource_id',
  roleIdColumn: 'role_id'
};
