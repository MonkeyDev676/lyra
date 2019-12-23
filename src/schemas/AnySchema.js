import isPlainObject from 'lodash/isPlainObject';
import cloneDeepWith from 'lodash/cloneDeepWith';
import clone from 'lodash/clone';
import mergeWith from 'lodash/mergeWith';
import Values from '../Values';
import Utils from '../Utils';
import LyraValidationError from '../errors/LyraValidationError';

class AnySchema {
  constructor(type = 'any', messages = {}) {
    Utils.assert(typeof type === 'string', 'The parameter type for AnySchema must be a string');

    Utils.assert(isPlainObject(messages), 'The parameter messages for AnySchema must be an object');

    this._type = type;
    this._flags = {};
    this._messages = {
      [`${this._type}.base`]: `{{label}} must be ${Utils.getDeterminer(this._type)} ${this._type}`,
      'any.required': '{{label}} is required',
      'any.forbidden': '{{label}} is forbidden',
      'any.coerce': '{{label}} cannot be coerced',
      'any.ref': `{{ref}} {{reason}}`,
      'any.valid': '{{label}} is invalid (valid values are {{values}})',
      'any.invalid': '{{label}} is invalid (invalid values are {{values}})',
      ...messages,
    };

    this._label = null;
    this._default = undefined;
    this._valids = new Values();
    this._invalids = new Values();
    this._conditions = [];
    this._refs = []; // [ancestor, root]
    this._rules = [];
    this._transformations = [];
    this._terms = {};
  }

  clone() {
    // Clone all instances but lyra schemas, since they are already immutable
    return cloneDeepWith(this, target => {
      if (Utils.isSchema(target) && target !== this) return target;

      return undefined;
    });
  }

  merge(schema) {
    Utils.assert(
      schema === undefined || Utils.isSchema(schema),
      'The parameter schema must be an instance of AnySchema',
    );

    if (schema === undefined) return this;

    Utils.assert(
      this._type === 'any' || schema._type === 'any' || this._type === schema._type,
      `Cannot merge a ${schema._type} schema into a ${this._type} schema`,
    );

    const next = this.clone();

    return mergeWith(next, schema, (target, source, key) => {
      // If target is not any and source is any, keep the target type
      if (key === '_type' && target !== 'any' && source === 'any') return target;
      // Rules and dependencies and transformations
      if (Array.isArray(target)) return target.concat(source);

      if (Utils.isSchema(target)) return target.merge(source);

      if (key === '_invalids') return target.merge(source, schema._valids);

      if (key === '_valids') return target.merge(source, schema._invalids);

      return undefined;
    });
  }

  report(type, state, context, data = {}) {
    Utils.assert(typeof type === 'string', 'The parameter code for any.report must be a string');
    Utils.assert(isPlainObject(state), 'The parameter state for any.report must be an object');
    Utils.assert(isPlainObject(context), 'The parameter context for any.report myst be an object');
    Utils.assert(isPlainObject(data), 'The parameter data for any.report must be an object');

    if (this._flags.error !== undefined) return this._flags.error(type, state, context, data);

    let label;

    if (this._label === null) {
      if (state.path !== null) label = state.path;
      else label = 'unknown';
    } else label = this._label;

    Utils.assert(
      Object.prototype.hasOwnProperty.call(this._messages, type),
      'The message template is not found',
    );

    const template = this._messages[type];

    let finalMessage = template.replace(/{{label}}/g, label);

    if (data !== undefined)
      finalMessage = finalMessage.replace(/{{(\w*)}}/g, (_, match) => {
        const isContext = match[0] === '$';
        const dataToSearch = isContext ? context : data;

        match = isContext ? match.slice(1) : match;

        Utils.assert(
          Object.prototype.hasOwnProperty.call(dataToSearch, match),
          `The term ${match} is not found`,
        );

        return Utils.serialize(dataToSearch[match]);
      });

    return new LyraValidationError(finalMessage, type, state);
  }

