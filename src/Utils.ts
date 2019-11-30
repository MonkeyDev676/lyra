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

  public static isArray(value: unknown): value is any[] {
    return Array.isArray(value);
  }

  public static instanceOf<T extends Function>(obj: unknown, ctor: T): obj is T {
    return obj instanceof ctor;
  }
}
