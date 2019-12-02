import AnySchema from './AnySchema';
import Ref from '../Ref';
import Utils from '../Utils';
import LyraError from '../errors/LyraError';
import { ValidatorOptions, ValidationResult } from '../types';

export default class ArraySchema<T> extends AnySchema<T[]> {
  private _schema: AnySchema<T> | null;

  constructor(schema?: AnySchema<T>) {
    if (schema != null && !Utils.instanceOf(schema, AnySchema))
      throw new LyraError(
        'The parameter schema for Lyra.ArraySchema must inherit the Lyra.AnySchema constructor',
      );

    super('array');

    this._schema = schema != null ? schema : null;
  }

  protected check(value: unknown): value is T[] {
    return Array.isArray(value);
  }

  public length(length: number | Ref<number>, message?: string) {
    this.addRule({
      deps: { length },
      type: 'length',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isNumber(deps.length))
          throw new LyraError('The parameter length for array.length must be a number');

        return value.length === deps.length;
      },
    });

    return this;
  }

  public min(length: number | Ref<number>, message?: string) {
    this.addRule({
      deps: { length },
      type: 'min',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isNumber(deps.length))
          throw new LyraError('The parameter length for array.min must be a number');

        return value.length >= deps.length;
      },
    });

    return this;
  }

  public max(length: number | Ref<number>, message?: string) {
    this.addRule({
      deps: { length },
      type: 'max',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isNumber(deps.length))
          throw new LyraError('The parameter length for array.max must be a number');

        return value.length <= deps.length;
      },
    });

    return this;
  }

  public validate(value: unknown, options: ValidatorOptions = {}): ValidationResult<T[]> {
    const { abortEarly = true, recursive = true, path } = options;
    const errors = [];

    // Run base validation
    const baseResult = super.validate(value, options);

    // Run this.check in case of optional without default value
    if (this._schema == null || !baseResult.pass || !this.check(baseResult.value) || !recursive)
      return baseResult;

    for (let i = 0; i < baseResult.value.length; i += 1) {
      const result = this._schema.validate(baseResult.value[i], {
        ...options,
        path: path == null ? `[${i}]` : `${path}[${i}]`,
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