  test(opts) {
    Utils.assert(isPlainObject(opts), 'The parameter opts for any.test must be an object');
    Utils.assert(
      opts.params === undefined || isPlainObject(opts.params),
      'The option params for any.test must be an object',
    );
    Utils.assert(typeof opts.type === 'string', 'The option type for any.test must be a string');
    Utils.assert(
      typeof opts.validate === 'function',
      'The option validate for any.test must be a function',
    );

    const next = this.clone();

    opts.params = opts.params !== undefined ? opts.params : {};

    Object.values(opts.params).forEach(param => {
      if (Utils.isRef(param.value) && param.value._ancestor !== 'context') {
        next._refs.push([param.value._ancestor, param.value._root]);
      }
    });

    opts.validate = opts.validate.bind(this);

    next._rules.push(opts);

    return next;
  }

  transform(transformation) {
    Utils.assert(
      typeof transformation === 'function',
      `The parameter transformation for any.transform must be a function`,
    );

    const next = this.clone();

    next._transformations.push(transformation);

    return next;
  }

  strip() {
    const next = this.clone();

    next._flags.strip = true;

    return next;
  }

  required() {
    const next = this.clone();

    next._flags.presence = 'required';

    return next;
  }

  forbidden() {
    const next = this.clone();

    next._flags.presence = 'forbidden';

    return next;
  }

  default(value, opts = {}) {
    Utils.assert(value !== undefined, `The parameter value for any.default must be provided`);
    Utils.assert(isPlainObject(opts), 'The parameter options for any.default must be an object');
    Utils.assert(
      typeof value === 'function' || !opts.literal,
      'Only function values for any.default support the option literal ',
    );

    const next = this.clone();

    // Don't clone functions
    next._default = cloneDeepWith(value, target => {
      if (typeof target === 'function' && opts.literal) return target;

      return undefined;
    });

    return next;
  }

  label(label) {
    Utils.assert(typeof label === 'string', `The parameter label for any.label must be a string`);

    const next = this.clone();

    next._label = label;

    return next;
  }

  _values(type, values) {
    Utils.assert(
      values.length > 0,
      `The parameter values for any.${type} must have at least one item`,
    );

    const next = this.clone();
    const other = type === 'valid' ? 'invalid' : 'valid';

    next[`_${other}s`].delete(...values);
    next[`_${type}s`].add(...values);

    return next;
  }

  valid(...values) {
    return this._values('valid', values);
  }

  invalid(...values) {
    return this._values('invalid', values);
  }

  when(ref, opts) {
    Utils.assert(Utils.isRef(ref), 'The parameter ref for any.when must be an instance of Ref');
    Utils.assert(isPlainObject(opts), 'The parameter opts for any.when must be an object');
    Utils.assert(
      Utils.isSchema(opts.is),
      'The option is for any.when must be an instance of AnySchema',
    );
    Utils.assert(
      Utils.isSchema(opts.then) || Utils.isSchema(opts.else),
      'The option then or else for any.when must be an instance of AnySchema',
    );

    const next = this.clone();

    if (ref._ancestor !== 'context') {
      next._refs.push([ref._ancestor, ref._root]);
    }

    next._conditions.push((value, ancestors, validateOpts) => {
      const result = opts.is.validate(
        ref.resolve(value, ancestors, validateOpts.context),
        validateOpts,
      );

      if (result.errors === null) return opts.then;

      return opts.else;
    });

    return next;
  }

  error(customizer) {
    Utils.assert(
      typeof customizer === 'function' ||
        customizer instanceof Error ||
        typeof customizer === 'string',
      'The parameter customizer for any.error must be a string, a function or an instance of Error',
    );

    const next = this.clone();

    function wrapper(type, state, context, data) {
      if (typeof customizer === 'function') {
        customizer = customizer(type, state, context, data);
      }

      return new LyraValidationError(
        customizer instanceof Error ? customizer.message : customizer,
        type,
        state,
      );
    }

    next._flags.error = wrapper;

    return next;
  }

