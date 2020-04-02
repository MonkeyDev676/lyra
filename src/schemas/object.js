const Constellation = require('@botbind/constellation');
const assert = require('@botbind/dust/src/assert');
const clone = require('@botbind/dust/src/clone');
const compare = require('@botbind/dust/src/compare');
const isObject = require('@botbind/dust/src/isObject');
const isPlainObject = require('@botbind/dust/src/isPlainObject');
const any = require('./any');
const Ref = require('../ref');
const _isNumber = require('../internals/_isNumber');

function _dependency(schema, peers, type) {
  assert(peers.length > 0, `The parameter peers for object.${type} must have at least one item`);

  assert(
    peers.every(peer => typeof peer === 'string' || Ref.isRef(peer)),
    `The parameter peers for object.${type} must contain only instances of Ref or strings`,
  );

  peers = peers.map(peer => schema.$root.compile.ref(peer, { ancestor: 0 }));

  const target = schema.$clone();

  target.$index.dependencies.push([type, peers]);

  return target;
}

function _extract(schema, keys) {
  if (schema.type !== 'object') return undefined;

  const currentKey = keys.shift();
  const child = schema.$index.keys.find(([key]) => key === currentKey);

  if (child === undefined) return undefined;

  if (keys.length === 0) return child[1];

  return _extract(child[1], keys);
}

const _dependencies = {
  and: (value, peers, ancestors, context) => {
    for (const peer of peers) {
      if (peer.resolve(value, ancestors, context) === undefined) return false;
    }

    return true;
  },
  nand: (value, peers, ancestors, context) => {
    for (const peer of peers) {
      if (peer.resolve(value, ancestors, context) === undefined) return true;
    }

    return false;
  },
  or: (value, peers, ancestors, context) => {
    for (const peer of peers) {
      if (peer.resolve(value, ancestors, context) !== undefined) return true;
    }

    return false;
  },
  xor: (value, peers, ancestors, context) => {
    let count = 0;

    for (const peer of peers) {
      if (peer.resolve(value, ancestors, context) !== undefined) {
        if (count === 0) count++;
        else return false;
      }
    }

    if (count === 0) return false;

    return true;
  },
  oxor: (value, peers, ancestors, context) => {
    let count = 0;

    for (const peer of peers) {
      if (peer.resolve(value, ancestors, context) !== undefined) {
        if (count === 0) count++;
        else return false;
      }
    }

    return true;
  },
};

