import AnySchema from './AnySchema';
import Utils from '../Utils';
import LyraError from '../errors/LyraError';

export default class NumberSchema extends AnySchema<number> {
  constructor() {
    super('number');
  }

  protected check(value: unknown): value is number {
    return Utils.isNumber(value);
  }

  protected coerce(value: string) {
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

  public min(num: number, message?: string) {
    this.addRule({
      type: 'min',
      message,
      validate: ({ value }) => {
        if (!this.check(num))
          throw new LyraError('The parameter num for number.min must be a number');

        return value >= num;
      },
    });

    return this;
  }

  public max(num: number, message?: string) {
    this.addRule({
      type: 'max',
      message,
      validate: ({ value }) => {
        if (!this.check(num))
          throw new LyraError('The parameter num for number.max must be a number');

        return value <= num;
      },
    });

    return this;
  }

  public multiple(num: number, message?: string) {
    this.addRule({
      type: 'multiple',
      message,
      validate: ({ value }) => {
        if (!this.check(num))
          throw new LyraError('The parameter num for number.multiple must be a number');

        return value % num === 0;
      },
    });

    return this;
  }

  public divide(num: number, message?: string) {
    this.addRule({
      type: 'divide',
      message,
      validate: ({ value }) => {
        if (!this.check(num))
          throw new LyraError('The parameter num for number.divide must be a number');

        return num % value === 0;
      },
    });

    return this;
  }

  public greater(num: number, message?: string) {
    this.addRule({
      type: 'greater',
      message,
      validate: ({ value }) => {
        if (!this.check(num))
          throw new LyraError('The parameter num for number.greater must be a number');

        return value > num;
      },
    });

    return this;
  }

  public smaller(num: number, message?: string) {
    this.addRule({
      type: 'smaller',
      message,
      validate: ({ value }) => {
        if (!this.check(num))
          throw new LyraError('The parameter num for number.smaller must be a number');

        return value < num;
      },
    });

    return this;
  }
}
