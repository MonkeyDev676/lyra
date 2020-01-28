const assert = require('@botbind/dust/src/assert');
const isPlainObject = require('@botbind/dust/src/isPlainObject');
const clone = require('@botbind/dust/src/clone');
const merge = require('@botbind/dust/src/merge');
const serialize = require('@botbind/dust/src/serialize');
const get = require('@botbind/dust/src/get');
const Ref = require('../Ref');
const State = require('../State');
const Values = require('../Values');
const ValidationError = require('../ValidationError');

function _attachMethod(value, methodName, method) {
  Object.defineProperty(value, methodName, {
    value: method,
    configurable: true,
    writable: true,
  });
}

class AnySchema {
  constructor() {
    this._type = 'any';
    this._conditions = [];
    this._refs = []; // [ancestor, root]
    this._rules = [];

    // Defined variables that affect the validation internally
    this._definition = {
      transform: null,
      coerce: null,
      validate: null,
      rules: {}, // Rule definition, different from the rules array
      messages: {
        'any.required': '{label} is required',
        'any.forbidden': '{label} is forbidden',
        'any.ref': '{ref} {reason}',
        'any.valid': '{label} is invalid (valid values are {values})',
        'any.invalid': '{label} is invalid (invalid values are {values})',
      },
    };

    // User-defined variables that affect the outcomes of the validation
    this.$flags = {
      strip: false,
      presence: 'optional',
      error: null,
      label: null,
      default: undefined,
      opts: {},
      valids: new Values(),
      invalids: new Values(),
    };
  }

  $isValid(value) {
    return value != null && !!value.__SCHEMA__;
  }

  $clone() {
    return clone(this, {
      customizer(value) {
        if (this.$isValid(value) && value !== this) return value;

        if (Values.isValid(value)) return value.clone();

        return undefined;
      },
    });
  }

  $merge(src) {
    if (src === undefined) return this;

    assert(
      this.$valid(src),
      'The parameter src for AnySchema.$merge must be an instance of AnySchema',
    );
    assert(
      this._type === 'any' || src._type === 'any' || this._type === src._type,
      `Cannot merge a ${src._type} schema into a ${this._type} schema`,
    );

    const next = this.$clone();

    return merge(next, src, {
      customizer(target, src2, key) {
        // If target is not any and source is any, keep the target type
        if (key === '_type' && target !== 'any' && src2 === 'any') return target;

        if (this.$valid(target) && this.$valid(src2) && target !== next) return target.$merge(src2);

        if (key === '_invalids') return target.merge(src2, src._valids);

        if (key === '_valids') return target.merge(src2, src._invalids);

        return undefined;
      },
    });
  }

  $setFlag(name, value) {
    assert(typeof name === 'string', 'The parameter name for AnySchema.$setFlag must be a string');

    const next = this.$clone();

    if (typeof value === 'function') next.$flags[name] = value(next);
    else next.$flags[name] = value;

    return next;
  }

  $createError(code, state, context, lookup = {}) {
    assert(
      typeof code === 'string',
      'The parameter code for AnySchema.$createError must be a string',
    );
    assert(
      State.isValid(state),
      'The parameter state for AnySchema.$createError must be validation state',
    );
    assert(
      isPlainObject(context),
      'The parameter context for AnySchema.$createError must be a plain object',
    );
    assert(
      isPlainObject(lookup),
      'The parameter lookup for AnySchema.$createError must be a plain object',
    );

    // Return the error customizer if there is one
    if (this.$flags.error !== null) return this.$flags.error(code, state, context, lookup);

    const template = this._definition.messages[code];

    assert(template !== undefined, 'Message template not found');

    let label = this.$flags.label;

    if (label === null) {
      if (state.path !== null) label = state.path;
      else label = 'unknown';
    }

    let message = template.replace(/{label}/g, label);

    if (lookup !== undefined)
      message = message.replace(/{(\w*)}/g, (_, match) => {
        const isContext = match[0] === '$';

        lookup = isContext ? context : lookup;
        match = isContext ? match.slice(1) : match;

        const found = get(lookup, match, { default: '__DEFAULT__' });

        assert(found !== '__DEFAULT__', 'Term', match, 'not found');

        return serialize(found);
      });

    return new ValidationError(message, code, state);
  }