module.exports = any.extend({
  type: 'object',
  index: {
    keys: {
      merge: (target, src) => {
        const keys = new Map();

        target = [...target];

        for (let i = 0; i < target.length; i++) {
          keys.set(target[i][0], i);
        }

        for (const [key, schema] of src) {
          const pos = keys.get(key);

          if (pos === undefined) target.push([key, schema]);
          else target[pos] = [key, target[pos][1].merge(schema)];
        }

        return target;
      },
    },
    dependencies: {},
    patterns: {},
  },
  messages: {
    'object.base': '{#label} must be an object',
    'object.coerce': '{#label} cannot be coerced to an object',
    'object.unknown': '{#label} is not allowed',
    'object.length': '{#label} must have {length} entries',
    'object.min': '{#label} must have at least {length} entries',
    'object.max': '{#label} must have at most {length} entries',
    'object.instance': '{#label} must be an instance of {ctor}',
    'object.and': '{#label} must contain all of {peers}',
    'object.nand': '{#label} must not contain all of {peers}',
    'object.or': '{#label} must contain at least one of {peers}',
    'object.xor': '{#label} must contain one of {peers}',
    'object.oxor': '{#label} must contain one or none of {peers}',
    'object.pattern.key': '{#label} contains key {key} that does not follow the provided pattern',
    'object.pattern.value':
      '{#label} contains value {value} of key {key} that does not follow the provided pattern',
  },

  args: (schema, keys) => {
    return schema.keys(keys);
  },

  coerce: (value, { error }) => {
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (err) {
      return error('object.coerce');
    }
  },

  rebuild: schema => {
    const sorter = Constellation.sorter();
    const keys = new Map(schema.$index.keys);

    for (const [key, subSchema] of schema.$index.keys) {
      sorter.add(key, subSchema.$references());
    }

    schema.$index.keys = sorter.sort().map(key => [key, keys.get(key)]);
  },

  validate: (value, { schema, state, opts, error, original }) => {
    if (!isObject(value) || Array.isArray(value)) return error('object.base');

    if (opts.recursive === false) return value;

    const errors = [];
    const keys = new Set(Object.keys(value));

    // Shallow clone
    value = clone(value, { recursive: false });

    for (const [key, subSchema] of schema.$index.keys) {
      const subValue = value[key];
      const divedState = state.dive(original, key);

      keys.delete(key);

      const result = subSchema.$validate(subValue, opts, divedState);

      if (result.errors !== null) {
        if (opts.abortEarly !== false) return result.errors;

        errors.push(...result.errors);
      } else if (subSchema.$getFlag('strip')) {
        delete value[key];
      } else if (result.value !== undefined || Object.prototype.hasOwnProperty.call(value, key))
        value[key] = result.value;
    }

    // Patterns
    for (const key of keys) {
      const subValue = value[key];
      const divedState = state.dive(original, key);

      for (const [keyPattern, valuePattern] of schema.$index.patterns) {
        let result = keyPattern.$validate(key, opts, divedState);

        if (result.errors !== null) {
          const err = error('object.pattern.key', { key });

          if (opts.abortEarly !== false) return err;

          errors.push(err);

          // No point matching value if key already fails
          continue;
        }

        if (valuePattern === undefined) continue;

        result = valuePattern.$validate(subValue, opts, divedState);

        if (result.errors !== null) {
          const err = error('object.pattern.value', { key, value: subValue });

          if (opts.abortEarly !== false) return err;

          errors.push(err);
        }
      }
    }

    // Deps
    for (const [type, peers] of schema.$index.dependencies) {
      const failed = _dependencies[type](value, peers, state._ancestors, opts.context);

      if (!failed) {
        const err = error(`object.${type}`, { peers: peers.map(peer => peer.display) });

        if (opts.abortEarly !== false) return err;

        errors.push(err);
      }
    }

    if (opts.stripUnknown) {
      for (const key of keys) {
        delete value[key];
        keys.delete(key);
      }
    }

    let allowUnknown = schema.$getFlag('unknown');

    allowUnknown =
      allowUnknown === undefined ? /* Defaults to false */ opts.allowUnknown : allowUnknown;

    if (!allowUnknown) {
      for (const key of keys) {
        const err = error('object.unknown', undefined, state.dive(original, key));

        if (opts.abortEarly !== false) return err;

        errors.push(err);
      }
    }

    return errors.length > 0 ? errors : value;
  },

  rules: {
    unknown: {
      method(enabled = true) {
        assert(
          typeof enabled === 'boolean',
          'The parameter enabled for objet.unknown must be a boolean',
        );

        return this.$setFlag('unknown', enabled);
      },
    },

    extract: {
      alias: ['get', 'reach'],
      method(path, opts = {}) {
        assert(typeof path === 'string', 'The parameter path for object.extract must be a string');

        assert(isObject(opts), 'The parameter opts for object.extract must be a plain object');

        assert(
          opts.separator === undefined || typeof opts.separator === 'string',
          'The option separator for object.extract must be a string',
        );

        const keys = path.split(opts.separator === undefined ? '.' : opts.separator);

        return _extract(this, keys);
      },
    },

    keys: {
      alias: ['of', 'shape', 'entries'],
      method(keys) {
        assert(isPlainObject(keys), 'The parameter keys for object.keys must be a plain object');

        const keysKeys = Object.keys(keys);

        assert(
          keysKeys.length > 0,
          'The parameter keys for object.keys must contain at least a valid schema',
        );

        const target = this.$clone();

        target.$index.keys = target.$index.keys.filter(([key]) => keys[key] === undefined);

        for (const key of keysKeys) {
          assert(
            keys[key] !== undefined,
            'The parameter keys for object.keys must not contain undefineds',
          );

          target.$index.keys.push([key, this.$root.compile(keys[key])]);
        }

        return target.$rebuild();
      },
    },

    pattern: {
      method(keyPattern, valuePattern) {
        assert(keyPattern !== undefined, 'The parameter key for object.pattern must be provided');

        const target = this.$clone();
        const pattern = [];

        keyPattern = this.$root.compile(keyPattern);

        pattern.push(keyPattern);

        if (valuePattern !== undefined) {
          valuePattern = this.$root.compile(valuePattern);

          pattern.push(valuePattern);
        }

        target.$index.patterns.push(pattern);

        return target.$rebuild();
      },
    },

    compare: {
      method: false,
      validate: (value, { args: { length }, error, name, operator }) => {
        return compare(Object.keys(value).length, length, operator)
          ? value
          : error(`object.${name}`, { length });
      },
      args: {
        length: {
          assert: _isNumber,
          reason: 'must be a number',
        },
      },
    },

    length: {
      method(length) {
        return this.$addRule({
          name: 'length',
          method: 'compare',
          args: { length },
          operator: '=',
        });
      },
    },

    min: {
      method(length) {
        return this.$addRule({
          name: 'min',
          method: 'compare',
          args: { length },
          operator: '>=',
        });
      },
    },

    max: {
      method(length) {
        return this.$addRule({
          name: 'max',
          method: 'compare',
          args: { length },
          operator: '<=',
        });
      },
    },

    instance: {
      method(ctor) {
        return this.$addRule({ name: 'instance', args: { ctor } });
      },
      validate: (value, { args: { ctor }, error }) => {
        return value instanceof ctor ? value : error('object.instance', { ctor });
      },
      args: {
        ctor: {
          assert: arg => typeof arg === 'function',
          reason: 'must be a function',
        },
      },
    },

    and: {
      method(...peers) {
        return _dependency(this, peers, 'and');
      },
    },

    nand: {
      method(...peers) {
        return _dependency(this, peers, 'nand');
      },
    },

    or: {
      method(...peers) {
        return _dependency(this, peers, 'or');
      },
    },

    xor: {
      method(...peers) {
        return _dependency(this, peers, 'xor');
      },
    },

    oxor: {
      method(...peers) {
        return _dependency(this, peers, 'oxor');
      },
    },
  },
});
