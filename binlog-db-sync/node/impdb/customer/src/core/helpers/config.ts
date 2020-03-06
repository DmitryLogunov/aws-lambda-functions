import { IRelationshipTable } from '../types/config';

/**
 * Returns resource table
 *
 * @param resourceTableName
 */
export const getResourceTable = (resourceTableName: string): string | null => {
  const wantedResourceTable: IRelationshipTable = global.config.dbTables.find((dbTable: IRelationshipTable) => {
    return dbTable.name === resourceTableName;
  });

  if (!wantedResourceTable) {
    return;
  }

  return wantedResourceTable.table;
};
