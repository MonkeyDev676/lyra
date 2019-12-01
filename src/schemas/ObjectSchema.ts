import AnySchema from './AnySchema';
import Utils from '../Utils';
import LyraError from '../errors/LyraError';
import { ValidatorOptions, ValidationResult, SchemaMap, LooseObject } from '../types';

export default class ObjectSchema<T extends LooseObject> extends AnySchema<T> {
  private _schemaMap: SchemaMap<T> | null;

  constructor(schemaMap?: SchemaMap<T>) {
    if (schemaMap != null && !Utils.isPlainObject(schemaMap))
      throw new LyraError('The parameter schemaMap for Lyra.ObjectSchema must be a plain object');

    super('object');

    this._schemaMap = schemaMap != null ? schemaMap : null;
  }

  protected check(value: unknown): value is T {
    return Utils.isPlainObject(value);
  }

  public length(length: number, message?: string) {
    this.addRule({
      type: 'length',
      message,
      validate: ({ value }) => {
        if (Utils.isNumber(length))
          throw new LyraError('The parameter length for object.length must be a number');

        return Object.keys(value).length === length;
      },
    });

    return this;
  }

  public min(length: number, message?: string) {
    this.addRule({
      type: 'min',
      message,
      validate: ({ value }) => {
        if (Utils.isNumber(length))
          throw new LyraError('The parameter length for object.min must be a number');

        return Object.keys(value).length >= length;
      },
    });

    return this;
  }

  public max(length: number, message?: string) {
    this.addRule({
      type: 'max',
      message,
      validate: ({ value }) => {
        if (Utils.isNumber(length))
          throw new LyraError('The parameter length for object.max must be a number');

        return Object.keys(value).length <= length;
      },
    });

    return this;
  }

  public instance(ctor: Function, message?: string) {
    this.addRule({
      type: 'instance',
      message,
      validate: ({ value }) => {
        if (Utils.isFunction(ctor))
          throw new LyraError('The parameter ctor for object.instance must be a function');

        return value instanceof ctor;
      },
    });

    return this;
  }

  public validate(value: unknown, options: ValidatorOptions = {}): ValidationResult<T> {
    const { abortEarly = true, recursive = true, path } = options;
    const errors = [];
    const baseResult = super.validate(value, options);

    // Run this.check in case of optional without default value
    if (this._schemaMap == null || !baseResult.pass || !this.check(baseResult.value) || !recursive)
      return baseResult;

    for (const key of Object.keys(this._schemaMap)) {
      const newSchema = this._schemaMap[key];
      const newValue = baseResult.value[key];
      const newOptions = {
        ...options,
        path: path == null ? key : `${path}.${key}`,
        parent: baseResult.value,
      };

      const result = newSchema.validate(newValue, newOptions);

      if (!result.pass) {
        errors.push(...result.errors);

        if (abortEarly) return { value: null, errors: result.errors, pass: false };
      }
    }

    if (errors.length > 0) return { value: null, errors, pass: false };

    return { value: baseResult.value, errors: null, pass: true };
  }
}