  $ref(ref) {
    assert(Ref.isValid(ref), 'The parameter ref for AnySchema.$ref must be an instance of Ref');

    if (ref._ancestor !== 'context') this._refs.push([ref._ancestor, ref._root]);
  }

  $values(values, type) {
    assert(
      values.length > 0,
      `The parameter values for AnySchema.$values must have at least one item`,
    );
    assert(
      type === 'valid' || type === 'invalid',
      'The parameter type for AnySchema.$values must be either valid or invalid',
    );

    const other = type === 'valid' ? 'invalid' : 'valid';

    return this.$setFlag(type, next => {
      next[`_${other}s`].delete(...values);

      return next[`_${type}s`].add(...values);
    });
  }

  $addRule(opts) {
    assert(isPlainObject(opts), 'The parameter opts for AnySchema.$addRule must be a plain object');

    opts = {
      params: {},
      ...opts,
    };

    assert(
      typeof opts.name === 'string',
      'The option name for AnySchema.$addRule must be a string',
    );
    assert(
      opts.method === undefined || typeof opts.method === 'string',
      'The option method for AnySchema.$addRule must be a string',
    );
    assert(
      isPlainObject(opts.params),
      'The option params for AnySchema.$addRule must be a plain object',
    );

    const next = this.$clone();

    // Reconstruct name
    opts.name = `${next._type}.${opts.name}`;
    // Deduce identifier. If method is present, use it as the identifier, otherwise use name
    opts.identifier = opts.method === undefined ? opts.name : `${next._type}.${opts.method}`;

    // Method is no longer needed so we delete it
    delete opts.method;

    // Param definitions
    const paramDefs = next._definition.rules[opts.identifier].params;

    for (const [name, def] of Object.entries(paramDefs)) {
      const param = opts.params[name];
      const isRef = Ref.isValid(param);

      // Params assertions
      assert(
        def.assert(param) || (def.allowsRef && isRef),
        'The parameter',
        name,
        'of',
        opts.name,
        def.reason,
      );

      if (isRef) {
        this.$ref(next, param);
      }
    }

    next._rules.push(opts);

    return next;
  }

