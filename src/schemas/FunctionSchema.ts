import AnySchema from './AnySchema';
import Utils from '../Utils';
import LyraError from '../errors/LyraError';

export default class FunctionSchema<T extends Function> extends AnySchema<T> {
  constructor() {
    super('function');
  }

  protected check(value: unknown): value is T {
    return Utils.isFunction(value);
  }

  inherit(ctor: Function, message?: string) {
    this.addRule({
      type: 'inherit',
      message,
      validate: ({ value }) => {
        if (!Utils.isFunction(ctor))
          throw new LyraError('The parameter ctor for function.inherit must be a function');

        return value.prototype instanceof ctor;
      },
    });

    return this;
  }
}
