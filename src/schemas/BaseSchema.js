const assert = require('@botbind/dust/dist/assert');
const isPlainObject = require('@botbind/dust/dist/isPlainObject');
const clone = require('@botbind/dust/dist/clone');
const merge = require('@botbind/dust/dist/merge');
const equal = require('@botbind/dust/dist/equal');
const serialize = require('@botbind/dust/dist/serialize');
const get = require('@botbind/dust/dist/get');
const Ref = require('../Ref');
const State = require('../State');
const Values = require('../Values');
const ValidationError = require('../ValidationError');
const _const = require('../internals/_constants');

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

function _opts(methodName, withDefaults, opts = {}) {
  assert(isPlainObject(opts), 'The parameter opts for', methodName, 'must be a plain object');

  const merged = { ..._const.DEFAULT_VALIDATE_OPTS, ...opts };

  assert(
    typeof merged.strict === 'boolean',
    'The option strict for',
    methodName,
    'must be a boolean',
  );

  assert(
    typeof merged.abortEarly === 'boolean',
    'The option abortEarly for',
    methodName,
    'must be a boolean',
  );

  assert(
    typeof merged.recursive === 'boolean',
    'The option recursive for',
    methodName,
    'must be a boolean',
  );

  assert(
    typeof merged.allowUnknown === 'boolean',
    'The option allowUnknown for',
    methodName,
    'must be a boolean',
  );

  assert(
    typeof merged.stripUnknown === 'boolean',
    'The option stripUnknown for',
    methodName,
    'must be a boolean',
  );

  assert(
    isPlainObject(merged.context),
    'The option context for',
    methodName,
    'must be a plain object',
  );

  return withDefaults ? merged : opts;
}

function _assign(target, src) {
  target.type = src.type;
  target._refs = [...src._refs];
  target._conditions = [...src._conditions];
  target._rules = [...src._rules];
  target._singleRules = clone(src._singleRules);

  const srcDef = src._definition;
  const def = { ...srcDef };

  def.messages = { ...srcDef.messages };
  def.rules = { ...srcDef.rules };

  target._definition = def;
  target._opts = { ...src._opts };
  target._valids = src._valids.clone();
  target._invalids = src._invalids.clone();
  target.$flags = clone(src.$flags, {
    customizer: value => {
      if (BaseSchema.isValid(value)) return value;

      return undefined;
    },
  });

  return target;
}

function _mergeRebuild(target, src) {
  if (target === null || src === null) return target || src;

  if (target === src) return target;

  return schema => {
    target(schema);
    src(schema);
  };
}

class BaseSchema {
  constructor() {
    this.type = 'any';

    this._refs = []; // [ancestor, root]
    this._conditions = [];
    this._rules = [];
    this._singleRules = new Set(); // non-chainable rules

    // Defined variables that affect the validation internally
    this._definition = {
      rebuild: null,
      clone: null,
      coerce: null,
      validate: null,
      rules: {}, // Rule definition, different from the rules array
      messages: {
        'any.required': '{label} is required',
        'any.forbidden': '{label} is forbidden',
        'any.ref': '{ref} {reason}',
        'any.only': '{label} is invalid (valid value{grammar.s} {grammar.verb} {values})',
        'any.invalid': '{label} is invalid (invalid value{grammar.s} {grammar.verb} {values})',
      },
    };

    this._opts = {};
    this._valids = new Values();
    this._invalids = new Values();

    // User-defined variables that affect the outcomes of the validation
    this.$flags = {
      strip: false,
      presence: 'optional',
      error: null,
      label: null,
      default: undefined,
      only: false,
    };
  }

  static isValid(value) {
    return value != null && !!value.__SCHEMA__;
  }

  $clone() {
    // Can't use BaseSchema.prototype since define creates new prototypes
    // Therefore cloning on these newly defined schemas will not clone their methods
    // const next = Object.create(BaseSchema.prototype);
    const next = Object.create(Object.getPrototypeOf(this));

    return _assign(next, this);
  }

