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

  coerce: (value, helpers) => {
    if (typeof value === 'boolean') {
      return { value, errors: null };
    }

    if (typeof value === 'string') {
      const normalize = helpers.schema.$flags.sensitive ? value.toLowerCase() : value;

      if (normalize === 'true') return { value: true, errors: null };

      if (normalize === 'false') return { value: false, errors: null };
    }

    return { value: null, errors: [helpers.createError('boolean.coerce')] };
  },

  validate: (value, helpers) => {
    if (typeof value !== 'boolean')
      return { value: null, errors: [helpers.createError('boolean.base')] };

    return { value, errors: null };
  },

  rules: {
    sensitive: {
      method() {
        return this.$setFlag('sensitive', true);
      },
    },

    truthy: {
      validate: (value, helpers) => {
        if (value) return { value, errors: null };

        return { value: null, errors: [helpers.createError('boolean.truthy')] };
      },
    },

    falsy: {
      validate: (value, helpers) => {
        if (!value) return { value, errors: null };

        return { value: null, errors: [helpers.createError('boolean.falsy')] };
      },
    },
  },
});
