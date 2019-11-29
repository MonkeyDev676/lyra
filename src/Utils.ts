export default class Utils {
  public static isString(value: unknown): value is string {
    return typeof value === 'string';
  }
}
