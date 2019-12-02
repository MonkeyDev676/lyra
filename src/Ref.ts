import expr from 'property-expr';
import Utils from './Utils';
import LyraError from './errors/LyraError';

export default class Ref<T = any> {
  private _path: string;

  private _getter: expr.Getter;

  /**
   * A reference to another schema
   * @param path The path to the schema
   */
  constructor(path: string) {
    if (!Utils.isString(path))
      throw new LyraError('The parameter path for Lyra.Ref must be a string');

    this._path = path.trim();

    if (this._path === '')
      throw new LyraError('The parameter path for Lyra.Ref must be a non-empty string');

    this._getter = expr.getter(this._path, true);
  }

  /**
   * Resolves to a value from a given path
   * @param value The value to resolve
   */
  public resolve(value: object): T {
    return this._getter(value);
  }
}
