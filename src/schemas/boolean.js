const Dust = require('@botbind/dust');
const { any } = require('./any');

module.exports = any.define({
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

  coerce: (value, { schema, error }) => {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      value = schema.$flags.sensitive ? value.toLowerCase() : value;

      if (value === 'true') return true;

      if (value === 'false') return false;
    }

    return error('boolean.coerce');
  },

  validate: (value, { error }) => {
    if (typeof value !== 'boolean') return error('boolean.base');

    return value;
  },

  rules: {
    sensitive: {
      method(enabled = true) {
        Dust.assert(
          typeof enabled === 'boolean',
          'The parameter enabled for boolean.sensitive must be a boolean',
        );

        return this.$setFlag('sensitive', enabled);
      },
    },

    truthy: {
      validate: (value, { error }) => {
        if (value) return value;

        return error('boolean.truthy');
      },
    },

    falsy: {
      validate: (value, { error }) => {
        if (!value) return value;

        return error('boolean.falsy');
      },
    },
  },
});
