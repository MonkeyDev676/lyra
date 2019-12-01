import Utils from '../Utils';
import LyraValidationError from '../errors/LyraValidationError';
import LyraError from '../errors/LyraError';

export interface RuleArguments<T> {
  value: T;
  raw: unknown;
  context: object;
}

export interface Rule<T> {
  type: string;
  message?: string;
  validate: (arg: RuleArguments<T>) => boolean;
}

export interface ValidationResultPassed<T> {
  value: T | null;
  pass: true;
  errors: null;
}

export interface ValidationResultFailed {
  value: null;
  pass: false;
  errors: LyraValidationError[];
}

export type ValidationResult<T> = ValidationResultPassed<T> | ValidationResultFailed;

export interface ValidatorOptions {
  strict?: boolean;
  abortEarly?: boolean;
  stripUnknown?: boolean;
  recursive?: boolean;
  context?: object;
  path?: string;
  parent?: unknown;
}

export default class AnySchema<T = any> {
  private _type: string;

  private _required: boolean;

  private _label: string | null;

  private _default: T | null;

  private _rules: Rule<T>[];

  constructor(type = 'any') {
    if (!Utils.isString(type))
      throw new LyraError('The parameter type for Lyra.AnySchema must be a string');

    this._type = type;
    this._required = false;
    this._label = null;
    this._default = null;
    this._rules = [];
  }

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  protected check(value: unknown): value is T {
    return true;
  }

  protected coerce(value: unknown): T | null {
    return value as T;
  }

  public required() {
    this._required = true;

    return this;
  }

  public default(value: T) {
    this._default = value;

    return this;
  }

  public label(label: string) {
    if (!Utils.isString(label))
      throw new LyraError(`The parameter label for ${this._type}.label must be a string`);

    this._label = label;

    return this;
  }

  protected addRule(rule: Rule<T>) {
    this._rules.push(rule);

    return this;
  }

  private _createError(value: unknown, path?: string, type = 'base') {
    let enhancedLabel: string;

    if (this._label == null) {
      if (path != null) enhancedLabel = path;
      else enhancedLabel = 'unknown';
    } else enhancedLabel = this._label;

    return new LyraValidationError(
      `${enhancedLabel} of ${JSON.stringify(value)} doesn't have type of ${this._type}.${type}`,
      path,
    );
  }

  public validate(value: unknown, opts: ValidatorOptions = {}): ValidationResult<T> {
    const errors = [];
    const { strict = true, abortEarly = true, path, context = {} } = opts;
    const simpleErr = this._createError(value, path);

    let enhancedValue: unknown = value;

    if (value == null) {
      if (this._required) return { value: null, pass: false, errors: [simpleErr] };

      enhancedValue = this._default;
    } else if (!strict) enhancedValue = this.coerce(value);

    if (enhancedValue != null) {
      if (!this.check(enhancedValue)) return { value: null, pass: false, errors: [simpleErr] };

      for (const rule of this._rules) {
        const result = rule.validate({ value: enhancedValue, raw: value, context });

        if (!result) {
          if (abortEarly)
            return {
              value: null,
              pass: false,
              errors: [this._createError(value, path, rule.type)],
            };

          errors.push(
            rule.message == null
              ? this._createError(value, path, rule.type)
              : new LyraValidationError(rule.message),
          );
        }
      }

      if (errors.length > 0) return { value: null, pass: false, errors };

      return { value: enhancedValue, pass: true, errors: null };
    }

    return { value: null, pass: true, errors: null };
  }
}
