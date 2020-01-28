const AnySchema = require('./AnySchema');

const FunctionSchema = AnySchema.define({
  type: 'function',
  messages: {
    'function.base': '{label} must be a function',
    'function.inherit': '{label} must inherit {ctor}',
  },

  validate({ value, helpers }) {
    if (typeof value !== 'function')
      return { value: null, errors: [helpers.createError('function.base')] };

    return { value, errors: null };
  },

  rules: {
    inherit: {
      method(Ctor) {
        return this.$addRule({ name: 'inherit', params: { Ctor } });
      },
      validate({ value, params }) {
        return value.prototype instanceof params.Ctor;
      },
      params: [
        {
          name: 'Ctor',
          assert(resolved) {
            return typeof resolved === 'function';
          },
          reason: 'must be a function',
        },
      ],
    },
  },
});

module.exports = FunctionSchema;
