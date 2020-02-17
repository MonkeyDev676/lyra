const assert = require('@botbind/dust/dist/assert');
const clone = require('@botbind/dust/dist/clone');
const compare = require('@botbind/dust/dist/compare');
const BaseSchema = require('./BaseSchema');
const any = require('./any');
const _isNumber = require('../internals/_isNumber');

module.exports = any.define({
  type: 'array',
  flags: {
    inner: {
      value: [],
      // immutable: true -> we don't need this here as base defaults to not clone schemas
      merge: (target, src) => [...target, ...src],
      set: (current, value) => [...current, ...value],
    },
  },
  messages: {
    'array.base': '{label} must be an array',
    'array.coerce': '{label} cannot be coerced to an array',
    'array.length': '{label} must have {length} items',
    'array.min': '{label} must have at least {length} items',
    'array.max': '{label} must have at most {length} items',
  },
  coerce: (value, { error }) => {
    try {
      return JSON.parse(value);
    } catch (err) {
      return error('array.coerce');
    }
  },

  validate: (value, { error, state, schema, opts }) => {
    if (!Array.isArray(value)) return error('array.base');

    const errors = [];

    // Shallow clone value
    value = clone(value, { recursive: false });
    state.dive(value);

    for (let i = 0; i < value.length; i++) {
      state.path = state.path === null ? `[${i}]` : `${state.path}[${i}]`;

      // todo: fix this line
      const result = schema.$flags.inner.$validate(value[i], opts, state);

      if (result.errors !== null) {
        if (opts.abortEarly) return result;

        errors.push(...result.errors);
      } else value[i] = result.value;
    }

    if (errors.length > 0)
      return {
        value: null,
        errors,
      };

    return { value, errors: null };
  },

  rules: {
    of: {
      method(inner) {
        assert(
          BaseSchema.isValid(inner),
          'The parameter inner for array.of must be a valid schema',
        );

        const target = this.$setFlag('inner', inner);

        target.$register(inner);

        return target;
      },
    },

    compare: {
      method: false,
      validate: (value, { args: { length, operator }, error, name }) => {
        if (compare(value.length, length, operator)) return value;

        return error(`array.${name}`, { length });
      },
      args: [
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
  },
});
