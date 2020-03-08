const Dust = require('@botbind/dust');
const any = require('./any');
const _isNumber = require('../internals/_isNumber');

module.exports = any.extend({
  type: 'number',
  flags: {
    unsafe: false,
    loose: false,
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

  coerce: (value, { schema, error }) => {
    if (!schema.$flags.loose && typeof value !== 'string') return error('number.coerce');

    const coerce = Number(value);

    if (!Number.isNaN(coerce)) return value;

    return error('number.coerce');
  },

  validate: (value, { schema, error }) => {
    if (value === Infinity || value === -Infinity) return error('number.infinity');

    if (!_isNumber(value)) return error('number.base');

    if (
      !schema.$flags.unsafe &&
      (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER)
    )
      return error('number.unsafe');

    return value;
  },

  rules: {
    loose: {
      method(enabled = true) {
        Dust.assert(
          typeof enabled === 'boolean',
          'The parameter enabled for number.loose must be a boolean',
        );

        return this.$setFlag('loose', enabled);
      },
    },

    unsafe: {
      method(enabled = true) {
        Dust.assert(
          typeof enabled === 'boolean',
          'The parameter enabled for number.unsafe must be a boolean',
        );

        return this.$setFlag('unsafe', enabled);
      },
    },

    compare: {
      method: false,
      validate: (value, { args: { num, operator }, name, error }) => {
        if (Dust.compare(value, num, operator)) return value;

        return error(`number.${name}`, { num });
      },
      args: [
        {
          name: 'num',
          assert: _isNumber,
          reason: 'must be a number',
        },
      ],
    },

    integer: {
      validate: (value, { error }) => {
        if (Number.isInteger(value)) return value;

        return error('number.integer');
      },
    },

    min: {
      method(num) {
        return this.$addRule({ name: 'min', method: 'compare', args: { num, operator: '>=' } });
      },
    },

    max: {
      method(num) {
        return this.$addRule({ name: 'max', method: 'compare', args: { num, operator: '<=' } });
      },
    },

    greater: {
      method(num) {
        return this.$addRule({
          name: 'greater',
          method: 'compare',
          args: { num, operator: '>' },
        });
      },
    },

    smaller: {
      alias: ['less'],
      method(num) {
        return this.$addRule({
          name: 'smaller',
          method: 'compare',
          args: { num, operator: '<' },
        });
      },
    },

    multiple: {
      single: false,
      alias: ['divisible', 'factor'],
      method(num) {
        return this.$addRule({ name: 'multiple', args: { num } });
      },
      validate: (value, { args: { num }, error }) => {
        if (value % num === 0) return value;

        return error('number.multiple', { num });
      },
      args: [
        {
          name: 'num',
          assert: _isNumber,
          reason: 'must be a number',
        },
      ],
    },

    even: {
      method() {
        return this.$addRule({ name: 'even', method: 'multiple', args: { num: 2 } });
      },
    },

    divide: {
      single: false,
      method(num) {
        return this.$addRule({ name: 'divide', args: { num } });
      },
      validate: (value, { args: { num }, error }) => {
        if (num % value === 0) return value;

        return error('number.divide', { num });
      },
      args: [
        {
          name: 'num',
          assert: _isNumber,
          reason: 'must be a number',
        },
      ],
    },
  },
});
