import isPlainObject from 'lodash/isPlainObject';
import LyraError from './errors/LyraError';

function serializeArrayLike(value) {
  return `${value.constructor.name}(${value.length}) [ ${value
    // eslint-disable-next-line no-use-before-define
    .map(subValue => Utils.serialize(subValue))
    .join(', ')} ]`;
}

class Utils {
  static isSchema(value) {
    return value != null && !!value.__LYRA_SCHEMA__;
  }

  static isRef(value) {
    return value != null && !!value.__LYRA_REF__;
  }

  static isValues(value) {
    return value != null && !!value.__LYRA_VALUES__;
  }

  static assert(condition, message) {
    if (!condition) throw new LyraError(message);
  }

  static getDeterminer(word) {
    return ['a', 'e', 'i', 'o', 'u'].includes(word[0]) ? 'an' : 'a';
  }

  static customizerToMessage(customizer) {
    Utils.assert(
      customizer instanceof Error || typeof customizer === 'string',
      'The parameter customizer for Lyra.Utils.customizerToMessage must be an instance of Error or a string',
    );

    if (customizer instanceof Error) return customizer.message;

    return customizer;
  }

  static serialize(value) {
    if (value === null) return 'null';

    if (value === undefined) return 'undefined';

    if (
      typeof value === 'number' ||
      typeof value === 'symbol' ||
      typeof value === 'boolean' ||
      typeof value === 'string' ||
      // eslint-disable-next-line valid-typeof
      typeof value === 'bigint' ||
      value instanceof Date ||
      value instanceof RegExp
    )
      return value.toString();

    if (typeof value === 'function') return `${value.name}() {}`;

    if (Utils.isRef(value)) return value._display;

    if (Utils.isValues(value)) return Utils.serialize(value.values());

    if (value instanceof WeakMap) return 'WeakMap {}';

    if (value instanceof WeakSet) return 'WeakSet {}';

    if (value instanceof DataView) return `DataView(${value.buffer.byteLength}) {}`;

    if (value instanceof ArrayBuffer) return `ArrayBuffer(${value.byteLength}) {}`;

    if (ArrayBuffer.isView(value) || Array.isArray(value)) return serializeArrayLike(value);

    if (isPlainObject(value)) {
      const serialized = Object.entries(value)
        .map(([key, subValue]) => `${key}: ${Utils.serialize(subValue)}`)
        .join(', ');

      return `{ ${serialized} }`;
    }

    if (value instanceof Map) {
      const serialized = Array.from(value)
        .map(([key, subValue]) => `${Utils.serialize(key)} => ${Utils.serialize(subValue)}`)
        .join(', ');

      return `Map(${value.size}) { ${serialized} }`;
    }

    if (value instanceof Set) {
      const serialized = Array.from(value)
        .map(subValue => Utils.serialize(subValue))
        .join(', ');

      return `Set(${value.size}) { ${serialized} }`;
    }

    if (value.constructor) return `${value.constructor.name} {}`;

    return 'Unknown';
  }
}

export default Utils;
