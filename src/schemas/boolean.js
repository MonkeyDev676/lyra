const assert = require('@botbind/dust/dist/assert');
const BaseSchema = require('./BaseSchema');

module.exports = new BaseSchema().define({
  type: 'boolean',
  flags: {
    sensitive: false,
  },
  messages: {
    'boolean.base': '{label} must be a boolean',
    'boolean.coerce': '{label} cannot be coerced to a boolean',
    'boolean.truthy': '{label} must be truthy',
    'boolean.falsy': '{label} must be falsy',
  },

  coerce: (value, { schema, createError }) => {
    if (typeof value === 'boolean') {
      return { value, errors: null };
    }

    if (typeof value === 'string') {
      value = schema.$flags.sensitive ? value.toLowerCase() : value;

      if (value === 'true') return { value: true, errors: null };

      if (value === 'false') return { value: false, errors: null };
    }

    return { value: null, errors: [createError('boolean.coerce')] };
  },

  validate: (value, { createError }) => {
    if (typeof value !== 'boolean') return { value: null, errors: [createError('boolean.base')] };

    return { value, errors: null };
  },

  rules: {
    sensitive: {
      method(enabled = true) {
        assert(
          typeof enabled === 'boolean',
          'The parameter enabled for boolean.sensitive must be a boolean',
        );

        return this.$setFlag('sensitive', enabled);
      },
    },

    truthy: {
      validate: (value, { createError }) => {
        if (value) return { value, errors: null };

        return { value: null, errors: [createError('boolean.truthy')] };
      },
    },

    falsy: {
      validate: (value, { createError }) => {
        if (!value) return { value, errors: null };

        return { value: null, errors: [createError('boolean.falsy')] };
      },
    },
  },
});