  _validate(value, opts, state) {
    value = clone(value);

    const schema = this._conditions.reduce((generated, condition) => {
      return generated.merge(condition(value, state.ancestors, opts));
    }, this);

    const errors = [];

    // Valid values

    if (schema._valids.size > 0) {
      if (schema._valids.has(value, state.ancestors, opts.context)) return { value, errors: null };

      const err = schema.report('any.valid', state, opts.context, { values: schema._valids });

      if (opts.abortEarly)
        return {
          value: null,
          errors: [err],
        };

      errors.push(err);
    }

    // Invalid values

    if (schema._invalids.size > 0) {
      if (schema._valids.has(value, state.ancestors, opts.context)) {
        const err = schema.report('any.invalid', state, opts.context, { values: schema._invalids });

        if (opts.abortEarly)
          return {
            value: null,
            errors: [err],
          };

        errors.push(err);
      }
    }

    // Required

    if (value === undefined) {
      if (schema._flags.presence === 'required')
        return {
          value: null,
          errors: [schema.report('any.required', state, opts.context)],
        };

      let defaultValue = schema._default;

      if (Utils.isRef(schema._default))
        defaultValue = schema._default.resolve(value, state.ancestors, opts.context);

      return { value: defaultValue, errors: null };
    }

    // Forbidden

    if (schema._flags.presence === 'forbidden') {
      return {
        value: null,
        errors: [schema.report('any.forbidden', state, opts.context)],
      };
    }

    // Coerce
    // Always exit early

    if (!opts.strict && schema.coerce !== undefined && value !== null) {
      const coerced = schema.coerce(value, state, opts.context);

      if (coerced.errors !== null) value = coerced.value;
      else
        return {
          value: null,
          errors: [...coerced.errors],
        };
    }

    // Base check
    // Always exit early

    if (!schema.check(value))
      return {
        value: null,
        errors: [schema.report(`${schema._type}.base`, state, opts.context)],
      };

    // Transform

    if (opts.transform)
      value = schema._transformations.reduce(
        (transformed, transform) => transform(transformed),
        value,
      );

    // Inner schemas

    if (schema._validateInner !== undefined) {
      state.ancestors = [value, ...state.ancestors];
      state.depth++;

      const result = this._validateInner(value, opts, state, schema);

      if (result.errors !== null) {
        if (opts.abortEarly) return result;

        errors.push(...result.errors);
      }
    }

    // Rules

    for (const rule of schema._rules) {
      const params = {};
      const rawParams = {};
      let err;

      for (const [key, param] of Object.entries(rule.params)) {
        rawParams[key] = param.value;

        const required = param.required === undefined ? true : param.required;
        const isRef = Utils.isRef(param.value);
        let resolved;

        if (isRef) {
          resolved = param.value.resolve(value, state.ancestors, opts.context);
        } else {
          resolved = param.value;
        }

        let condition = resolved !== undefined || !required;
        let reason = condition ? null : 'is required';

        if (condition) {
          if (
            ['string', 'object', 'boolean', 'array', 'number', 'function'].includes(param.assert)
          ) {
            if (param.assert === 'object') condition = isPlainObject(resolved);

            if (param.assert === 'array') condition = Array.isArray(resolved);
            // eslint-disable-next-line valid-typeof
            else condition = typeof resolved === param.assert;

            reason = `must be ${Utils.getDeterminer(param.assert)} ${param.assert}`;
          } else if (typeof param.assert === 'function') {
            const result = param.assert(resolved);

            condition = result[0];
            reason = result[1];
          }
        }

        if (!condition) {
          // Developer error
          Utils.assert(isRef, `The parameter ${key} of ${rule.type} ${reason}`);

          err = schema.report('any.ref', state, opts.context, { ref: param.value, reason });

          if (opts.abortEarly)
            return {
              value: null,
              errors: [err],
            };

          errors.push(err);

          break;
        }

        params[key] = resolved;
      }

      if (err !== undefined) continue;

      const ruleOpts = {
        value,
        params,
        context: opts.context,
      };

      const result = rule.validate(ruleOpts);

      if (!result) {
        err = schema.report(rule.type, state, opts.context, rawParams);

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

  validate(value, opts = {}) {
    opts = {
      strict: true,
      transform: true,
      abortEarly: true,
      recursive: true,
      allowUnknown: false,
      stripUnknown: false,
      context: {},
      ...opts,
    };

    return this._validate(value, opts, { depth: 1, ancestors: [], path: null });
  }
}

AnySchema.prototype.__LYRA_SCHEMA__ = true;

export default AnySchema;
