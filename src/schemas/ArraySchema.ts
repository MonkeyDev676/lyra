import AnySchema, { ValidatorOptions, ValidationResult } from './AnySchema';
import Utils from '../Utils';
import LyraError from '../errors/LyraError';

export default class ArraySchema<T> extends AnySchema<T[]> {
  private _schema: AnySchema<T> | null;

  constructor(schema?: AnySchema<T>) {
    if (schema != null && !(schema instanceof AnySchema))
      throw new LyraError(
        'The parameter schema for Lyra.ArraySchema must inherit the Lyra.AnySchema constructor',
      );

    super('array');

    this._schema = schema != null ? schema : null;
  }

  protected check(value: unknown): value is T[] {
    return Array.isArray(value);
  }

  public length(length: number, message?: string) {
    this.addRule({
      type: 'length',
      message,
      validate: ({ value }) => {
        if (!Utils.isNumber(length))
          throw new LyraError('The parameter length for array.length must be a number');

        return value.length === length;
      },
    });

    return this;
  }

  public min(length: number, message?: string) {
    this.addRule({
      type: 'min',
      message,
      validate: ({ value }) => {
        if (!Utils.isNumber(length))
          throw new LyraError('The parameter length for array.min must be a number');

        return value.length >= length;
      },
    });

    return this;
  }

  public max(length: number, message?: string) {
    this.addRule({
      type: 'max',
      message,
      validate: ({ value }) => {
        if (!Utils.isNumber(length))
          throw new LyraError('The parameter length for array.max must be a number');

        return value.length <= length;
      },
    });

    return this;
  }

  public validate(value: unknown, options: ValidatorOptions = {}): ValidationResult<T[]> {
    const { abortEarly = true, path } = options;
    const errors = [];

    // Run base validation
    const baseResult = super.validate(value, options);

    // Run this.check in case of optional without default value
    if (this._schema == null || !baseResult.pass || !this.check(baseResult.value))
      return baseResult;

    for (let i = 0; i < baseResult.value.length; i += 1) {
      const result = this._schema.validate(baseResult.value[i], {
        ...options,
        path: path == null ? `[${i.toString()}]` : `${path}[${i}]`,
        parent: baseResult.value,
      });

      if (!result.pass) {
        errors.push(...result.errors);

        if (abortEarly)
          return {
            value: null,
            errors: result.errors,
            pass: false,
          };
      }
    }

    if (errors.length > 0)
      return {
        value: null,
        errors,
        pass: false,
      };

    return { value: baseResult.value, errors: null, pass: true };
  }
}
