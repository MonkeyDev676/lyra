import { Constructor } from './types';

export default class Utils {
  public static isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  public static isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }

  public static isNumber(value: unknown): value is number {
    return typeof value === 'number';
  }

  public static isFunction(value: unknown): value is Function {
    return typeof value === 'function';
  }

  public static isArray(value: unknown): value is any[] {
    return Array.isArray(value);
  }

  public static isPlainObject(value: unknown): value is object {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  public static instanceOf<T = any>(obj: unknown, ctor: Constructor<T> | Function): obj is T {
    return obj instanceof ctor;
  }
}