  $merge(src) {
    if (src === undefined) return this;

    if (this === src) return this;

    assert(
      BaseSchema.isValid(src),
      'The parameter src for BaseSchema.$merge must be an instance of BaseSchema',
    );

    assert(
      this.type === 'any' || src.type === 'any' || this.type === src.type,
      `Cannot merge a ${src.type} schema into a ${this.type} schema`,
    );

    const next = this.$clone();

    if (src.type !== 'any') next.type = src.type;

    next._refs = [];
    next._conditions.push(...src._conditions);

    // We are merging rules before definitions because we need the before singularity and after singularity
    for (const { identifier } of src._rules) {
      const srcRuleDef = src._definition.rules[identifier];

      if (!srcRuleDef.single) next._singleRules.delete(identifier);
      else next._singleRules.add(identifier);

      const targetRuleDef = next._definition.rules[identifier];

      if (targetRuleDef === undefined) continue;

      // If the source rule is single or the target rule is single
      if (srcRuleDef.single || targetRuleDef.single)
        next._rules = next._rules.filter(rule => rule.identifier !== identifier);
    }

    next._rules.push(...src._rules);

    const targetDef = next._definition;
    const srcDef = src._definition;
    const def = { ...targetDef, ...srcDef };

    def.rebuild = _mergeRebuild(targetDef.rebuild, srcDef.rebuild);
    def.rules = { ...targetDef.rules, ...srcDef.rules };
    def.messages = { ...targetDef.messages, ...srcDef.messages };

    next._definition = def;

    next._opts = { ...next._opts, ...src._opts };
    next._valids = next._valids.merge(src._valids, src._invalids);
    next._invalids = next._invalids.merge(src._invalids, src._valids);
    next.$flags = merge(next.$flags, src.$flags, {
      customizer: (target, src2) => {
        if (BaseSchema.isValid(target) && BaseSchema.isValid(src2)) return target.$merge(src2);

        return undefined;
      },
    });

    // Rebuild
    if (def.rebuild !== null) def.rebuild(next);

    return next;
  }

  $setFlag(name, value) {
    assert(typeof name === 'string', 'The parameter name for BaseSchema.$setFlag must be a string');

    if (equal(this.$flags[name], value)) return this;

    const next = this.$clone();

    next.$flags[name] = value;

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

  $registerRef(ref) {
    const isRef = Ref.isValid(ref);
    const isSchema = BaseSchema.isValid(ref);

    assert(
      isRef || isSchema,
      'The parameter ref for BaseSchema.$registerRef must be an instance of Ref or BaseSchema',
    );

    if (isRef && ref._ancestor !== 'context' && ref._ancestor - 1 >= 0)
      this._refs.push([ref._ancestor - 1, ref._root]);

    if (isSchema) {
      for (const [ancestor, root] of ref._refs) {
        if (ancestor - 1 >= 0) this._refs.push([ancestor - 1, root]);
      }
    }
  }

  $values(values, type) {
    assert(Array.isArray(values), 'The parameter values for BaseSchema.$values must be an array');

    assert(
      type === 'valids' || type === 'invalids',
      'The parameter type for BaseSchema.$values must be either valids or invalids',
    );

    const other = type === 'valids' ? '_invalids' : '_valids';
    const next = this.$clone();

    next[other].delete(...values);
    next[`_${type}`].add(...values);

    return next;
  }

  $getRule(opts) {
    assert(
      isPlainObject(opts),
      'The parameter opts for BaseSchema.$getRule must be a plain object',
    );

    assert(
      opts.name === undefined || typeof opts.name === 'string',
      'The option name for BaseSchema.$getRule must be a string',
    );
    assert(
      opts.identifier === undefined || typeof opts.identifier === 'string',
      'The option identifier for BaseSchema.$getRule must be a string',
    );
    assert(
      opts.name !== undefined ? opts.identifier === undefined : opts.identifier !== undefined,
      'Only one of options name or identifier for BaseScheam.$getRule must be defined',
    );

    const found = this._rules.filter(({ name, identifier }) => {
      if (opts.identifier !== undefined) return identifier === opts.identifier;

      return name === opts.name;
    });

    if (found.length === 0) return false;

    // Single rule
    if (found.length === 1) {
      const rule = found[0];

      if (this._singleRules.has(rule.identifier)) return rule;
    }

    return found;
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
        next.$registerRef(param);
      }
    }

