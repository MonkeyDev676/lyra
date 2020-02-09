const BaseSchema = require('./BaseSchema');

module.exports = new BaseSchema().define({
  type: 'function',
  messages: {
    'function.base': '{label} must be a function',
    'function.inherit': '{label} must inherit {ctor}',
  },

  validate: (value, { createError }) => {
    if (typeof value !== 'function') return { value: null, errors: [createError('function.base')] };

    return { value, errors: null };
  },

  rules: {
    inherit: {
      method(Ctor) {
        return this.$addRule({ name: 'inherit', params: { Ctor } });
      },
      validate: (value, { params, createError }) => {
        if (value.prototype instanceof params.Ctor) return { value, errors: null };

        return {
          value: null,
          errors: [createError('function.inherit', { ctor: params.Ctor })],
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
