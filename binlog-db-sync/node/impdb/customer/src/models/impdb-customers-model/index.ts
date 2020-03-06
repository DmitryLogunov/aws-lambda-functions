import { DBClient } from '../../core/lib/db-client';
import BaseModel from '../../core/models/base-model';
import { ITables } from '../../core/types/config';
import { IDBResult } from '../../core/types/db-client';
import { EnumIsActive } from '../../core/types/enums';
import { IDataJsonApi } from '../../core/types/helpers';

import { get } from '../../core/helpers/common';

import path from 'path';

/**
 * Implemets the base functionality of model
 */
export default class ImpdbCustomersModel extends BaseModel {
  constructor(tables: ITables, schemaPath?: string, dbClient?: DBClient) {
    super(tables, schemaPath || path.resolve(__dirname + '/schema.json'), dbClient);
  }
}
