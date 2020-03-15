const assert = require('@botbind/dust/src/assert');
const any = require('./any');

module.exports = any.extend({
  type: 'boolean',
  flags: {
    sensitive: false,
  },
  messages: {
    'boolean.base': '{#label} must be a boolean',
    'boolean.coerce': '{#label} cannot be coerced to a boolean',
    'boolean.truthy': '{#label} must be truthy',
    'boolean.falsy': '{#label} must be falsy',
  },

  coerce: (value, { schema, error }) => {
    if (typeof value !== 'string') return value;

    value = schema.$flags.sensitive ? value.toLowerCase() : value;

    if (value === 'true') return true;

    if (value === 'false') return false;

    return error('boolean.coerce');
  },

  validate: (value, { error }) => {
    return typeof value === 'boolean' ? value : error('boolean.base');
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
      validate: (value, { error }) => {
        return value || error('boolean.truthy');
      },
    },

    falsy: {
      validate: (value, { error }) => {
        return !value || error('boolean.falsy');
      },
    },
  },
});
