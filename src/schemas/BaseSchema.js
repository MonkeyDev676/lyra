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

const _defaultSymbol = Symbol('__DEFAULT__');

// Wrapper that deals with refs and values
function _serialize(value) {
  if (Ref.isValid(value)) return value._display;

  if (Values.isValid(value))
    return _serialize(value.values().map(subValue => _serialize(subValue)));

  return serialize(value);
}

function _attachMethod(value, methodName, method) {
  Object.defineProperty(value, methodName, {
    value: method,
    configurable: true,
    writable: true,
  });
}

function _cloneCustomizer(value) {
  if (BaseSchema.isValid(value) && value !== this) return value;

  // We don't want to let dust/clone do the work because it will clone _refs as well,
  // which is not what we want
  if (Values.isValid(value)) return value.clone();

  return undefined;
}

function _opts(methodName, opts = {}) {
  assert(isPlainObject(opts), 'The parameter opts for', methodName, 'must be a plain object');

  opts = {
    strict: true,
    abortEarly: true,
    recursive: true,
    allowUnknown: false,
    stripUnknown: false,
    context: {},
    ...opts,
  };

  assert(
    typeof opts.strict === 'boolean',
    'The option strict for',
    methodName,
    'must be a boolean',
  );

  assert(
    typeof opts.abortEarly === 'boolean',
    'The option abortEarly for',
    methodName,
    'must be a boolean',
  );

  assert(
    typeof opts.recursive === 'boolean',
    'The option recursive for',
    methodName,
    'must be a boolean',
  );

  assert(
    typeof opts.allowUnknown === 'boolean',
    'The option allowUnknown for',
    methodName,
    'must be a boolean',
  );

  assert(
    typeof opts.stripUnknown === 'boolean',
    'The option stripUnknown for',
    methodName,
    'must be a boolean',
  );

  assert(
    isPlainObject(opts.context),
    'The option context for',
    methodName,
    'must be a plain object',
  );

  return opts;
}

