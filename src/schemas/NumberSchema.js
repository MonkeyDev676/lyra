import AnySchema from './AnySchema';
import Utils from '../Utils';

class NumberSchema extends AnySchema {
  constructor() {
    super('number');
  }

  _check(value) {
    return Utils.isNumber(value);
  }

  _coerce(value) {
    const coerce = Number(value);

    if (!Number.isNaN(coerce)) return coerce;

    return value;
  }

  integer(message) {
    return this.addRule({
      type: 'integer',
      message,
      validate: ({ value }) => Number.isInteger(value),
    });
  }

  min(num, message) {
    return this.addRule({
      params: { num },
      type: 'min',
      message,
      pre: params => {
        if (!Utils.isNumber(params.num))
          return ['The parameter num for number.min must be a number', 'num'];

        return undefined;
      },
      validate: ({ value, params }) => value >= params.num,
    });
  }

  max(num, message) {
    return this.addRule({
      params: { num },
      type: 'max',
      message,
      pre: params => {
        if (!Utils.isNumber(params.num))
          return ['The parameter num for number.max must be a number', 'num'];

        return undefined;
      },
      validate: ({ value, params }) => value <= params.num,
    });
  }

  multiple(num, message) {
    return this.addRule({
      params: { num },
      type: 'multiple',
      message,
      pre: params => {
        if (!Utils.isNumber(params.num))
          return ['The parameter num for number.multiple must be a number', 'num'];

        return undefined;
      },
      validate: ({ value, params }) => value % params.num === 0,
    });
  }

  divide(num, message) {
    return this.addRule({
      params: { num },
      type: 'divide',
      message,
      pre: params => {
        if (!Utils.isNumber(params.num))
          return ['The parameter num for number.divide must be a number', 'num'];

        return undefined;
      },
      validate: ({ value, params }) => params.num % value === 0,
    });
  }

  greater(num, message) {
    return this.addRule({
      params: { num },
      type: 'greater',
      message,
      pre: params => {
        if (!Utils.isNumber(params.num))
          return ['The parameter num for number.greater must be a number', 'num'];

        return undefined;
      },
      validate: ({ value, params }) => value > params.num,
    });
  }

  smaller(num, message) {
    return this.addRule({
      params: { num },
      type: 'smaller',
      message,
      pre: params => {
        if (!Utils.isNumber(params.num))
          return ['The parameter num for number.smaller must be a number', 'num'];

        return undefined;
      },
      validate: ({ value, params }) => value < params.num,
    });
  }

  expression(exp) {
    return this.addTransformation({
      pre: () => {
        if (!Utils.isFunction(exp))
          return ['The parameter exp for number.expression must be a function', 'num'];

        return undefined;
      },
      transform: exp,
    });
  }
}

export default NumberSchema;
