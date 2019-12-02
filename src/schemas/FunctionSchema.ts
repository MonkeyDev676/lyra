import AnySchema from './AnySchema';
import Ref from '../Ref';
import Utils from '../Utils';
import LyraError from '../errors/LyraError';

export default class FunctionSchema<T extends Function> extends AnySchema<T> {
  constructor() {
    super('function');
  }

  protected check(value: unknown): value is T {
    return Utils.isFunction(value);
  }

  inherit(ctor: Function | Ref<Function>, message?: string) {
    this.addRule({
      deps: { ctor },
      type: 'inherit',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isFunction(deps.ctor))
          throw new LyraError('The parameter ctor for function.inherit must be a function');

        return Utils.instanceOf(value.prototype, deps.ctor);
      },
    });

    return this;
  }
}
