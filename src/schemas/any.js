const BaseSchema = require('./BaseSchema');

module.exports = new BaseSchema().define({
  messages: {
    'any.custom': "{label} fails because validation '{name}' throws '{error}'",
  },

  rules: {
    custom: {
      single: false,
      method(method, name = 'unknown') {
        return this.$addRule({ name: 'custom', params: { method, name } });
      },
      validate: (value, helpers) => {
        const { params } = helpers;

        try {
          return params.method(value, helpers);
        } catch (err) {
          return {
            value: null,
            errors: [helpers.createError('any.custom', { error: err, name: params.name })],
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
