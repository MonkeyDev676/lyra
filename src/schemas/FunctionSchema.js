import AnySchema from './AnySchema';
import Utils from '../Utils';

class FunctionSchema extends AnySchema {
  constructor() {
    super('function');
  }

  _check(value) {
    return Utils.isFunction(value);
  }

  inherit(ctor, message) {
    return this.addRule({
      params: { ctor },
      type: 'inherit',
      message,
      pre: params => {
        if (!Utils.isFunction(params))
          return ['The parameter ctor for function.inherit must be a function', 'ctor'];

        return undefined;
      },
      validate: ({ value, params }) => value.prototype instanceof params.ctor,
    });
  }
}

export default FunctionSchema;
