import AnySchema from './AnySchema';
import Ref from '../Ref';
import Utils from '../Utils';
import LyraError from '../errors/LyraError';

export default class NumberSchema extends AnySchema<number> {
  constructor() {
    super('number');
  }

  protected check(value: unknown): value is number {
    return Utils.isNumber(value);
  }

  protected coerce(value: unknown) {
    const coerce = Number(value);

    if (!Number.isNaN(coerce)) return coerce;

    return null;
  }

  public integer(message?: string) {
    this.addRule({
      type: 'integer',
      message,
      validate: ({ value }) => Number.isInteger(value),
    });

    return this;
  }

  public min(num: number | Ref<number>, message?: string) {
    this.addRule({
      deps: { num },
      type: 'min',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isNumber(deps.num))
          throw new LyraError('The parameter num for number.min must be a number');

        return value >= deps.num;
      },
    });

    return this;
  }

  public max(num: number | Ref<number>, message?: string) {
    this.addRule({
      deps: { num },
      type: 'max',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isNumber(deps.num))
          throw new LyraError('The parameter num for number.max must be a number');

        return value <= deps.num;
      },
    });

    return this;
  }

  public multiple(num: number | Ref<number>, message?: string) {
    this.addRule({
      deps: { num },
      type: 'multiple',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isNumber(deps.num))
          throw new LyraError('The parameter num for number.multiple must be a number');

        return value % deps.num === 0;
      },
    });

    return this;
  }

  public divide(num: number | Ref<number>, message?: string) {
    this.addRule({
      deps: { num },
      type: 'divide',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isNumber(deps.num))
          throw new LyraError('The parameter num for number.divide must be a number');

        return deps.num % value === 0;
      },
    });

    return this;
  }

  public greater(num: number | Ref<number>, message?: string) {
    this.addRule({
      deps: { num },
      type: 'greater',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isNumber(deps.num))
          throw new LyraError('The parameter num for number.greater must be a number');

        return value > deps.num;
      },
    });

    return this;
  }

  public smaller(num: number | Ref<number>, message?: string) {
    this.addRule({
      deps: { num },
      type: 'smaller',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isNumber(deps.num))
          throw new LyraError('The parameter num for number.smaller must be a number');

        return value < deps.num;
      },
    });

    return this;
  }
}
