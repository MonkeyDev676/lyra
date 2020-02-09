const Constellation = require('@botbind/constellation');
const assert = require('@botbind/dust/src/assert');
const clone = require('@botbind/dust/src/clone');
const isPlainObject = require('@botbind/dust/src/isPlainObject');
const compare = require('@botbind/dust/src/compare');
const BaseSchema = require('./BaseSchema');
const Ref = require('../Ref');
const _isNumber = require('../internals/_isNumber');

function _dependency(schema, peers, type, validate) {
  assert(peers.length > 0, `The parameter peers for object.${type} must have at least one item`);
  assert(
    peers.every(peer => Ref.isValid(peer)),
    `The parameter peers for object.${type} must contain only instances of Ref`,
  );
  // Improve consistency
  assert(
    peers.every(peer => peer._ancestor === 0),
    `The parameter peers for object.${type} must contain only self references`,
  );

  return schema.$setFlag('dependecies', next =>
    next.$flags.dependencies.push({
      type,
      validate,
    }),
  );
}

module.exports = new BaseSchema().define({
  type: 'object',
  flags: {
    inner: [],
    dependencies: [],
  },
  messages: {
    'object.base': '{label} must be an object',
    'object.coerce': '{label} cannot be coerced to an object',
    'object.unknown': '{path} is not allowed',
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

  coerce: (value, { createError }) => {
    try {
      return { value: JSON.parse(value), errors: null };
    } catch (err) {
      return { value: null, errors: [createError('object.coerce')] };
    }
  },

  validate: (value, { schema, state, opts, createError }) => {
    if (value === null || typeof value === 'object' || Array.isArray(value))
      return { value: null, errors: [createError('object.base')] };

    const errors = [];
    // const stripKeys = [];
    const keys = new Set(Object.keys(value));

    value = clone(value);
    state.dive(value);

    for (const [key, subSchema] of schema.$flags.inner) {
      const path = state.path === null ? key : `${state.path}.${key}`;

      keys.delete(key);

      const result = subSchema.$validate(value[key], opts, state.updatePath(path));

      if (result.errors !== null) {
        if (opts.abortEarly) return result;

        errors.push(...result.errors);
      } else if (subSchema.$flags.strip) {
        delete value[key];
      } else if (result.value !== undefined || Object.prototype.hasOwnProperty.call(value, key)) {
        // {a: undefined} -> {a: undefined}
        // {} -> {} (without this condition it would return {a: undefined})
        value[key] = result.value;
      }
    }

    for (const dependency of schema.$flags.dependencies) {
      const peers = dependency.validate(value, state.ancestors, opts.context);

      if (peers !== undefined) {
        const err = createError(`object.${dependency.type}`, {
          peers,
        });

        if (opts.abortEarly) return { value: null, errors: [err] };

        errors.push(err);
      }
    }

    /* stripKeys.forEach(key => {
      delete value[key];
      keys.delete(key);
    }); */

    if (opts.stripUnknown) {
      keys.forEach(key => {
        delete value[key];
        keys.delete(key);
      });
    }

    if (!opts.allowUnknown) {
      for (const key of keys) {
        const path = state.path === null ? key : `${state.path}.${key}`;

        const err = createError('object.unknown', { path });

        if (opts.abortEarly)
          return {
            value: null,
            errors: [err],
          };

        errors.push(err);
      }
    }

    if (errors.length > 0) return { value: null, errors };

    return { value, errors: null };
  },

  // TODO: resolve refs
  prepare: () => {},

  rules: {
    of: {
      method(inner) {
        assert(isPlainObject(inner), 'The parameter inner for object.of must be a plain object');

        const entries = Object.entries(inner);

        assert(
          entries.every(([, schema]) => BaseSchema.isValid(schema)),
          'The parameter inner for ObjectSchema must contain valid schemas',
        );

        // Treat {} as null
        if (entries.length !== 0) {
          const sorter = new Constellation();
          const refs = [];

          entries.forEach(([key, schema]) => {
            sorter.add(key);

            schema._refs.forEach(([ancestor, root]) => {
              if (ancestor - 1 > 0) refs.push([ancestor - 1, root]);
              else sorter.add(root, key);
            });
          });

          let keys;

          try {
            keys = sorter.sort();
          } catch (err) {
            throw err;
          }

          const schema = this.$setFlag(
            'inner',
            keys.map(key => [key, inner[key]]),
          );

          schema._refs.push(...refs);

          return schema;
        }

        return this;
      },
    },

    compare: {
      method: false,
      validate({ value, params }) {
        return compare(Object.entries(value).length, params.length, params.operator);
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
        return _dependency(this, peers, 'and', (value, ancestors, context) => {
          for (const peer of peers) {
            if (peer.resolve(value, ancestors, context) === undefined) return peers;
          }

          return undefined;
        });
      },
    },

    nand: {
      method(...peers) {
        return _dependency(this, peers, 'nand', (value, ancestors, context) => {
          for (const peer of peers) {
            if (peer.resolve(value, ancestors, context) === undefined) return undefined;
          }

          return peers;
        });
      },
    },

    or: {
      method(...peers) {
        return _dependency(this, peers, 'or', (value, ancestors, context) => {
          for (const peer of peers) {
            if (peer.resolve(value, ancestors, context) !== undefined) return undefined;
          }

          return peers;
        });
      },
    },

    xor: {
      method(...peers) {
        return _dependency(this, peers, 'xor', (value, ancestors, context) => {
          let count = 0;

          for (const peer of peers) {
            if (peer.resolve(value, ancestors, context) !== undefined) {
              if (count === 0) count++;
              else return peers;
            }
          }

          if (count === 0) return peers;

          return undefined;
        });
      },
    },

    oxor: {
      method(...peers) {
        return _dependency(this, peers, 'oxor', (value, ancestors, context) => {
          let count = 0;

          for (const peer of peers) {
            if (peer.resolve(value, ancestors, context) !== undefined) {
              if (count === 0) count++;
              else return peers;
            }
          }

          return undefined;
        });
      },
    },
  },
});
