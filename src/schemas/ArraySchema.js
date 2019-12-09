import AnySchema from './AnySchema';
import Utils from '../Utils';
import LyraError from '../errors/LyraError';

class ArraySchema extends AnySchema {
  constructor(schema) {
    if (schema != null && !Utils.isSchema(schema))
      throw new LyraError(
        'The parameter schema for Lyra.ArraySchema must be an instance of Lyra.AnySchema',
      );

    super('array');

    this._schema = schema != null ? schema : null;
  }

  _check(value) {
    return Utils.isArray(value);
  }

  _coerce(value) {
    try {
      return JSON.parse(value);
    } catch (err) {
      return value;
    }
  }

  _transform(value, opts, internalOpts = {}) {
    const enhancedValue = super._transform(value, opts, internalOpts);

    // Hand the value to rules
    if (!this._check(enhancedValue)) return enhancedValue;

    return enhancedValue.map(subValue => this._schema._transform(subValue, opts, internalOpts));
  }

  length(length, message) {
    return this.addRule({
      params: { length },
      type: 'length',
      message,
      pre: params => {
        if (!Utils.isNumber(params.length))
          return ['The parameter length for array.length must be a number', 'length'];

        return undefined;
      },
      validate: ({ value, params }) => value.length === params.length,
    });
  }

  min(length, message) {
    return this.addRule({
      params: { length },
      type: 'min',
      message,
      pre: params => {
        if (!Utils.isNumber(params.length))
          return ['The parameter length for array.min must be a number', 'length'];

        return undefined;
      },
      validate: ({ value, params }) => value.length >= params.length,
    });
  }

  max(length, message) {
    return this.addRule({
      params: { length },
      type: 'max',
      message,
      pre: params => {
        if (!Utils.isNumber(params.length))
          return ['The parameter length for array.max must be a number', 'length'];

        return undefined;
      },
      validate: ({ value, params }) => value.length <= params.length,
    });
  }

  reverse() {
    return this.addTransformation({
      transform: value => value.reverse(),
    });
  }

  _validate(value, opts, internalOpts = {}) {
    const enhancedInternalOpts = {
      depth: 0,
      ancestors: [],
      ...internalOpts,
    };
    const errors = [];
    const baseResult = super._validate(value, opts, enhancedInternalOpts);

    if (
      this._schema == null ||
      !baseResult.pass ||
      !this._check(baseResult.value) ||
      !opts.recursive
    )
      return baseResult;

    const ancestors = [baseResult.value, ...enhancedInternalOpts.ancestors];
    const depth = enhancedInternalOpts.depth + 1;

    for (let i = 0; i < baseResult.value.length; i += 1) {
      const newPath =
        enhancedInternalOpts.path == null ? `[${i}]` : `${enhancedInternalOpts.path}[${i}]`;

      const result = this._schema._validate(baseResult.value[i], opts, {
        path: newPath,
        ancestors,
        depth,
      });

      if (!result.pass) {
        if (opts.abortEarly) return result;

        errors.push(...result.errors);
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

export default ArraySchema;
