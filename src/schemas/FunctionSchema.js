const AnySchema = require('./AnySchema');

class FunctionSchema extends AnySchema {
  constructor() {
    super('function', {
      'function.inherit': '{{label}} must inherit {{ctor}}',
    });
  }

  check(value) {
    return typeof value === 'function';
  }

  inherit(ctor) {
    return this.test({
      params: {
        ctor: {
          value: ctor,
          assert: 'function',
        },
      },
      type: 'function.inherit',
      validate: ({ value, params }) => value.prototype instanceof params.ctor,
    });
  }
}

module.exports = FunctionSchema;