    if (ruleDef.single) {
      // Remove duplicate rules
      next._rules = next._rules.filter(rule => rule.identifier !== opts.identifier);

      // Set single rules
      next._singleRules.add(opts.identifier);
    }

    if (ruleDef.priority) next._rules.unshift(opts);
    else next._rules.push(opts);

    return next;
  }

  define(opts) {
    assert(isPlainObject(opts), 'The parameter opts for BaseSchema.define must be a plain object');

    opts = {
      type: 'any',
      flags: {},
      messages: {},
      rules: {},
      ...opts,
    };

    assert(typeof opts.type === 'string', 'The option type for BaseSchema.define must be a string');

    assert(
      opts.rebuild === undefined || typeof opts.rebuild === 'function',
      'The option rebuild for BaseSchema.define must be a function',
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
    // Can't use BaseSchema.prototype here either, same reason as $clone
    // const proto = clone(BaseSchema.prototype);
    const proto = clone(Object.getPrototypeOf(this));
    // Reconstruct the instance
    const next = _assign(Object.create(proto), this);

    next.type = opts.type;

    for (const [flagName, flagValue] of Object.entries(opts.flags)) {
      assert(next.$flags[flagName] === undefined, 'Flag', flagName, 'has already been defined');

      next.$flags[flagName] = flagValue;
    }

    const def = next._definition;

    // Populate definition
    if (opts.rebuild !== undefined) def.rebuild = opts.rebuild;

    if (opts.validate !== undefined) def.validate = opts.validate;

    if (opts.coerce !== undefined) def.coerce = opts.coerce;

    for (const [code, message] of Object.entries(opts.messages)) {
      assert(def.messages[code] === undefined, 'Message', code, 'has already been defined');

      def.messages[code] = message;
    }

    // Populate rule definitions
    for (const [ruleName, rule] of Object.entries(opts.rules)) {
      let ruleDef = rule;

      ruleDef = {
        params: [],
        alias: [],
        single: true,
        priority: false,
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
        typeof ruleDef.single === 'boolean',
        'The option single for rule',
        ruleName,
        'must be a boolean',
      );

      assert(
        typeof ruleDef.priority === 'boolean',
        'The option priority for rule',
        ruleName,
        'must be a boolean',
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
        'Either option method or option validate must be defined',
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

      const paramDefs = {};

      // Create param definitions
      for (const { name: paramName, ...rest } of ruleDef.params) {
        assert(
          typeof paramName === 'string',
          'The option name for param of rule',
          ruleName,
          'must be a string',
        );

        const paramDef = {
          ref: true,
          ...rest,
        };

        assert(
          typeof paramDef.ref === 'boolean',
          'The option ref for param',
          paramName,
          'of rule',
          ruleName,
          'must be a boolean',
        );
        assert(
          paramDef.assert === undefined || typeof paramDef.assert === 'function',
          'The option assert for param',
          paramName,
          'of rule',
          ruleName,
          'must be a function',
        );
        assert(
          paramDef.reason === undefined || typeof paramDef.reason === 'string',
          'The option reason for param',
          paramName,
          'of rule',
          ruleName,
          'must be a function',
        );
        assert(
          paramDef.assert !== undefined
            ? paramDef.reason !== undefined
            : paramDef.reason === undefined,
          'The option assert and reason for param',
          paramName,
          'must be defined together',
        );

        paramDefs[paramName] = paramDef;
      }

      ruleDef.params = paramDefs;

      // Only add to rule definitions if the rule has the validate method defined
      if (ruleDef.validate !== undefined) def.rules[ruleName] = ruleDef;

      if (typeof ruleDef.method === 'function') _attachMethod(proto, ruleName, ruleDef.method);

      // ruleDef.validate is defined
      if (ruleDef.method === undefined)
        _attachMethod(proto, ruleName, function defaultMethod() {
          return this.$addRule({ name: ruleName });
        });

      for (const alias of ruleDef.alias) {
        _attachMethod(proto, alias, proto[ruleName]);
      }
    }

    return next;
  }

  opts(opts) {
    const next = this.$clone();

    next._opts = { ...next._opts, ..._opts('any.opts', false, opts) };

    return next;
  }

  strip(enabled = true) {
    assert(typeof enabled === 'boolean', 'The parameter enabled for any.strip must be a boolean');

    return this.$setFlag('strip', enabled);
  }

  presence(presence) {
    assert(
      presence === 'optional' || presence === 'required' || presence === 'forbidden',
      'The parameter presence for any.presence must be optional, required or forbidden',
    );

    return this.$setFlag('presence', presence);
  }

  optional() {
    return this.presence('optional');
  }

  required() {
    return this.presence('required');
  }

  forbidden() {
    return this.presence('forbidden');
  }

  default(value, opts) {
    assert(value !== undefined, `The parameter value for any.default must be provided`);

    return this.$setFlag('default', clone(value, opts));
  }

  label(label) {
    assert(typeof label === 'string', `The parameter label for any.label must be a string`);

    return this.$setFlag('label', label);
  }

  only(enabled = true) {
    assert(typeof enabled === 'boolean', 'The parameter enabled for any.only must be a boolean');

    return this.$setFlag('only', enabled);
  }

  valid(...values) {
    return this.$values(values, 'valids');
  }

  invalid(...values) {
    return this.$values(values, 'invalids');
  }

  error(customizer) {
    assert(
      typeof customizer === 'function' ||
        customizer instanceof Error ||
        typeof customizer === 'string',
      'The parameter customizer for any.error must be a string, a function or an instance of Error',
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
      ...schema._opts,
    };

    const errors = [];
    const helpers = {};

    helpers.schema = schema;
    helpers.state = state;
    helpers.opts = opts;
    helpers.original = value;
    helpers.createError = (code, lookup) => schema.$createError(code, state, opts.context, lookup);

    // Valid values
    const valids = schema._valids;

    if (valids.size > 0) {
      if (valids.has(value, state.ancestors, opts.context)) return { value, errors: null };

      if (schema.$flags.only) {
        const s = valids.size > 1;
        const err = helpers.createError('any.only', {
          values: valids,
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
    const invalids = schema._invalids;

    if (invalids.size > 0) {
      if (invalids.has(value, state.ancestors, opts.context)) {
        const s = invalids.size > 1;
        const err = helpers.createError('any.invalid', {
          values: invalids,
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

    const def = schema._definition;

    // Coerce
    // Always exit early

    if (!opts.strict && def.coerce !== null) {
      const coerced = def.coerce(value, helpers);

      if (coerced.errors === null) value = coerced.value;
      else return coerced;
    }

    // Base check
    // Always exit early
    if (def.validate !== null) {
      const result = def.validate(value, helpers);

      if (result.errors === null) value = result.value;
      else return result;
    }

    // Rules
    for (const rule of schema._rules) {
      const ruleDef = def.rules[rule.identifier];
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

      const result = ruleDef.validate(value, { ...helpers, params, name: rule.name });

      if (result.errors === null) value = result.value;
      else {
        if (opts.abortEarly) return result;

        errors.push(...result.errors);
      }
    }

    return { value, errors: errors.length === 0 ? null : errors };
  }

  validate(value, opts) {
    opts = _opts('any.validate', true, opts);

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

    next.$registerRef(ref);

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
