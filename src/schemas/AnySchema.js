import clone from 'lodash.clonedeepwith';
import Utils from '../Utils';
import LyraValidationError from '../errors/LyraValidationError';
import LyraError from '../errors/LyraError';

class AnySchema {
  constructor(type = 'any') {
    if (!Utils.isString(type))
      throw new LyraError('The parameter type for Lyra.AnySchema must be a string');

    this._type = type;
    this._flags = {
      required: false,
      strip: false,
    };
    this._messages = {
      required: null,
      valid: null,
      invalid: null,
    };
    this._label = null;
    this._default = undefined;
    this._valids = new Set();
    this._invalids = new Set();
    this._refs = []; // [ancestor, root, from]
    this._rules = [];
    this._transformations = [];
  }

  clone() {
    // Clone all instances but lyra schemas, since they are already immutable
    return clone(this, value => {
      if (value !== this && Utils.isSchema(value)) return value;

      return undefined;
    });
  }

  addRule(rule) {
    const next = this.clone();

    const enhancedRule = {
      params: {},
      ...rule,
    };

    Object.values(enhancedRule.params).forEach(param => {
      if (Utils.isRef(param) && param._type === 'value') {
        next._refs.push([param._ancestor, param._root]);
      }
    });

    next._rules.push(enhancedRule);

    return next;
  }

  addTransformation(transformation) {
    const next = this.clone();

    if (transformation.pre != null) {
      const errInfo = transformation.pre();

      if (Utils.isString(errInfo)) throw new LyraError(errInfo);
    }

    next._transformations.push(transformation);

    return next;
  }

  createError(opts) {
    const enhancedOpts = {
      type: `${this._type}.base`,
      isRef: false,
      depth: null,
      ...opts,
    };

    if (enhancedOpts.message != null) {
      return new LyraValidationError(enhancedOpts.message, {
        type: enhancedOpts.type,
        path: enhancedOpts.path,
        depth: enhancedOpts.depth,
      });
    }

    const enhancedValue = Utils.stringify(enhancedOpts.value);

    let enhancedLabel;

    if (this._label == null) {
      if (enhancedOpts.path != null) enhancedLabel = enhancedOpts.path;
      else enhancedLabel = 'unknown';
    } else enhancedLabel = this._label;

    if (enhancedOpts.isRef) {
      return new LyraValidationError(
        `The resolved reference ${enhancedOpts.refPath} of ${enhancedValue} cannot be used for ${enhancedLabel}`,
        {
          type: enhancedOpts.type,
          path: enhancedOpts.path,
          depth: enhancedOpts.depth,
        },
      );
    }

    let enhancedType;
    let values;

    if (enhancedOpts.type === 'valid') {
      values = Array.from(this._valids);
    } else if (enhancedOpts.type === 'invalid') {
      values = Array.from(this._invalids);
    }

    if (values != null) {
      const plural = values.length > 1;
      const noun = `value${plural ? 's' : ''}`;
      const beVerb = plural ? 'are' : 'is';

      enhancedType = `${this._type}.${enhancedOpts.type} (${
        enhancedOpts.type
      } ${noun} ${beVerb} ${values.join(', ')})`;
    } else enhancedType = `${this._type}.${enhancedOpts.type}`;

    return new LyraValidationError(
      `${enhancedLabel} of ${enhancedValue} doesn't have type of ${enhancedType}`,
      {
        type: enhancedOpts.type,
        path: enhancedOpts.path,
        depth: enhancedOpts.depth,
      },
    );
  }

  _transform(rawValue, opts) {
    let enhancedValue = rawValue;

    // Null and undefined behave differently. Required only applies to undefined
    if (rawValue === undefined) {
      if (this._flags.required) return undefined;

      enhancedValue = this._default;
    }

    // If default is null or undefined, we don't apply transformations
    if (enhancedValue == null) return enhancedValue;

    if (this._coerce != null && !opts.strict) enhancedValue = this._coerce(enhancedValue);

    if (opts.transform)
      enhancedValue = this._transformations.reduce(
        (value, transformation) => transformation.transform(value, rawValue),
        enhancedValue,
      );

    return enhancedValue;
  }

  strip() {
    const next = this.clone();

    next._flags.strip = true;

    return next;
  }

  required(message) {
    const next = this.clone();

    next._messages.required = message;
    next._flags.required = true;

    return next;
  }

