const compare = require('@botbind/dust/src/compare');
const AnySchema = require('./AnySchema');
const _isNumber = require('../internals/_isNumber');

const NumberSchema = AnySchema.define({
  type: 'number',
  flags: {
    unsafe: false,
  },
  messages: {
    'number.base': '{label} must be a number',
    'number.coerce': '{label} cannot be coerced to a number',
    'number.integer': '{label} must be an integer',
    'number.min': '{label} must be greater than or equal to {num}',
    'number.max': '{label} must be smaller than or equal to {num}',
    'number.multiple': '{label} must be a multiple of {num}',
    'number.divide': '{label} must divide {num}',
    'number.greater': '{label} must be greater than {num}',
    'number.smaller': '{label} must be smaller than {num}',
    'number.even': '{label} must be an even number',
    'number.infinity': '{label} cannot be infinity',
    'number.unsafe': '{label} must be a safe number',
  },

  coerce({ value, helpers }) {
    const coerce = Number(value);

    if (!Number.isNaN(coerce)) return { value: coerce, errors: null };

    return { value: null, errors: [helpers.createError('number.coerce')] };
  },

  validate({ value, helpers, schema }) {
    if (value === Infinity || value === -Infinity)
      return { value: null, errors: [helpers.createError('number.infinity')] };

    if (!_isNumber(value)) return { value: null, errors: [helpers.createError('number.base')] };

    if (
      !schema.$flags.unsafe &&
      (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER)
    )
      return { value: null, errors: [helpers.createError('number.unsafe')] };

    return { value, errors: null };
  },

  rules: {
    unsafe: {
      method() {
        return this.$setFlag('unsafe', true);
      },
    },

    compare: {
      method: false,
      validate({ value, params }) {
        return compare(value, params.num, params.operator);
      },
      params: [
        {
          name: 'num',
          assert: _isNumber,
          reason: 'must be a number',
        },
      ],
    },

    integer: {
      validate({ value }) {
        return Number.isInteger(value);
      },
    },

    min: {
      method(num) {
        return this.$addRule({ name: 'min', method: 'compare', params: { num, operator: '>=' } });
      },
    },

    max: {
      method(num) {
        return this.$addRule({ name: 'max', method: 'compare', params: { num, operator: '<=' } });
      },
    },

    greater: {
      method(num) {
        return this.$addRule({
          name: 'greater',
          method: 'compare',
          params: { num, operator: '>' },
        });
      },
    },

    smaller: {
      method(num) {
        return this.$addRule({
          name: 'smaller',
          method: 'compare',
          params: { num, operator: '<' },
        });
      },
      alias: ['less'],
    },

    multiple: {
      method(num) {
        return this.$addRule({ name: 'multiple', params: { num } });
      },
      validate({ value, params }) {
        return value % params.num === 0;
      },
      alias: ['divisible', 'factor'],
      params: [
        {
          name: 'num',
          assert: _isNumber,
          reason: 'must be a number',
        },
      ],
    },

    even: {
      method() {
        return this.$addRule({ name: 'even', method: 'multiple', params: { num: 2 } });
      },
    },

    divide: {
      method(num) {
        return this.$addRule({ name: 'divide', params: { num } });
      },
      validate({ value, params }) {
        return value % params.num === 0;
      },
      params: [
        {
          name: 'num',
          assert: _isNumber,
          reason: 'must be a number',
        },
      ],
    },
  },
});

module.exports = NumberSchema;
