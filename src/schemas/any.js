const BaseSchema = require('./BaseSchema');

module.exports = new BaseSchema().define({
  messages: {
    'any.custom': "{label} fails because validation '{name}' throws '{error}'",
  },

  rules: {
    custom: {
      method(method, name = 'unknown') {
        return this.$addRule({ name: 'custom', params: { method, name } });
      },
      validate: (value, helpers) => {
        try {
          return helpers.params.method(value, helpers);
        } catch (err) {
          return {
            value: null,
            errors: [helpers.createError('any.custom', { error: err, name: helpers.params.name })],
          };
        }
      },
      params: [
        {
          name: 'method',
          assert: resolved => typeof resolved === 'function',
          reason: 'must be a function',
          ref: false,
        },
        {
          name: 'name',
          assert: resolved => typeof resolved === 'string',
          reason: 'must be a string',
          ref: false,
        },
      ],
    },
  },
});
