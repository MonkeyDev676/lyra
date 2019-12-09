class Utils {
  static isString(value) {
    return typeof value === 'string';
  }

  static isBoolean(value) {
    return typeof value === 'boolean';
  }

  static isNumber(value) {
    return typeof value === 'number';
  }

  static isFunction(value) {
    return typeof value === 'function';
  }

  static isArray(value) {
    return Array.isArray(value);
  }

  static isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  static stringify(value) {
    if (Utils.isFunction(value)) return value.toString();

    if (value === null) return 'null';

    if (value === undefined) return 'undefined';

    return JSON.stringify(value);
  }

  static isRef(value) {
    return value != null && !!value.__LYRA_REF__;
  }

  static isSchema(value) {
    return value != null && !!value.__LYRA_SCHEMA__;
  }

  static isCondition(value) {
    return value != null && !!value.__LYRA_CONDITION__;
  }
}

export default Utils;