  define(opts) {
    assert(isPlainObject(opts), 'The parameter opts for AnySchema.define must be a plain object');

    opts = {
      type: 'any',
      flags: {},
      messages: {},
      rules: {},
      ...opts,
    };

    assert(typeof opts.type === 'string', 'The option type for AnySchema.define must be a string');
    assert(
      isPlainObject(opts.flags),
      'The option flags for AnySchema.define must be a plain object',
    );
    assert(
      isPlainObject(opts.messages),
      'The option messages for AnySchema.define must be a plain object',
    );
    assert(
      typeof opts.validate === 'function',
      'The option validate for AnySchema.define must be a function',
    );
    assert(
      opts.transform === undefined || typeof opts.transform === 'function',
      'The option transform for AnySchema.define must be a function',
    );
    assert(
      opts.coerce === undefined || typeof opts.coerce === 'function',
      'The option coerce for AnySchema.define must be a function',
    );
    assert(
      isPlainObject(opts.rules),
      'The option rules for AnySchema.define must be a plain object',
    );

    // Clone the proto so we don't attach methods to all the instances
    const proto = clone(AnySchema.prototype);
    // Reconstruct the instance
    const next = Object.create(proto).$merge(this);

    next._type = opts.type;

    for (const [flagName, flagValue] of Object.entries(opts.flags)) {
      assert(next.$flags[flagName] === undefined, 'Flag', flagName, 'has already been defined');

      next.$flags[flagName] = flagValue;
    }

    // Populate definition
    next._definition.validate = opts.validate;
    next._definition.transform = opts.transform === undefined ? null : opts.transform;
    next._definition.coerce = opts.coerce === undefined ? null : opts.coerce;

    for (const [code, message] of Object.entries(opts.messages)) {
      assert(
        next._definition.messages[code] === undefined,
        'Message',
        code,
        'has already been defined',
      );

      next._definition.messages[code] = message;
    }

    // Populate rule definitions
    for (const [ruleName, rule] of Object.entries(opts.rules)) {
      let ruleDef = rule;

      ruleDef = {
        params: [],
        alias: [],
        ...ruleDef,
      };

      assert(
        Array.isArray(ruleDef.params),
        'The option params for rule',
        ruleName,
        'must be an array',
      );
      assert(
        Array.isArray(ruleDef.alias),
        'The options alias for rule',
        ruleName,
        'must be an array',
      );
      assert(
        ruleDef.validate === undefined || typeof ruleDef.validate === 'function',
        'The option validate for rule',
        ruleName,
        'must be a function',
      );
      assert(
        ruleDef.method === undefined ||
          ruleDef.method === false ||
          typeof ruleDef.method === 'function',
        'The option method for rule',
        ruleName,
        'must be false or a function',
      );
      assert(
        ruleDef.method === false || proto[ruleName] === undefined,
        'The rule',
        ruleName,
        'has already been defined',
      );

      const paramDef = {};

      // Create param definitions
      for (const { name: paramName, ...rest } of ruleDef.params) {
        assert(
          typeof paramName === 'string',
          'The option name for param of rule',
          ruleName,
          'must be a string',
        );

        const def = {
          allowsRef: true,
          assert() {
            return true;
          },
          ...rest,
        };

        assert(
          typeof def.allowsRef === 'boolean',
          'The option allowsRef for param',
          paramName,
          'of rule',
          ruleName,
          'must be a boolean',
        );
        assert(
          typeof def.assert === 'function',
          'The option assert for param',
          paramName,
          'of rule',
          ruleName,
          'must be a function',
        );

        paramDef[paramName] = def;
      }

      ruleDef.params = paramDef;

      // Only add to rule definitions if the rule has the validate method defined
      if (ruleDef.validate !== undefined)
        next._definition.rules[`${next._type}.${ruleName}`] = ruleDef;

      const method =
        typeof ruleDef.method === 'function'
          ? ruleDef.method
          : () => next.$addRule({ name: ruleName });

      _attachMethod(proto, ruleName, method);

      ruleDef.alias.forEach(alias => {
        _attachMethod(proto, alias, proto[ruleName]);
      });
    }

    return next;
  }

  opts(opts) {
    assert(isPlainObject(opts), 'The parameter opts for AnySchema.opts must be a plain object');

    return this.$setFlag('opts', next => ({
      ...next.$flags.opts,
      ...opts,
    }));
  }

  strip() {
    return this.$setFlag('strip', true);
  }

  optional() {
    return this.$setFlag('presence', 'optional');
  }

  required() {
    return this.$setFlag('presence', 'required');
  }

  forbidden() {
    return this.$setFlag('presence', 'forbidden');
  }

  default(value, opts) {
    assert(value !== undefined, `The parameter value for AnySchema.default must be provided`);

    return this.$setFlag('default', clone(value, opts));
  }

  label(label) {
    assert(typeof label === 'string', `The parameter label for AnySchema.label must be a string`);

    return this.$setFlag('label', label);
  }

  valid(...values) {
    return this.$values(this, 'valid', values);
  }

  invalid(...values) {
    return this.$values(this, 'invalid', values);
  }

  when(ref, opts) {
    assert(Ref.isValid(ref), 'The parameter ref for AnySchema.when must be an instance of Ref');
    assert(isPlainObject(opts), 'The parameter opts for AnySchema.when must be a plain object');
    assert(
      this.$valid(opts.is),
      'The option is for AnySchema.when must be an instance of AnySchema',
    );
    assert(
      this.$valid(opts.then) || this.$valid(opts.else),
      'The option then or else for AnySchema.when must be an instance of AnySchema',
    );

    const next = this.$clone();

    this.$ref(next, ref);

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
    assert(
      typeof customizer === 'function' ||
        customizer instanceof Error ||
        typeof customizer === 'string',
      'The parameter customizer for AnySchema.error must be a string, a function or an instance of Error',
    );

    return this.$setFlag('error', (type, state, context, data) => {
      if (typeof customizer === 'function') {
        customizer = customizer(type, state, context, data);
      }

      return new ValidationError(
        customizer instanceof Error ? customizer.message : customizer,
        type,
        state,
      );
    });
  }

