const Constellation = require('@botbind/constellation');
const assert = require('@botbind/dust/src/assert');
const clone = require('@botbind/dust/src/clone');
const compare = require('@botbind/dust/src/compare');
const isObject = require('@botbind/dust/src/isObject');
const any = require('./any');
const Base = require('../base');
const Ref = require('../ref');
const _isNumber = require('../internals/_isNumber');

function _dependency(schema, peers, type) {
  assert(peers.length > 0, `The parameter peers for object.${type} must have at least one item`);

  assert(
    peers.every(peer => typeof peer === 'string' || Ref.isRef(peer)),
    `The parameter peers for object.${type} must contain only instances of Ref or strings`,
  );

  peers = peers.map(peer => (typeof peer === 'string' ? Ref.ref(peer) : peer));

  const target = schema.$clone();

  target.$index.dependencies.push([type, peers]);

  return target;
}

const _dependencies = {
  and: (value, peers, ancestors, context) => {
    for (const peer of peers) {
      if (peer.resolve(value, ancestors, context) === undefined) return peers;
    }

    return false;
  },
  nand: (value, peers, ancestors, context) => {
    for (const peer of peers) {
      if (peer.resolve(value, ancestors, context) === undefined) return false;
    }

    return peers;
  },
  or: (value, peers, ancestors, context) => {
    for (const peer of peers) {
      if (peer.resolve(value, ancestors, context) !== undefined) return false;
    }

    return peers;
  },
  xor: (value, peers, ancestors, context) => {
    let count = 0;

    for (const peer of peers) {
      if (peer.resolve(value, ancestors, context) !== undefined) {
        if (count === 0) count++;
        else return peers;
      }
    }

    if (count === 0) return peers;

    return false;
  },
  oxor: (value, peers, ancestors, context) => {
    let count = 0;

    for (const peer of peers) {
      if (peer.resolve(value, ancestors, context) !== undefined) {
        if (count === 0) count++;
        else return peers;
      }
    }

    return false;
  },
};

module.exports = any.extend({
  type: 'object',
  index: {
    keys: {
      merge: (target, src) => {
        for (let i = 0; i < src.length; i++) {
          const srcTerm = src[i];
          const targetTerm = target[i];

          if (targetTerm === undefined) target[i] = srcTerm;
          else target[i] = targetTerm.$merge(srcTerm);
        }

        return target;
      },
    },
    dependencies: {},
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
        if (opts.abortEarly) return result.errors;

        errors.push(...result.errors);
      } else if (subSchema.$getFlag('strip')) {
        delete value[key];
      } else if (result.value !== undefined || Object.prototype.hasOwnProperty.call(value, key))
        value[key] = result.value;
    }

    for (const [type, peers] of schema.$index.dependencies) {
      const failed = _dependencies[type](value, peers, state._ancestors, opts.context);

      if (!failed) {
        const err = error(`object.${type}`, { peers });

        if (opts.abortEarly) return err;

        errors.push(err);
      }
    }

    if (opts.stripUnknown) {
      keys.forEach(key => {
        delete value[key];
        keys.delete(key);
      });
    }

    if (!opts.allowUnknown) {
      for (const key of keys) {
        const err = error('object.unknown', undefined, state.dive(original, key));

        if (opts.abortEarly) return err;

        errors.push(err);
      }
    }

    return errors.length > 0 ? errors : value;
  },

  rules: {
    keys: {
      alias: ['of', 'shape'],
      method(keys) {
        assert(isObject(keys), 'The parameter keys for object.keys must be a plain object');

        const target = this.$clone();
        const keysKeys = Object.keys(keys);

        assert(
          keysKeys.length > 0,
          'The parameter keys for object keys must contain at least a valid schema',
        );

        assert(
          keysKeys.every(key => Base.isSchema(keys[key])),
          'The parameter keys for object.keys must contain valid schemas',
        );

        target.$index.keys = target.$index.keys.filter(([key]) => keys[key] === undefined);

        for (const key of keysKeys) {
          target.$index.keys.push([key, keys[key]]);
        }

        return target.$rebuild();
      },
    },

    compare: {
      method: false,
      validate: (value, { args: { length, operator }, error, name }) => {
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
          args: { length, operator: '=' },
        });
      },
    },

    min: {
      method(length) {
        return this.$addRule({
          name: 'min',
          method: 'compare',
          args: { length, operator: '>=' },
        });
      },
    },

    max: {
      method(length) {
        return this.$addRule({
          name: 'max',
          method: 'compare',
          args: { length, operator: '<=' },
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
