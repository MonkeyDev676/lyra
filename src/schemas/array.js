const assert = require('@botbind/dust/src/assert');
const clone = require('@botbind/dust/src/clone');
const compare = require('@botbind/dust/src/compare');
const BaseSchema = require('./BaseSchema');
const _isNumber = require('../internals/_isNumber');

module.exports = new BaseSchema().define({
  type: 'array',
  flags: {
    inner: null,
  },
  messages: {
    'array.base': '{label} must be an array',
    'array.coerce': '{label} cannot be coerced to an array',
    'array.length': '{label} must have {length} items',
    'array.min': '{label} must have at least {length} items',
    'array.max': '{label} must have at most {length} items',
  },
  coerce: (value, { createError }) => {
    try {
      return { value: JSON.parse(value), errors: null };
    } catch (err) {
      return { value: null, errors: [createError('array.coerce')] };
    }
  },

  validate: (value, { createError, state, schema, opts }) => {
    if (!Array.isArray(value)) return { value: null, errors: [createError('array.base')] };

    const errors = [];

    // Shallow clone value
    value = clone(value, { recursive: false });
    state.dive(value);

    for (let i = 0; i < value.length; i++) {
      state.path = state.path === null ? `[${i}]` : `${state.path}[${i}]`;

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

        return this.$setFlag('inner', inner);
      },
    },

    compare: {
      method: false,
      validate({ value, params }) {
        return compare(value.length, params.length, params.operator);
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
  },
});
