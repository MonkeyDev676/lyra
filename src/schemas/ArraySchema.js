const assert = require('@botbind/dust/src/assert');
const clone = require('@botbind/dust/src/clone');
const compare = require('@botbind/dust/src/compare');
const AnySchema = require('./AnySchema');

const ArraySchema = AnySchema.define({
  type: 'array',
  flags: {
    inner: null,
    reverse: false,
  },
  messages: {
    'array.base': '{label} must be an array',
    'array.coerce': '{label} cannot be coerced to an array',
    'array.length': '{label} must have {length} items',
    'array.min': '{label} must have at least {length} items',
    'array.max': '{label} must have at most {length} items',
  },

  coerce({ value, helpers }) {
    try {
      return { value: JSON.parse(value), errors: null };
    } catch (err) {
      return { value: null, errors: [helpers.createError('array.coerce')] };
    }
  },

  transform({ value, schema }) {
    if (schema.$flags.reverse) value = value.reverse();

    return value;
  },

  validate({ value, helpers, state, schema, opts }) {
    if (!Array.isArray(value)) return { value: null, errors: [helpers.createError('array.base')] };

    const errors = [];

    value = clone(value, { recursive: false });
    state.dive(value);

    for (let i = 0; i < value.length; i++) {
      const path = state.path === null ? `[${i}]` : `${state.path}[${i}]`;
      const result = schema.$flags.inner.$validate(value[i], opts, state.updatePath(path));

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
          this.$isValid(inner),
          'The parameter inner for array.of must be an instance of AnySchema',
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
          assert(resolved) {
            return typeof resolved === 'number';
          },
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

    reverse: {
      method() {
        return this.$setFlag('reverse', true);
      },
    },
  },
});

module.exports = ArraySchema;
