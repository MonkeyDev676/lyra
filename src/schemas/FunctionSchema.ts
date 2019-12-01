import AnySchema from './AnySchema';
import LyraError from '../errors/LyraError';

export default class FunctionSchema<T extends Function> extends AnySchema<T> {
  constructor() {
    super('function');
  }

  protected check(value: unknown): value is T {
    return typeof value === 'function';
  }

  inherit(ctor: Function, message?: string) {
    this.addRule({
      type: 'inherit',
      message,
      validate: ({ value }) => {
        if (!this.check(ctor))
          throw new LyraError('The parameter ctor for function.inherit must be a function');

        return value.prototype instanceof ctor;
      },
    });

    return this;
  }
}
