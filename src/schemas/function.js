const { any } = require('./any');

module.exports = any.extend({
  type: 'function',
  messages: {
    'function.base': '{label} must be a function',
    'function.inherit': '{label} must inherit {ctor}',
  },

  validate: (value, { error }) => {
    if (typeof value !== 'function') return error('function.base');

    return value;
  },

  rules: {
    inherit: {
      single: false,
      method(ctor) {
        return this.$addRule({ name: 'inherit', args: { ctor } });
      },
      validate: (value, { args: { ctor }, error }) => {
        if (value.prototype instanceof ctor) return value;

        return error('function.inherit', { ctor });
      },
      args: {
        ctor: {
          assert: resolved => typeof resolved === 'function',
          reason: 'must be a function',
        },
      },
    },
  },
});