  $validate(value, opts, state) {
    let schema = this;

    for (const condition of this._conditions) {
      schema = schema.$merge(condition(value, state.ancestors, opts));
    }

    opts = {
      ...opts,
      ...schema.$flags.opts,
    };

    const errors = [];
    const helpers = {
      createError(code, lookup) {
        return schema.$createError(code, state, opts.context, lookup);
      },
      setFlag(name, flagValue) {
        return schema.$setFlag(name, flagValue);
      },
      clone() {
        return schema.$clone();
      },
      merge(src) {
        return schema.$merge(src);
      },
      addRule(ruleOpts) {
        return schema.$addRule(ruleOpts);
      },
      ref(ref) {
        return schema.$ref(ref);
      },
    };

    // Valid values

    if (schema.$flags.valids.size > 0) {
      if (schema.$flags.valids.has(value, state.ancestors, opts.context))
        return { value, errors: null };

      const err = helpers.createError('any.valid', { values: schema.$flags.valids });

      if (opts.abortEarly)
        return {
          value: null,
          errors: [err],
        };

      errors.push(err);
    }

    // Invalid values

    if (schema.$flags.invalids.size > 0) {
      if (schema.$flags.invalids.has(value, state.ancestors, opts.context)) {
        const err = helpers.createError('any.invalid', { values: schema.$flags.invalids });

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
      if (schema.$flags.presence === 'required')
        return {
          value: null,
          errors: [helpers.createError('any.required')],
        };

      let defaultValue = schema.$flags.default;

      if (Ref.isValid(schema.$flags.default))
        defaultValue = schema.$flags.default.resolve(value, state.ancestors, opts.context);

      return { value: defaultValue, errors: null };
    }

    // Forbidden

    if (schema.$flags.presence === 'forbidden') {
      return {
        value: null,
        errors: [helpers.createError('any.forbidden', state, opts.context)],
      };
    }

    // Coerce
    // Always exit early

    if (!opts.strict && schema._definition.coerce !== null && value !== null) {
      const coerced = schema._definition.coerce({ value, schema, state, opts, helpers });

      if (coerced.errors === null) value = coerced.value;
      else
        return {
          value: null,
          errors: [...coerced.errors],
        };
    }

    // Transform
    if (opts.transform && schema._definition.transform !== null)
      value = schema._definition.transform({ value, schema, state, opts, helpers });

    // Base check
    // Always exit early
    if (schema._definition.validate !== null) {
      const result = schema._definition.validate({ value, schema, state, opts, helpers });

      if (result.errors !== null) return { value: null, errors: [...result.errors] };
    }

    // Rules

    for (const rule of schema._rules) {
      const definition = schema._definition.rules[rule.identifier];
      const params = { ...rule.params };

      let err;

      for (const [name, param] of Object.entries(definition.params)) {
        const rawParam = rule.params[name];

        if (!Ref.isValid(rawParam)) continue;

        const resolved = rawParam.resolve(value, state.ancestors, opts.context);

        if (!param.assert(resolved)) {
          err = helpers.createError('any.ref', {
            ref: rawParam,
            reason: param.reason,
          });

          if (opts.abortEarly)
            return {
              value: null,
              errors: [err],
            };

          errors.push(err);
        } else params[name] = resolved;
      }

      if (err !== undefined) continue;

      const result = definition.validate({ value, schema, state, opts, params, helpers });

      if (!result) {
        err = helpers.createError(rule.name, rule.params);

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
    assert(isPlainObject(opts), 'The parameter opts for AnySchema.validate must be a plain object');

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

    return this.$validate(value, opts, new State());
  }
}

const methods = {
  required: ['exist', 'present'],
  valid: ['allow', 'equal'],
  invalid: ['deny', 'disallow', 'not'],
  opts: ['options', 'prefs', 'preferences'],
};

for (const [methodName, aliases] of Object.entries(methods)) {
  aliases.forEach(alias => {
    _attachMethod(AnySchema.prototype, alias, AnySchema.prototype[methodName]);
  });
}

Object.defineProperty(AnySchema.prototype, '__SCHEMA__', { value: true });

module.exports = new AnySchema();
