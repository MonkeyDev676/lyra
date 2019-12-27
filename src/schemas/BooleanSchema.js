const AnySchema = require('./AnySchema');

const truthyValues = ['true', '1', '+', 'on', 'enable', 'enabled', 't', 'yes', 'y', 1, true];

const falsyValues = ['false', '0', '-', 'off', 'disable', 'disabled', 'f', 'no', 'n', 0, false];

class BooleanSchema extends AnySchema {
  constructor() {
    super('boolean', {
      'boolean.truthy': '{{label}} must be truthy',
      'boolean.falsy': '{{label}} must be falsy',
    });
  }

  check(value) {
    return typeof value === 'boolean';
  }

  coerce(value, state, context) {
    if (truthyValues.includes(value)) return { value: true, errors: null };
    if (falsyValues.includes(value)) return { value: false, errors: null };

    return { value: null, errors: [this.report('any.coerce', state, context)] };
  }

  truthy() {
    return this.test({
      type: 'boolean.truthy',
      validate: ({ value }) => value,
    });
  }

  falsy() {
    return this.test({
      type: 'boolean.falsy',
      validate: ({ value }) => !value,
    });
  }
}

module.exports = BooleanSchema;
