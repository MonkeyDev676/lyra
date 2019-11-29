import expr from 'property-expr';
import Utils from './Utils';
import LyraError from './LyraError';

export default class Ref {
  private _path: string;

  private _getter: expr.Getter;

  public __isRef__ = true;

  /**
   * A reference to another schema
   * @param path The path to the schema
   */
  constructor(path: string) {
    if (!Utils.isString(path)) throw new LyraError('The path for Lyra.Ref must be a string');

    this._path = path.trim();

    if (this._path === '') throw new LyraError('The path for Lyra.Ref must be a non-empty string');

    this._getter = expr.getter(this._path, true);
  }

  /**
   * Resolves to a value from a given path
   * @param value The value to resolve
   */
  public resolve(value: object) {
    return this._getter(value);
  }

  /**
   * Check if an object is a Lyra reference
   * @param ref The object to check
   */
  static isRef(obj: unknown) {
    return obj != null && (obj as Ref).__isRef__;
  }
}