  default(value) {
    if (value === undefined)
      throw new LyraError(`The parameter value for ${this._type}.default must be provided`);

    const next = this.clone();

    if (Utils.isFunction(value)) next._default = value.call(this);
    else if (Utils.isRef(value)) next._default = value;
    else next._default = clone(value);

    return next;
  }

  label(label) {
    if (!Utils.isString(label))
      throw new LyraError(`The parameter label for ${this._type}.label must be a string`);

    const next = this.clone();

    next._label = label;

    return next;
  }

  valid(...params) {
    const next = this.clone();
    let values;

    if (params.length === 2 && Utils.isArray(params[0])) values = params[0];
    else values = params;

    for (const value of values) {
      next._invalids.delete(value);
      next._valids.add(value);
    }

    return next;
  }

  invalid(...params) {
    const next = this.clone();
    let values;

    if (params.length === 2 && Utils.isArray(params[0])) values = params[0];
    else values = params;

    for (const value of values) {
      next._invalids.add(value);
      next._valids.delete(value);
    }

    return next;
  }

  _validate(value, opts, internalOpts = {}) {
    const enhancedInternalOpts = { depth: null, ancestors: [], ...internalOpts };
    const errors = [];

    if (value === undefined) {
      if (this._flags.required)
        return {
          value: null,
          errors: [
            this.createError({
              value,
              type: 'required',
              message: this._messages.required,
              ...enhancedInternalOpts,
            }),
          ],
        };

      return { value, errors: null, pass: true };
    }

    if (this._check != null && !this._check(value))
      return {
        value: null,
        errors: [this.createError({ value, ...enhancedInternalOpts })],
        pass: false,
      };

    if (this._valids.size > 0 && !this._valids.has(value)) {
      return {
        value: null,
        errors: [
          this.createError({
            value,
            type: 'valid',
            message: this._messages.valid,
            ...enhancedInternalOpts,
          }),
        ],
      };
    }

    if (this._invalids.size > 0 && this._invalids.has(value)) {
      return {
        value: null,
        errors: [
          this.createError({
            type: 'invalid',
            message: this._messages.invalid,
            ...enhancedInternalOpts,
          }),
        ],
      };
    }

    for (const rule of this._rules) {
      const resolvedParams = {};
      const paths = {};

      for (const [key, param] of Object.entries(rule.params)) {
        let resolved;

        if (Utils.isRef(param)) {
          resolved = param._resolve(opts.context, enhancedInternalOpts.ancestors);
          paths[key] = param._path;
        } else {
          resolved = param;
        }

        resolvedParams[key] = resolved;
      }

      if (rule.pre != null) {
        const errInfo = rule.pre(resolvedParams);

        // The rules don't accept refs
        if (Utils.isString(errInfo)) {
          throw new LyraError(errInfo);
        }

        if (Utils.isArray(errInfo)) {
          if (paths[errInfo[1]] != null) {
            const err = this.createError({
              value: resolvedParams[errInfo[1]],
              refPath: paths[errInfo[1]],
              isRef: true,
              ...enhancedInternalOpts,
            });

            if (opts.abortEarly)
              return {
                value: null,
                errors: [err],
                pass: false,
              };

            errors.push(err);

            continue;
          } else throw new LyraError(errInfo[0]);
        }
      }

      const result = rule.validate({
        value,
        params: resolvedParams,
        context: opts.context,
      });

      if (!result) {
        if (opts.abortEarly)
          return {
            value: null,
            pass: false,
            errors: [
              this.createError({
                value,
                type: rule.type,
                message: rule.message,
                ...enhancedInternalOpts,
              }),
            ],
          };

        errors.push(
          this.createError({
            value,
            type: rule.type,
            message: rule.message,
            ...enhancedInternalOpts,
          }),
        );
      }
    }

    if (errors.length > 0) return { value: null, errors, pass: false };

    return { value, errors: null, pass: true };
  }

  validate(value, opts = {}) {
    const enhancedOpts = {
      strict: true,
      transform: true,
      abortEarly: true,
      recursive: true,
      allowUnknown: false,
      stripUnknown: true,
      context: {},
      ...opts,
    };

    return this._validate(this._transform(value, enhancedOpts), enhancedOpts);
  }
}

AnySchema.prototype.__LYRA_SCHEMA__ = true;

export default AnySchema;
