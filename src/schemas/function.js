const { any } = require('./any');

module.exports = any.define({
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
      method(Ctor) {
        return this.$addRule({ name: 'inherit', args: { Ctor } });
      },
      validate: (value, { args: { Ctor }, error }) => {
        if (value.prototype instanceof Ctor) return value;

        return error('function.inherit', { ctor: Ctor });
      },
      args: [
        {
          name: 'Ctor',
          assert: resolved => typeof resolved === 'function',
          reason: 'must be a function',
        },
      ],
    },
  },
});
