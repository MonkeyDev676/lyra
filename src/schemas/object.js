const Constellation = require('@botbind/constellation');
const Dust = require('@botbind/dust');
const any = require('./any');
const { isSchema } = require('./base');
const { ref, isRef } = require('../ref');
const _hasKey = require('../internals/_hasKey');
const _isNumber = require('../internals/_isNumber');

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
    'object.base': '{label} must be an object',
    'object.coerce': '{label} cannot be coerced to an object',
    'object.unknown': '{label} is not allowed',
    'object.length': '{label} must have {length} entries',
    'object.min': '{label} must have at least {length} entries',
    'object.max': '{label} must have at most {length} entries',
    'object.instance': '{label} must be an instance of {ctor}',
    'object.and': '{label} must contain all of {peers}',
    'object.nand': '{label} must not contain all of {peers}',
    'object.or': '{label} must contain at least one of {peers}',
    'object.xor': '{label} must contain one of {peers}',
    'object.oxor': '{label} must contain one or none of {peers}',
  },

  coerce: (value, { error }) => {
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
    if (!Dust.isObject(value) || Array.isArray(value)) return error('object.base');

    const abortEarly = opts.abortEarly;
    const errors = [];
    const keys = new Set(Object.keys(value));

    // Shallow clone
    value = Dust.clone(value, { recursive: false });

    for (const [key, subSchema] of schema.$index.keys) {
      const subValue = value[key];
      const divedState = state.dive(original, key);

      keys.delete(key);

      const result = subSchema.$validate(subValue, opts, divedState);

      if (result.errors !== null) {
        if (abortEarly) return result.errors;

        errors.push(...result.errors);
      } else if (subSchema.$flags.strip) {
        delete value[key];
      } else if (result.value !== undefined || _hasKey(value, key)) value[key] = result.value;
    }

    for (const [type, peers] of schema.$index.dependencies) {
      const failed = _dependencies[type](value, peers, state._ancestors, opts.context);

      if (!failed) {
        const err = error(`object.${type}`, { peers });

        if (abortEarly) return err;

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

        if (abortEarly) return err;

        errors.push(err);
      }
    }

    return errors.length > 0 ? errors : value;
  },

  rules: {
    keys: {
      alias: ['of', 'shape'],
      method(keys) {
        Dust.assert(
          Dust.isPlainObject(keys),
          'The parameter keys for object.keys must be a plain object',
        );

        const target = this.$clone();
        const keysKeys = Object.keys(keys);

        Dust.assert(
          keysKeys.length > 0,
          'The parameter keys for object keys must contain at least a valid schema',
        );

        Dust.assert(
          keysKeys.every(key => isSchema(keys[key])),
          'The parameter keys for object.keys must contain valid schemas',
        );

        target.$index.keys =
          target.$index.keys === null
            ? []
            : target.$index.keys.filter(([key]) => keys[key] === undefined);

        for (const key of keysKeys) {
          target.$index.keys.push([key, keys[key]]);
        }

        return target.$rebuild();
      },
    },

    compare: {
      method: false,
      validate({ value, params }) {
        return Dust.compare(Object.keys(value).length, params.length, params.operator);
      },
      params: [
        {
          name: 'length',
          assert: _isNumber,
          reason: 'must be a number',
        },
      ],
    },

    length: {
      method(length) {
        return this.$addRule({
          name: 'length',
          method: 'compare',
          params: { length, operator: '=' },
        });
      },
    },

    min: {
      method(length) {
        return this.$addRule({
          name: 'min',
          method: 'compare',
          params: { length, operator: '>=' },
        });
      },
    },

    max: {
      method(length) {
        return this.$addRule({
          name: 'max',
          method: 'compare',
          params: { length, operator: '<=' },
        });
      },
    },

    instance: {
      method(ctor) {
        return this.$addRule({ name: 'instance', params: { ctor } });
      },
      validate({ value, params }) {
        return value instanceof params.ctor;
      },
      params: [
        {
          name: 'ctor',
          assert(resolved) {
            return resolved === 'function';
          },
          reason: 'must be a function',
        },
      ],
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

function _dependency(schema, peers, type) {
  Dust.assert(
    peers.length > 0,
    `The parameter peers for object.${type} must have at least one item`,
  );
  Dust.assert(
    peers.every(peer => typeof peer === 'string' || isRef(peer)),
    `The parameter peers for object.${type} must contain only instances of Ref or strings`,
  );

  peers = peers.map(peer => (typeof peer === 'string' ? ref(peer) : peer));

  const target = schema.$clone();

  if (target.$index.dependencies === null) target.$index.dependencies = [];

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