class BaseSchema {
  constructor() {
    this.type = 'any';

    this._refs = []; // [ancestor, root]
    this._conditions = [];
    this._rules = [];

    // Defined variables that affect the validation internally
    this._definition = {
      clone: null,
      coerce: null,
      validate: null,
      rules: {}, // Rule definition, different from the rules array
      messages: {
        'any.required': '{label} is required',
        'any.forbidden': '{label} is forbidden',
        'any.ref': '{ref} {reason}',
        'any.only': '{label} is invalid (valid value{grammar.s} {grammar.verb} {values})',
        'any.invalid': '{label} is invalid (invalid values{grammar.s} {grammar.verb} {values})',
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
      only: false,
      valids: new Values(),
      invalids: new Values(),
    };
  }

  static isValid(value) {
    return value != null && !!value.__SCHEMA__;
  }

  $clone() {
    return clone(this, {
      customizer: _cloneCustomizer.bind(this),
    });
  }

  $merge(src) {
    if (src === undefined) return this;

    assert(
      BaseSchema.isValid(src),
      'The parameter src for BaseSchema.$merge must be an instance of BaseSchema',
    );

    assert(
      this.type === 'any' || src.type === 'any' || this.type === src.type,
      `Cannot merge a ${src.type} schema into a ${this.type} schema`,
    );

    const next = merge(this, src, {
      customizer: (target, src2, key) => {
        // If target is not any and source is any, keep the target type
        if (key === 'type' && target !== 'any' && src2 === 'any') return target;

        if (BaseSchema.isValid(target) && BaseSchema.isValid(src2) && target !== this)
          return target.$merge(src2);

        if (key === 'valids') return target.merge(src2, src.$flags.invalids);

        if (key === 'invalids') return target.merge(src2, src.$flags.valids);

        // Reset refs
        if (key === '_refs') return [];

        return undefined;
      },

      // merge invokes clone internally, so we have to pass the customizer through
      // this option
      cloneOptions: {
        customizer: _cloneCustomizer.bind(this),
      },
    });

    return next;
  }

  $setFlag(name, value, opts = {}) {
    assert(typeof name === 'string', 'The parameter name for BaseSchema.$setFlag must be a string');

    assert(
      isPlainObject(opts),
      'The parameter opts for BaseSchema.$setFlag must be a plain object',
    );

    opts = {
      literal: false,
      ...opts,
    };

    assert(
      typeof opts.literal === 'boolean',
      'The option literal for BaseSchema.$setFlag must be a boolean',
    );

    assert(
      !opts.literal || typeof value === 'function',
      'The option literal for BaseSchema.$setFlag only applies for function values',
    );

    const next = this.$clone();

    if (typeof value === 'function' && !opts.literal) next.$flags[name] = value(next);
    else next.$flags[name] = value;

    return next;
  }

  $createError(code, state, context, lookup = {}) {
    assert(
      typeof code === 'string',
      'The parameter code for BaseSchema.$createError must be a string',
    );

    assert(
      State.isValid(state),
      'The parameter state for BaseSchema.$createError must be validation state',
    );

    assert(
      isPlainObject(context),
      'The parameter context for BaseSchema.$createError must be a plain object',
    );

    assert(
      isPlainObject(lookup),
      'The parameter lookup for BaseSchema.$createError must be a plain object',
    );

    // Return the error customizer if there is one
    if (this.$flags.error !== null) return this.$flags.error(code, state, context, lookup);

    const template = this._definition.messages[code];

    assert(template !== undefined, 'Message template', code, 'not found');

    let label = this.$flags.label;

    if (label === null) {
      if (state.path !== null) label = state.path;
      else label = 'unknown';
    }

    let message = template.replace(/{label}/g, label);

    message = message.replace(/{([\w+.]+)}/g, (_, match) => {
      const isContext = match[0] === '$';

      lookup = isContext ? context : lookup;
      match = isContext ? match.slice(1) : match;

      const found = get(lookup, match, { default: _defaultSymbol });

      assert(found !== _defaultSymbol, 'Term', match, 'not found');

      return _serialize(found);
    });

    return new ValidationError(message, code, state);
  }

  $mutateRef(ref) {
    assert(
      Ref.isValid(ref),
      'The parameter ref for BaseSchema.$mutateRef must be an instance of Ref',
    );

    if (ref._ancestor !== 'context' && ref._ancestor - 1 >= 0)
      this._refs.push([ref._ancestor - 1, ref._root]);
  }

  $values(values, type) {
    assert(Array.isArray(values), 'The parameter values for BaseSchema.$values must be an array');

    assert(
      values.length > 0,
      'The parameter values for BaseSchema.$values must have at least one item',
    );

    assert(
      type === 'valid' || type === 'invalid',
      'The parameter type for BaseSchema.$values must be either valid or invalid',
    );

    const other = type === 'valid' ? 'invalid' : 'valid';

    return this.$setFlag(type, next => {
      next.$flags[`${other}s`].delete(...values);

      return next.$flags[`${type}s`].add(...values);
    });
  }

  $addRule(opts) {
    assert(
      isPlainObject(opts),
      'The parameter opts for BaseSchema.$addRule must be a plain object',
    );

    opts = {
      params: {},
      ...opts,
    };

    assert(
      typeof opts.name === 'string',
      'The option name for BaseSchema.$addRule must be a string',
    );

    assert(
      opts.method === undefined || typeof opts.method === 'string',
      'The option method for BaseSchema.$addRule must be a string',
    );

    assert(
      isPlainObject(opts.params),
      'The option params for BaseSchema.$addRule must be a plain object',
    );

    const next = this.$clone();

    // Infer identifier. If method is present, use it as the identifier, otherwise use name
    opts.identifier = opts.method === undefined ? opts.name : opts.method;

    // Method is no longer needed so we delete it
    delete opts.method;

    const ruleDef = next._definition.rules[opts.identifier];

    assert(ruleDef !== undefined, 'Rule definition', opts.identifier, 'not found');

    // Param definitions
    const paramDef = ruleDef.params;

    for (const [name, def] of Object.entries(paramDef)) {
      const param = opts.params[name];
      const isRef = Ref.isValid(param);

      // Params assertions
      assert(
        def.assert(param) || (def.ref && isRef),
        'The parameter',
        name,
        'of',
        `${next.type}.${opts.name}`,
        def.reason,
      );

      if (isRef) {
        next.$mutateRef(param);
      }
    }

    next._rules.push(opts);

    return next;
  }

  define(opts) {
    assert(isPlainObject(opts), 'The parameter opts for BaseSchema.define must be a plain object');

    opts = {
      type: 'any',
      prepare: () => {},
      flags: {},
      messages: {},
      rules: {},
      ...opts,
    };

    assert(typeof opts.type === 'string', 'The option type for BaseSchema.define must be a string');

    assert(
      typeof opts.prepare === 'function',
      'The option prepare for BaseSchema.define must be a function',
    );

    assert(
      isPlainObject(opts.flags),
      'The option flags for BaseSchema.define must be a plain object',
    );

    assert(
      isPlainObject(opts.messages),
      'The option messages for BaseSchema.define must be a plain object',
    );

    assert(
      opts.validate === undefined || typeof opts.validate === 'function',
      'The option validate for BaseSchema.define must be a function',
    );

    assert(
      opts.coerce === undefined || typeof opts.coerce === 'function',
      'The option coerce for BaseSchema.define must be a function',
    );

    assert(
      isPlainObject(opts.rules),
      'The option rules for BaseSchema.define must be a plain object',
    );

    // Clone the proto so we don't attach methods to all the instances
    const proto = clone(BaseSchema.prototype);
    // Reconstruct the instance
    const next = Object.create(proto).$merge(this);

    next.type = opts.type;

    opts.prepare(next);

    for (const [flagName, flagValue] of Object.entries(opts.flags)) {
      assert(next.$flags[flagName] === undefined, 'Flag', flagName, 'has already been defined');

      next.$flags[flagName] = flagValue;
    }

    // Populate definition
    if (opts.validate !== undefined) next._definition.validate = opts.validate;

    if (opts.coerce !== undefined) next._definition.coerce = opts.coerce;

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
        Array.isArray(ruleDef.alias) && ruleDef.alias.every(alias => typeof alias === 'string'),
        'The options alias for rule',
        ruleName,
        'must be an array of strings',
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

      // Make sure either validate or method is provided
      assert(
        typeof ruleDef.method === 'function' || ruleDef.validate !== undefined,
        'The option method must be defined if the validate method is defined',
      );

      // Cannot have alias if method is false (a hidden rule)
      assert(
        ruleDef.method !== false || ruleDef.alias.length === 0,
        'Cannot have aliases for rule that has no method',
      );

      // If method is present, check if there's already one
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
          ref: true,
          assert: () => true,
          ...rest,
        };

        assert(
          typeof def.ref === 'boolean',
          'The option ref for param',
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
        assert(
          typeof def.reason === 'string',
          'The option reason for param',
          paramName,
          'of rule',
          ruleName,
          'must be a function',
        );

        paramDef[paramName] = def;
      }

      ruleDef.params = paramDef;

      // Only add to rule definitions if the rule has the validate method defined
      if (ruleDef.validate !== undefined) next._definition.rules[ruleName] = ruleDef;

      if (typeof ruleDef.method === 'function') _attachMethod(proto, ruleName, ruleDef.method);

      // ruleDef.validate is defined
      if (ruleDef.method === undefined)
        _attachMethod(proto, ruleName, () => next.$addRule({ name: ruleName }));

      for (const alias of ruleDef.alias) {
        _attachMethod(proto, alias, proto[ruleName]);
      }
    }

