import AnySchema from './AnySchema';
import Utils from '../Utils';

class ArraySchema extends AnySchema {
  constructor(inner) {
    Utils.assert(
      inner === undefined || Utils.isSchema(inner),
      'The parameter inner for Lyra.ArraySchema must be an instance of Lyra.AnySchema',
    );

    super('array', {
      'array.length': '{{label}} must have {{length}} items',
      'array.min': '{{label}} must have at least {{length}} items',
      'array.max': '{{label}} must have at most {{length}} items',
    });

    this._inner = inner !== undefined ? inner : null;
  }

  check(value) {
    return Array.isArray(value);
  }

  coerce(value, state, context) {
    try {
      return { value: JSON.parse(value), errors: null };
    } catch (err) {
      return { value: null, errors: [this.error('any.coerce', state, context)] };
    }
  }

  length(length) {
    return this.test({
      params: {
        length: {
          value: length,
          assert: 'number',
        },
      },
      type: 'array.length',
      validate: ({ value, params }) => value.length === params.length,
    });
  }

  min(length) {
    return this.test({
      params: {
        length: {
          value: length,
          assert: 'number',
        },
      },
      type: 'array.min',
      validate: ({ value, params }) => value.length >= params.length,
    });
  }

  max(length) {
    return this.test({
      params: {
        length: {
          value: length,
          assert: 'number',
        },
      },
      type: 'array.max',
      validate: ({ value, params }) => value.length <= params.length,
    });
  }

  reverse() {
    return this.transform(value => value.reverse());
  }

  _validate(value, opts, state = {}, schema) {
    state = {
      depth: null,
      ancestors: [],
      path: null,
      ...state,
    };
    schema = this._generate(state, opts, schema);

    const errors = [];
    const baseResult = super._validate(value, opts, state, schema);

    if (
      schema._inner === null ||
      baseResult.errors !== null ||
      !schema.check(baseResult.value) ||
      !opts.recursive
    )
      return baseResult;

    state.ancestors = [baseResult.value, ...state.ancestors];
    state.depth = state.depth === null ? 0 : state.depth + 1;

    for (let i = 0; i < baseResult.value.length; i++) {
      const newPath = state.path === null ? `[${i}]` : `${state.path}[${i}]`;

      const result = schema._inner._validate(baseResult.value[i], opts, {
        ...state,
        path: newPath,
      });

      if (result.errors !== null) {
        if (opts.abortEarly) return result;

        errors.push(...result.errors);
      } else baseResult.value[i] = result.value;
    }

    if (errors.length > 0)
      return {
        value: null,
        errors,
      };

    return { value: baseResult.value, errors: null };
  }
}

export default ArraySchema;
