import t from 'toposort';
import AnySchema from './AnySchema';
import Utils from '../Utils';
import LyraError from '../errors/LyraError';

class ObjectSchema extends AnySchema {
  constructor(map) {
    if (map != null && !Utils.isPlainObject(map))
      throw new LyraError('The parameter map for Lyra.ObjectSchema must be a plain object');

    super('object');

    this._map = null;

    if (map != null) {
      const schemaEntries = Object.entries(map);

      if (schemaEntries.some(([, schema]) => !Utils.isSchema(schema)))
        throw new LyraError(
          'The parameter map for Lyra.ObjectSchema must contain only Lyra.AnySchema instances',
        );

      // Treat {} as null
      if (schemaEntries.length !== 0) {
        this._map = map;

        const nodes = [];

        schemaEntries.forEach(([key, schema]) => {
          nodes.push(key);

          schema._refs.forEach(([ancestor, root]) => {
            if (ancestor > 0) this._refs.push([ancestor - 1, root, key]);
          });
        });

        const edges = [];

        this._refs.forEach(([ancestor, root, from]) => {
          if (ancestor === 0) edges.push([root, from]);
        });

        try {
          this._sortedKeys = t.array(nodes, edges);
        } catch (err) {
          throw err;
        }
      }
    }
  }

  _check(value) {
    return Utils.isPlainObject(value);
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

    if (!this._check(enhancedValue)) return enhancedValue;

    Object.entries(this._map).forEach(([key, schema]) => {
      const subValue = enhancedValue[key];
      const transformedValue = schema._transform(subValue, opts, internalOpts);

      enhancedValue[key] = transformedValue;
    });

    return enhancedValue;
  }

  length(length, message) {
    return this.addRule({
      params: { length },
      type: 'length',
      message,
      pre: params => {
        if (!Utils.isNumber(params.length))
          return ['The parameter length for object.length must be a number', 'length'];

        return undefined;
      },
      validate: ({ value, params }) => Object.keys(value).length === params.length,
    });
  }

  min(length, message) {
    return this.addRule({
      params: { length },
      type: 'min',
      message,
      pre: params => {
        if (!Utils.isNumber(params.length))
          return ['The parameter length for object.min must be a number', 'length'];

        return undefined;
      },
      validate: ({ value, params }) => Object.keys(value).length >= params.length,
    });
  }

  max(length, message) {
    return this.addRule({
      params: { length },
      type: 'max',
      message,
      pre: params => {
        if (!Utils.isNumber(params.length))
          return ['The parameter length for object.max must be a number', 'length'];

        return undefined;
      },
      validate: ({ value, params }) => Object.keys(value).length <= params.length,
    });
  }

  instance(ctor, message) {
    return this.addRule({
      params: { ctor },
      type: 'instance',
      message,
      pre: params => {
        if (!Utils.isFunction(params.ctor))
          return ['The parameter ctor for object.instance must be a function', 'ctor'];

        return undefined;
      },
      validate: ({ value, params }) => value instanceof params.ctor,
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

    if (this._map == null || !baseResult.pass || !this._check(baseResult.value) || !opts.recursive)
      return baseResult;

    const ancestors = [baseResult.value, ...enhancedInternalOpts.ancestors];
    const depth = enhancedInternalOpts.depth + 1;
    const keys = new Set(Object.keys(baseResult.value));

    for (const key of this._sortedKeys) {
      const newPath =
        enhancedInternalOpts.path == null ? key : `${enhancedInternalOpts.path}.${key}`;
      const subValue = baseResult.value[key];
      const schema = this._map[key];

      keys.delete(key);

      const result = schema._validate(subValue, opts, {
        path: newPath,
        ancestors,
        depth,
      });

      if (!result.pass) {
        if (opts.abortEarly) return result;

        errors.push(...result.errors);
      } else if (schema._flags.strip) delete baseResult.value[key];
    }

    if (opts.stripUnknown) {
      for (const key of keys) {
        delete baseResult.value[key];
        keys.delete(key);
      }
    }

    if (!opts.allowUnknown)
      for (const key of keys) {
        const err = this.createError({
          message: `The key ${key} is not allowed`,
          type: 'object.unknown',
          path: enhancedInternalOpts.path == null ? key : `${enhancedInternalOpts.path}.${key}`,
          depth,
        });

        if (opts.abortEarly)
          return {
            value: null,
            errors: [err],
            pass: false,
          };

        errors.push(err);
      }

    if (errors.length > 0) return { value: null, errors, pass: false };

    return { value: baseResult.value, errors: null, pass: true };
  }
}

export default ObjectSchema;