    return next;
  }

  opts(opts) {
    opts = _opts('any.opts', opts);

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
    assert(value !== undefined, `The parameter value for any.default must be provided`);

    return this.$setFlag('default', clone(value, opts));
  }

  label(label) {
    assert(typeof label === 'string', `The parameter label for any.label must be a string`);

    return this.$setFlag('label', label);
  }

  only() {
    return this.$setFlag('only', true);
  }

  valid(...values) {
    return this.$values(values, 'valid');
  }

  invalid(...values) {
    return this.$values(values, 'invalid');
  }

  error(customizer) {
    assert(
      typeof customizer === 'function' ||
        customizer instanceof Error ||
        typeof customizer === 'string',
      'The parameter customizer for any.error must be a string, a function or an instance of Error',
    );

    return this.$setFlag(
      'error',
      (type, state, context, data) => {
        if (typeof customizer === 'function') {
          customizer = customizer(type, state, context, data);
        }

        return new ValidationError(
          customizer instanceof Error ? customizer.message : customizer,
          type,
          state,
        );
      },
      { literal: true },
    );
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
    const helpers = {};

    helpers.schema = schema;
    helpers.state = state;
    helpers.opts = opts;
    helpers.original = value;
    helpers.createError = (code, lookup) => schema.$createError(code, state, opts.context, lookup);

    // Valid values

    if (schema.$flags.valids.size > 0) {
      if (schema.$flags.valids.has(value, state.ancestors, opts.context))
        return { value, errors: null };

      if (schema.$flags.only) {
        const values = schema.$flags.valids;
        const s = values.size > 1;
        const err = helpers.createError('any.only', {
          values,
          grammar: { verb: s ? 'are' : 'is', s: s ? 's' : '' },
        });

        if (opts.abortEarly)
          return {
            value: null,
            errors: [err],
          };

        errors.push(err);
      }
    }

    // Invalid values

    if (schema.$flags.invalids.size > 0) {
      if (schema.$flags.invalids.has(value, state.ancestors, opts.context)) {
        const values = schema.$flags.invalids;
        const s = values.size > 1;
        const err = helpers.createError('any.invalid', {
          values,
          grammar: { verb: s ? 'are' : 'is', s: s ? 's' : '' },
        });

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
        errors: [helpers.createError('any.forbidden')],
      };
    }

    // Coerce
    // Always exit early

    if (!opts.strict && schema._definition.coerce !== null) {
      const coerced = schema._definition.coerce(value, helpers);

      if (coerced.errors === null) value = coerced.value;
      else return coerced;
    }

    // Base check
    // Always exit early
    if (schema._definition.validate !== null) {
      const result = schema._definition.validate(value, helpers);

      if (result.errors === null) value = result.value;
      else return result;
    }

    // Rules
    for (const rule of schema._rules) {
      const ruleDef = schema._definition.rules[rule.identifier];
      const params = { ...rule.params };

      let err;

      for (const [name, paramDef] of Object.entries(ruleDef.params)) {
        const param = params[name];

        if (!Ref.isValid(param)) continue;

        const resolved = param.resolve(value, state.ancestors, opts.context);

        if (!paramDef.assert(resolved)) {
          err = helpers.createError('any.ref', { ref: param, reason: paramDef.reason });

          if (opts.abortEarly)
            return {
              value: null,
              errors: [err],
            };

          errors.push(err);
        } else params[name] = resolved;
      }

      if (err !== undefined) continue;

      const result = ruleDef.validate(value, { ...helpers, params, name: ruleDef.name });

      if (result.errors === null) value = result.value;
      else {
        if (opts.abortEarly) return result;

        errors.push(...result.errors);
      }
    }

    return { value, errors: errors.length === 0 ? null : errors };
  }

  validate(value, opts) {
    opts = _opts('BaseSchema.validate', opts);

    return this.$validate(value, opts, new State());
  }

  when(ref, opts) {
    assert(Ref.isValid(ref), 'The parameter ref for BaseSchema.when must be an instance of Ref');
    assert(isPlainObject(opts), 'The parameter opts for BaseSchema.when must be a plain object');
    assert(
      BaseSchema.isValid(opts.is),
      'The option is for BaseSchema.when must be an instance of BaseSchema',
    );
    assert(
      BaseSchema.isValid(opts.then) || BaseSchema.isValid(opts.else),
      'The option then or else for BaseSchema.when must be an instance of BaseSchema',
    );

    const next = this.$clone();

    next.$mutateRef(ref);

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
}

const _methods = {
  required: ['exists', 'present'],
  valid: ['allow', 'equal'],
  invalid: ['deny', 'disallow', 'not'],
  opts: ['options', 'prefs', 'preferences'],
};

for (const [methodName, aliases] of Object.entries(_methods)) {
  aliases.forEach(alias => {
    _attachMethod(BaseSchema.prototype, alias, BaseSchema.prototype[methodName]);
  });
}

Object.defineProperty(BaseSchema.prototype, '__SCHEMA__', { value: true });

module.exports = BaseSchema;
