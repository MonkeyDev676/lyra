import Utils from './Utils';
import LyraError from './errors/LyraError';
import { LooseObject } from './types';

export default class Ref<T = any> {
  public path: string;

  /**
   * A reference to another schema
   * @param path The path to the schema
   */
  constructor(path: string) {
    if (!Utils.isString(path))
      throw new LyraError('The parameter path for Lyra.Ref must be a string');

    this.path = path.trim();

    if (this.path === '')
      throw new LyraError('The parameter path for Lyra.Ref must be a non-empty string');
  }

  /**
   * Resolves to a value from a given path
   * @param value The value to resolve
   */
  public resolve(fields: LooseObject): T {
    return fields[this.path][1];
  }
}
