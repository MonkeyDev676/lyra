const BaseSchema = require('./BaseSchema');

module.exports = new BaseSchema().define({
  type: 'function',
  messages: {
    'function.base': '{label} must be a function',
    'function.inherit': '{label} must inherit {ctor}',
  },

  validate: (value, helpers) => {
    if (typeof value !== 'function')
      return { value: null, errors: [helpers.createError('function.base')] };

    return { value, errors: null };
  },

  rules: {
    inherit: {
      method(Ctor) {
        return this.$addRule({ name: 'inherit', params: { Ctor } });
      },
      validate: (value, helpers) => {
        if (value.prototype instanceof helpers.params.Ctor) return { value, errors: null };

        return {
          value: null,
          errors: [helpers.createError('function.inherit', { ctor: helpers.params.Ctor })],
        };
      },
      params: [
        {
          name: 'Ctor',
          assert: resolved => typeof resolved === 'function',
          reason: 'must be a function',
        },
      ],
    },
  },
});
