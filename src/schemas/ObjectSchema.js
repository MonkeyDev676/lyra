import t from 'toposort';
import isPlainObject from 'lodash/isPlainObject';
import AnySchema from './AnySchema';
import Utils from '../Utils';

class ObjectSchema extends AnySchema {
  constructor(inner) {
    Utils.assert(
      inner === undefined || isPlainObject(inner),
      'The parameter map for Lyra.ObjectSchema must be a plain object',
    );

    super('object', {
      'object.unknown': '{{path}} is not allowed',
      'object.length': '{{label}} must have {{length}} entries',
      'object.min': '{{label}} must have at least {{length}} entries',
      'object.max': '{{label}} must have at most {{length}} entries',
      'object.instance': '{{label}} must be an instance of {{ctor}}',
      'object.and': '{{label}} must contain all of {{peers}}',
      'object.nand': '{{label}} must not contain all of {{peers}}',
      'object.or': '{{label}} must contain at least one of {{peers}}',
      'object.xor': '{{label}} must contain one of {{peers}}',
      'object.oxor': '{{label}} must contain one or none of {{peers}}',
    });

    this._inner = null;
    this._dependencies = [];

    if (inner !== undefined) {
      const schemaEntries = Object.entries(inner);

      Utils.assert(
        schemaEntries.every(([, schema]) => Utils.isSchema(schema)),
        'The parameter map for Lyra.ObjectSchema must contain only instances of Lyra.AnySchema',
      );

      // Treat {} as null
      if (schemaEntries.length !== 0) {
        this._inner = inner;

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
          Utils.assert(!err.message.startsWith('Cyclic dependency'), 'Cyclic dependency detected');

          this._sortedKeys = nodes;
        }
      }
    }
  }

  check(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
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
      type: 'object.length',
      validate: ({ value, params }) => Object.keys(value).length === params.length,
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
      type: 'object.min',
      validate: ({ value, params }) => Object.keys(value).length >= params.length,
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
      type: 'object.max',
      validate: ({ value, params }) => Object.keys(value).length <= params.length,
    });
  }

  instance(ctor) {
    return this.test({
      params: {
        ctor: {
          value: ctor,
          assert: 'function',
        },
      },
      type: 'object.instance',
      validate: ({ value, params }) => value instanceof params.ctor,
    });
  }

  _addDependencies(type, peers, validate) {
    Utils.assert(
      peers.length > 0,
      `The parameter peers for object.${type} must have at least one item`,
    );
    Utils.assert(
      peers.every(peer => Utils.isRef(peer)),
      `The parameter peers for object.${type} must contain only instances of Lyra.Ref`,
    );
    // Improve consistency
    Utils.assert(
      peers.every(peer => peer._ancestor === 0),
      `The parameter peers for object.${type} must contain only self referencing references`,
    );

    const next = this.clone();

    next._dependencies.push({
      type: `object.${type}`,
      validate,
    });

    return next;
  }

  and(...peers) {
    return this._addDependencies('and', peers, (value, ancestors, context) => {
      for (const peer of peers) {
        if (peer.resolve(value, ancestors, context) === undefined) return { peers };
      }

      return undefined;
    });
  }

  nand(...peers) {
    return this._addDependencies('nand', peers, (value, ancestors, context) => {
      for (const peer of peers) {
        if (peer.resolve(value, ancestors, context) === undefined) return undefined;
      }

      return { peers };
    });
  }

  or(...peers) {
    return this._addDependencies('or', peers, (value, ancestors, context) => {
      for (const peer of peers) {
        if (peer.resolve(value, ancestors, context) !== undefined) return undefined;
      }

      return { peers };
    });
  }

  xor(...peers) {
    return this._addDependencies('xor', peers, (value, ancestors, context) => {
      let count = 0;

      for (const peer of peers) {
        if (peer.resolve(value, ancestors, context) !== undefined) {
          if (count === 0) count++;
          else return { peers };
        }
      }

      if (count === 0) return { peers };

      return undefined;
    });
  }

  oxor(...peers) {
    return this._addDependencies('oxor', peers, (value, ancestors, context) => {
      let count = 0;

      for (const peer of peers) {
        if (peer.resolve(value, ancestors, context) !== undefined) {
          if (count === 0) count++;
          else return { peers };
        }
      }

      return undefined;
    });
  }

  _validateInner(value, opts, state, schema) {
    const errors = [];

    const keys = new Set(Object.keys(value));
    const stripKeys = [];

    for (const key of schema._sortedKeys) {
      const newPath = state.path === null ? key : `${state.path}.${key}`;
      const subSchema = schema._inner[key];

      keys.delete(key);

      const result = subSchema._validate(value[key], opts, {
        ...state,
        path: newPath,
      });

      if (result.errors !== null) {
        if (opts.abortEarly) return result;

        errors.push(...result.errors);
      } else {
        // {a: undefined} -> {a: undefined}
        // {} -> {} (without this condition it would return {a: undefined})
        if (result.value !== undefined || Object.prototype.hasOwnProperty.call(value, key))
          value[key] = result.value;

        if (schema._flags.strip) stripKeys.push(key);
      }
    }

    for (const depedency of schema._dependencies) {
      const data = depedency.validate(value, state.ancestors, opts.context);

      if (data !== undefined) {
        const err = schema.error(depedency.type, state, opts.context, data);

        if (opts.abortEarly) return { value: null, errors: [err] };

        errors.push(err);
      }
    }

    stripKeys.forEach(key => {
      delete value[key];
      keys.delete(key);
    });

    if (opts.stripUnknown) {
      keys.forEach(key => {
        delete value[key];
        keys.delete(key);
      });
    }

    if (!opts.allowUnknown) {
      for (const key of keys) {
        const newPath = state.path === null ? key : `${state.path}.${key}`;

        const err = schema.error('object.unknown', state, opts.context, { path: newPath });

        if (opts.abortEarly)
          return {
            value: null,
            errors: [err],
          };

        errors.push(err);
      }
    }

    if (errors.length > 0) return { value: null, errors };

    return { value, errors: null };
  }
}

export default ObjectSchema;
