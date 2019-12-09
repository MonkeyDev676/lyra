import AnySchema from './AnySchema';
import Utils from '../Utils';

const truthyValues = ['true', '1', '+', 'on', 'enable', 'enabled', 't', 'yes', 'y', 1, true];

const falsyValues = ['false', '0', '-', 'off', 'disable', 'disabled', 'f', 'no', 'n', 0, false];

class BooleanSchema extends AnySchema {
  constructor() {
    super('boolean');
  }

  _check(value) {
    return Utils.isBoolean(value);
  }

  _coerce(value) {
    if (truthyValues.includes(value)) return true;
    if (falsyValues.includes(value)) return false;

    return value;
  }

  truthy(message) {
    return this.addRule({
      type: 'truthy',
      message,
      validate: ({ value }) => value,
    });
  }

  falsy(message) {
    return this.addRule({
      type: 'falsy',
      message,
      validate: ({ value }) => !value,
    });
  }
}

export default BooleanSchema;
