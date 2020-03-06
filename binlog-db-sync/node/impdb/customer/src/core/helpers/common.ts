import { IKeyValue } from '../types/model';

/**
 * The simple analog of lodash flatten
 *
 * @param arr
 */
export const flatten = (arr: any) => {
  return arr.reduce((flat: any, toFlatten: any) => {
    return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
  }, []);
};

/**
 * The simple analog of lodash get
 */
export const get = (object: any, path: string, defaultVal: any = null): any => {
  const keys = path.split('.');
  object = object[keys.shift()];
  if (object && keys.length > 0) {
    return get(object, keys.join('.'), defaultVal);
  }
  return object === undefined ? defaultVal : object;
};

/**
 * Returns unique array
 *
 * @param a
 */
export const unique = (a: string[]) => {
  for (let i = 0; i < a.length; ++i) {
    for (let j = i + 1; j < a.length; ++j) {
      if (a[i] === a[j]) {
        a.splice(j--, 1);
      }
    }
  }
  return a;
};
