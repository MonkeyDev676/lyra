const AnySchema = require('./AnySchema');

class NumberSchema extends AnySchema {
  constructor() {
    super('number', {
      'number.integer': '{{label}} must be an integer',
      'number.min': '{{label}} must be greater than or equal to {{num}}',
      'number.max': '{{label}} must be smaller than or equal to {{params.num}}',
      'number.multiple': '{{label}} must be a multiple of {{params.num}}',
      'number.divide': '{{label}} must divide {{num}}',
      'number.greater': '{{label}} must be greater than {{num}}',
      'number.smaller': '{{label}} must be smaller than {{num}}',
    });
  }

  check(value) {
    return typeof value === 'number';
  }

  coerce(value, state, context) {
    const coerce = Number(value);

    if (!Number.isNaN(coerce)) return { value: coerce, errors: null };

    return { value: null, errors: [this.report('any.coerce', state, context)] };
  }

  integer() {
    return this.test({
      type: 'number.integer',
      validate: ({ value }) => Number.isInteger(value),
    });
  }

  min(num) {
    return this.test({
      params: {
        num: {
          value: num,
          assert: 'number',
        },
      },
      type: 'number.min',
      validate: ({ value, params }) => value >= params.num,
    });
  }

  max(num) {
    return this.test({
      params: {
        num: {
          value: num,
          assert: 'number',
        },
      },
      type: 'number.max',
      validate: ({ value, params }) => value <= params.num,
    });
  }

  multiple(num) {
    return this.test({
      params: {
        num: {
          value: num,
          assert: 'number',
        },
      },
      type: 'number.multiple',

      validate: ({ value, params }) => value % params.num === 0,
    });
  }

  divide(num) {
    return this.test({
      params: {
        num: {
          value: num,
          assert: 'number',
        },
      },
      type: 'number.divide',
      validate: ({ value, params }) => params.num % value === 0,
    });
  }

  greater(num) {
    return this.test({
      params: {
        num: {
          value: num,
          assert: 'number',
        },
      },
      type: 'number.greater',
      validate: ({ value, params }) => value > params.num,
    });
  }

  smaller(num) {
    return this.test({
      params: {
        num: {
          value: num,
          assert: 'number',
        },
      },
      type: 'number.smaller',
      validate: ({ value, params }) => value < params.num,
    });
  }
}

module.exports = NumberSchema;
