const AnySchema = require('./AnySchema');

const truthyValues = ['true', '1', '+', 'on', 'enable', 'enabled', 't', 'yes', 'y', 1, true];
const falsyValues = ['false', '0', '-', 'off', 'disable', 'disabled', 'f', 'no', 'n', 0, false];

const BooleanSchema = AnySchema.define({
  type: 'boolean',
  messages: {
    'boolean.base': '{label} must be a boolean',
    'boolean.coerce': '{label} cannot be coerced to a boolean',
    'boolean.truthy': '{label} must be truthy',
    'boolean.falsy': '{label} must be falsy',
  },

  coerce({ value, helpers }) {
    if (truthyValues.includes(value)) return { value: true, errors: null };
    if (falsyValues.includes(value)) return { value: false, errors: null };

    return { value: null, errors: [helpers.createError('boolean.coerce')] };
  },

  validate({ value, helpers }) {
    if (typeof value !== 'boolean')
      return { value: null, errors: [helpers.createError('boolean.base')] };

    return { value, errors: null };
  },

  rules: {
    truthy: {
      validate({ value }) {
        return value;
      },
    },

    falsy: {
      validate({ value }) {
        return !value;
      },
    },
  },
});

module.exports = BooleanSchema;
