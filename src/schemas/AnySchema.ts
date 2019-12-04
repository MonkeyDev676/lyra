import Ref from '../Ref';
import Utils from '../Utils';
import LyraValidationError from '../errors/LyraValidationError';
import LyraError from '../errors/LyraError';
import { SchemaRule, ValidatorOptions, ValidationResult, LooseObject } from '../types';

export default class AnySchema<T> {
  private _type: string;

  public isRequired: boolean;

  private _label: string | null;

  private _default: T | null;

  private _rules: SchemaRule<T>[];

  public deps: string[];

  constructor(type = 'any') {
    if (!Utils.isString(type))
      throw new LyraError('The parameter type for Lyra.AnySchema must be a string');

    this._type = type;
    this.isRequired = false;
    this._label = null;
    this._default = null;
    this._rules = [];
    this.deps = [];
  }

  protected resolve<T>(value: Ref<T> | T, fields: LooseObject) {
    if (Utils.instanceOf(value, Ref)) return value.resolve(fields);

    return value;
  }

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  protected check(value: unknown): value is T {
    return true;
  }

  protected coerce(value: unknown): T | null {
    return value as T;
  }

  public required() {
    this.isRequired = true;

    return this;
  }

  public default(value: T) {
    this._default = value;

    return this;
  }

  public value(value: unknown, strict: boolean) {
    if (value != null) {
      if (this.coerce == null || strict) return value;

      return this.coerce(value);
    }

    return this._default;
  }

  public label(label: string) {
    if (!Utils.isString(label))
      throw new LyraError(`The parameter label for ${this._type}.label must be a string`);

    this._label = label;

    return this;
  }

  protected addRule<P>(rule: SchemaRule<T, P>) {
    const { deps } = rule;

    // If the rule has dependencies
    if (deps != null)
      // We need to find the references and map their paths
      this.deps.push(
        ...Object.values(deps)
          .filter(dep => Utils.instanceOf(dep, Ref))
          .map(dep => (dep as Ref).path),
      );

    this._rules.push(rule);

    return this;
  }

  protected createError(value: unknown, path?: string, type = 'base') {
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
    const { strict = true, abortEarly = true, context = {}, path } = opts;

    if (context.__LYRA_INTERNAL_FIELDS__ == null && this.deps.length > 0)
      throw new LyraError('References cannot be used outside of Lyra.ObjectSchema');

    let enhancedValue: unknown = value;

    if (value == null) {
      if (this.isRequired)
        return { value: null, errors: [this.createError(value, path)], pass: false };

      return { value: this._default, errors: null, pass: true };
    }

    if (!strict) {
      enhancedValue = this.coerce ? this.coerce(value) : null;

      if (enhancedValue == null)
        return { value: null, errors: [this.createError(value, path)], pass: false };
    }

    if (!this.check(enhancedValue))
      return { value: null, errors: [this.createError(value, path)], pass: false };

    for (const rule of this._rules) {
      const result = rule.validate({
        value: enhancedValue,
        raw: value,
        deps:
          rule.deps == null
            ? {}
            : Object.entries(rule.deps).reduce((deps, [key, dep]) => {
                // eslint-disable-next-line no-param-reassign
                deps[key] = this.resolve(dep, context.__LYRA_INTERNAL_FIELDS__);

                return deps;
              }, {} as LooseObject),
        context,
      });

      if (!result) {
        if (abortEarly)
          return {
            value: null,
            pass: false,
            errors: [this.createError(value, path, rule.type)],
          };

        errors.push(
          rule.message == null
            ? this.createError(value, path, rule.type)
            : new LyraValidationError(rule.message),
        );
      }
    }

    if (errors.length > 0) return { value: null, errors, pass: false };

    return { value: enhancedValue, errors: null, pass: true };
  }
}
