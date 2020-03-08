const Dust = require('@botbind/dust');
const { ref: createRef, isRef } = require('../ref');
const { state: createState, isState } = require('../state');
const { list, isList } = require('../list');
const symbols = require('../symbols');

const _defaultSymbol = Symbol('__DEFAULT__');
const _literalSymbol = Symbol('__LITERAL__');
const _schemaSymbol = Symbol('__SCHEMA__');

class _ValidationError extends Error {
  constructor(message, code, state) {
    super(message);

    this.name = 'ValidationError';
    this.code = code;

    const path = state._path;

    this.path = path.length > 0 ? path.join('.') : null;
    this.depth = state._depth;
    this.ancestors = state._ancestors;
  }
}

class _Base {
  constructor() {
    this.type = 'any';

    // Register refs
    this._refs = []; // [ancestor, root]
    this._rules = []; // [{ name, identifier, args }]

    // Defined variables that affect the validation internally
    this._definition = {
      rebuild: null,
      coerce: null,
      validate: null,
      flags: {
        strip: false,
        only: false,
      },
      index: {
        conditions: {},
      },
      rules: {}, // Rule definition, different from the rules array
      messages: {
        'any.required': '{label} is required',
        'any.forbidden': '{label} is forbidden',
        'any.default': "Default value for {label} fails to resolve due to '{error}'",
        'any.ref': '{ref} {reason}',
        'any.only': '{label} is invalid (valid value{grammar.s} {grammar.verb} {values})',
        'any.invalid': '{label} is invalid (invalid value{grammar.s} {grammar.verb} {values})',
      },
    };

    // Options that are later combined with ones passed into validation
    this._opts = {};
    this._valids = list();
    this._invalids = list();

    // Simple variables that affect outcome of validation (preferably primitives)
    this.$flags = {};
    // Hash of arrays of immutable objects
    this.$index = {
      conditions: [],
    };
  }

  $clone() {
    // Can't use Schema.prototype since define creates new prototypes
    // Therefore cloning on these newly defined schemas will not clone their methods
    // const next = Object.create(Schema.prototype);
    const target = Object.create(_Base.prototype);

    target.type = this.type;
    target._refs = [...this._refs];
    target._rules = [...this._rules];
    target._opts = { ...this._opts };
    target._valids = this._valids.clone();
    target._invalids = this._invalids.clone();
    target.$flags = Dust.clone(this.$flags, {
      symbol: true,
      customizer: value => {
        if (isRef(value)) return value;

        return Dust.symbols.next;
      },
    });
    target.$index = {};

    for (const key of Object.keys(this.$index)) {
      const terms = this.$index[key];

      target.$index[key] = [...terms];
    }

    // Merge last due to index
    const srcDef = this._definition;
    const def = { ...srcDef };

    def.messages = { ...srcDef.messages };
    def.rules = { ...srcDef.rules };
    def.index = { ...srcDef.index };

    target._definition = def;

    return target;
  }

  $merge(src) {
    if (src === undefined) return this;

    if (this === src) return this;

    Dust.assert(isSchema(src), 'The parameter src for Schema.$merge must be a valid schema');

    Dust.assert(
      this.type === 'any' || src.type === 'any' || this.type === src.type,
      `Cannot merge a ${src.type} schema into a ${this.type} schema`,
    );

    const target = this.$clone();

    if (src.type !== 'any') target.type = src.type;

    // Rules
    // We are merging rules before definitions because we need the before singularity and after singularity
    for (const { method, name: srcName } of src._rules) {
      const ruleDef = target._definition.rules[method];

      if (ruleDef.single) target._rules = target._rules.filter(({ name }) => name !== srcName);
    }

    target._rules.push(...src._rules);

    // Opts, valids, invalids
    target._opts = { ...target._opts, ...src._opts };
    target._valids = target._valids.merge(src._valids, src._invalids);
    target._invalids = target._invalids.merge(src._invalids, src._valids);

    // Flags
    target.$flags = Dust.merge(target.$flags, src.$flags, {
      symbol: true,
      customizer: (value, ref) => {
        if (isRef(value) && isRef(ref)) return ref;

        return Dust.symbols.next;
      },
    });

    // Index
    for (const key of Object.keys(src.$index)) {
      const srcTerms = src.$index[key];
      const terms = target.$index[key];
      const termsDef = target._definition.index[key];

      if (terms === undefined) {
        target.$index[key] = [...srcTerms];
      } else {
        // If merge is a function
        const merge = termsDef.merge;

        if (typeof merge === 'function') target.$index[key] = merge(terms, srcTerms, target, src);
        // If merge is undefined (default) then we perform concating
        else if (merge === undefined) target.$index[key] = [...terms, ...srcTerms];

        // If merge  = false then nothing will be done to that group
      }
    }

    // Re-register the refs
    target.$rebuild();

    return target;
  }

  $setFlag(name, value, opts = {}) {
    Dust.assert(
      typeof name === 'string',
      'The parameter name for Schema.$setFlag must be a string',
    );

    Dust.assert(Dust.isObject(opts), 'The parameter opts for Schema.$setFlag must be an object');

    opts = {
      clone: true,
      ...opts,
    };

    Dust.assert(
      typeof opts.clone === 'boolean',
      'The option clone for Schema.$setFlag must be a boolean',
    );

    const flagDef = this._definition.flags[name];

    // If the flag is set to its default value, we either remove it or do nothing
    if (flagDef !== undefined && Dust.equal(value, flagDef)) value = undefined;

    // If the flag and the value are already equal, we don't do anything
    if (Dust.equal(this.$flags[name], value, { symbol: true })) return this;

    const target = opts.clone ? this.$clone() : this;

    if (value === undefined) delete target.$flags[name];
    else {
      target.$flags[name] = value;

      // For any flags that store refs such as default
      target.$register(value);
    }

    return target;
  }

  $register(value) {
    if (isRef(value) && value._ancestor !== 'context' && value._ancestor - 1 >= 0)
      this._refs.push([value._ancestor - 1, value._root]);

    if (isSchema(value)) {
      for (const [ancestor, root] of value._refs) {
        if (ancestor - 1 >= 0) this._refs.push([ancestor - 1, root]);
      }
    }
  }

  $rebuild() {
    // Reset the refs
    this._refs = [];

    _register(this);

    const rebuild = this._definition.rebuild;

    if (rebuild !== null) rebuild(this);

    return this;
  }

  $references() {
    return this._refs.filter(([ancestor]) => ancestor === 0).map(([, root]) => root);
  }

  $addRule(opts) {
    Dust.assert(Dust.isObject(opts), 'The parameter opts for Schema.$addRule must be an object');

    opts = {
      args: {},
      ...opts,
    };

    Dust.assert(
      typeof opts.name === 'string',
      'The option name for Schema.$addRule must be a string',
    );

    Dust.assert(
      opts.method === undefined || typeof opts.method === 'string',
      'The option method for Schema.$addRule must be a string',
    );

    Dust.assert(Dust.isObject(opts.args), 'The option args for Schema.$addRule must be an object');

    const target = this.$clone();

    // Infer method
    opts.method = opts.method === undefined ? opts.name : opts.method;

    const ruleDef = target._definition.rules[opts.method];

    Dust.assert(ruleDef !== undefined, 'Rule definition', opts.method, 'not found');

    // Param definitions
    const argDefs = ruleDef.args;

    for (const argName of Object.keys(argDefs)) {
      const { assert, ref, reason } = argDefs[argName];
      const arg = opts.args[argName];
      const isArgRef = isRef(arg);

      // Params assertions
      Dust.assert(
        assert(arg) || (ref && isArgRef),
        'The parameter',
        argName,
        'of',
        `${target.type}.${opts.name}`,
        reason,
      );

      if (isArgRef) {
        target.$register(arg);
      }
    }

    if (ruleDef.single) {
      // Remove duplicate rules
      target._rules = target._rules.filter(({ method }) => method !== opts.method);
    }

    if (ruleDef.priority) target._rules.unshift(opts);
    else target._rules.push(opts);

    return target;
  }

  extend(opts) {
    Dust.assert(Dust.isObject(opts), 'The parameter opts for Schema.extend must be an object');

    opts = {
      type: 'any',
      flags: {},
      index: {},
      messages: {},
      rules: {},
      ...opts,
    };

    Dust.assert(
      typeof opts.type === 'string',
      'The option type for Schema.extend must be a string',
    );

    ['flags', 'index', 'messages', 'rules'].forEach(optName => {
      const opt = opts[optName];

      Dust.assert(Dust.isObject(opt), 'The option', optName, 'for Schema.extend must be an object');
    });

    ['validate', 'coerce', 'rebuild'].forEach(optName => {
      const opt = opts[optName];

      Dust.assert(
        opt === undefined || typeof opt === 'function',
        'The option',
        optName,
        'for Schema.extend must be a function',
      );
    });

    const target = this.$clone();

    target.type = opts.type;

    const def = target._definition;

    // Populate definition
    if (opts.validate !== undefined) def.validate = _joinValidate(def.validate, opts.validate);

    if (opts.coerce !== undefined) def.coerce = _joinValidate(def.coerce, opts.coerce);

    if (opts.rebuild !== undefined) def.rebuild = _joinRebuild(def.rebuild, opts.rebuild);

    def.flags = { ...def.flags, ...opts.flags };
    def.messages = { ...def.messages, ...opts.messages };

    for (const key of Object.keys(opts.index)) {
      Dust.assert(
        target.$index[key] === undefined,
        'The index group',
        key,
        'has already been defined',
      );

      const isPrivate = _isPrivate(key);
      const termsDef = {
        value: [],
        merge: !isPrivate,
        ...opts.index[key],
      };

      Dust.assert(
        Array.isArray(termsDef.value),
        'The option value for group',
        key,
        'must be an array',
      );

      Dust.assert(
        termsDef.describe === undefined || typeof termsDef.describe === 'function',
        'The option describe for group',
        key,
        'must be a function',
      );

      Dust.assert(
        typeof termsDef.merge === 'boolean' || typeof termsDef.merge === 'function',
        'The option merge for group',
        key,
        'must be a function or a boolean',
      );

      Dust.assert(
        termsDef.describe === undefined || !isPrivate,
        'Cannot have a describe function for private group',
        key,
      );

      target.$index[key] = termsDef.value;

      delete termsDef.value;

      def.index[key] = termsDef;
    }

    // Populate rule definitions
    for (const ruleName of Object.keys(opts.rules)) {
      const ruleDef = {
        args: [],
        alias: [],
        single: true,
        priority: false,
        ...opts.rules[ruleName],
      };

      Dust.assert(
        Array.isArray(ruleDef.args),
        'The option args for rule',
        ruleName,
        'must be an array',
      );

      Dust.assert(
        Array.isArray(ruleDef.alias) && ruleDef.alias.every(alias => typeof alias === 'string'),
        'The options alias for rule',
        ruleName,
        'must be an array of strings',
      );

      ['single', 'priority'].forEach(optName => {
        const opt = ruleDef[optName];

        Dust.assert(
          typeof opt === 'boolean',
          'The option',
          optName,
          'for rule',
          ruleName,
          'must be a boolean',
        );
      });

      Dust.assert(
        ruleDef.validate === undefined || typeof ruleDef.validate === 'function',
        'The option validate for rule',
        ruleName,
        'must be a function',
      );

      Dust.assert(
        ruleDef.method === undefined ||
          ruleDef.method === false ||
          typeof ruleDef.method === 'function',
        'The option method for rule',
        ruleName,
        'must be false or a function',
      );

      // Make sure either validate or method is provided
      Dust.assert(
        typeof ruleDef.method === 'function' || ruleDef.validate !== undefined,
        'Either option method or option validate for rule',
        ruleName,
        'must be defined',
      );

      // Cannot have alias if method is false (a hidden rule)
      Dust.assert(
        ruleDef.method !== false || ruleDef.alias.length === 0,
        'Cannot have aliases for rule that has no method',
      );

      // If method is present, check if there's already one
      Dust.assert(
        ruleDef.method === false || target[ruleName] === undefined,
        'The rule',
        ruleName,
        'has already been defined',
      );

      const argDefs = {};

      // Create arg definitions
      for (const { name: argName, ...otherOpts } of ruleDef.args) {
        Dust.assert(
          typeof argName === 'string',
          'The option name for the argument of rule',
          ruleName,
          'must be a string',
        );

        const argDef = {
          ref: true,
          ...otherOpts,
        };

        Dust.assert(
          typeof argDef.ref === 'boolean',
          'The option ref for argument',
          argName,
          'of rule',
          ruleName,
          'must be a boolean',
        );

        Dust.assert(
          argDef.assert === undefined || typeof argDef.assert === 'function',
          'The option assert for argument',
          argName,
          'of rule',
          ruleName,
          'must be a function',
        );

        Dust.assert(
          argDef.reason === undefined || typeof argDef.reason === 'string',
          'The option reason for argument',
          argName,
          'of rule',
          ruleName,
          'must be a string',
        );

        Dust.assert(
          argDef.assert !== undefined ? argDef.reason !== undefined : argDef.reason === undefined,
          'The option assert and reason for argument',
          argName,
          'must be defined together',
        );

        argDefs[argName] = argDef;
      }

      ruleDef.args = argDefs;

      // Only add to rule definitions if the rule has the validate method defined
      if (ruleDef.validate !== undefined) def.rules[ruleName] = ruleDef;

      if (typeof ruleDef.method === 'function') Dust.attachMethod(target, ruleName, ruleDef.method);

      // rule.validate is defined
      if (ruleDef.method === undefined)
        Dust.attachMethod(target, ruleName, function defaultMethod() {
          return this.$addRule({ name: ruleName });
        });

      for (const alias of ruleDef.alias) {
        Dust.attachMethod(target, alias, target[ruleName]);
      }
    }

    return target;
  }

  describe() {
    const desc = {};

    desc.type = this.type;

    if (Object.keys(this.$flags).length > 0) desc.flags = Dust.clone(this.$flags, { symbol: true });

    if (this._rules.length > 0)
      desc.rules = this._rules.map(({ name, args }) => {
        const rule = {};

        rule.name = name;
        rule.args = {};

        for (const argName of Object.keys(args)) {
          const arg = args[argName];

          rule.args[argName] = isRef(arg) ? arg.describe() : arg;
        }

        return rule;
      });

    if (Object.keys(this._opts).length > 0) desc.opts = Dust.clone(this._opts);

    if (this._valids.size > 0) desc.valids = this._valids.describe();

    if (this._invalids.size > 0) desc.invalids = this._invalids.describe();

    const indexKeys = Object.keys(this.$index);

    for (const key of indexKeys) {
      Dust.assert(
        desc[key] === undefined,
        'Cannot generate description for this schema due to internal key conflicts',
      );

      const termsDef = this._definition.index[key];
      const terms = this.$index[key];

      if (_isPrivate(key) || terms.length === 0) continue;

      desc[key] = terms.map(term => {
        if (termsDef.describe !== undefined) return termsDef.describe(term);

        return _describe(term);
      });
    }

    return desc;
  }

  opts(opts) {
    const next = this.$clone();

    next._opts = { ...next._opts, ..._opts('any.opts', false, opts) };

    return next;
  }

  strip(enabled = true) {
    Dust.assert(
      typeof enabled === 'boolean',
      'The parameter enabled for any.strip must be a boolean',
    );

    return this.$setFlag('strip', enabled);
  }

  presence(presence) {
    Dust.assert(
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
    Dust.assert(value !== undefined, `The parameter value for any.default must be provided`);

    opts = {
      literal: false,
      ...opts,
    };

    Dust.assert(
      typeof opts.literal === 'boolean',
      'The option literal for any.default must be a boolean',
    );

    Dust.assert(
      typeof value === 'function' || !opts.literal,
      'The option literal for any.default only applies to function value',
    );

    if (typeof value === 'function' && opts.literal)
      return this.$setFlag('default', { [_literalSymbol]: true, value });

    return this.$setFlag('default', Dust.clone(value, opts.cloneOpts));
  }

  label(label) {
    Dust.assert(typeof label === 'string', `The parameter label for any.label must be a string`);

    return this.$setFlag('label', label);
  }

  only(enabled = true) {
    Dust.assert(
      typeof enabled === 'boolean',
      'The parameter enabled for any.only must be a boolean',
    );

    return this.$setFlag('only', enabled);
  }

  valid(...values) {
    return _values(this, values, 'valid');
  }

  invalid(...values) {
    return _values(this, values, 'invalid');
  }

  error(customizer) {
    Dust.assert(
      typeof customizer === 'function' ||
        customizer instanceof Error ||
        typeof customizer === 'string',
      'The parameter customizer for any.error must be a string, a function or an instance of Error',
    );

    return this.$setFlag('error', customizer);
  }

  $validate(value, opts, state, overrides = {}) {
    let schema = this;

    opts = {
      ...opts,
      ...schema._opts,
    };

    const context = opts.context;
    const abortEarly = opts.abortEarly;
    const ancestors = state._ancestors;

    for (const { ref, is, then, otherwise } of this.$index.conditions) {
      const result = is.$validate(ref.resolve(value, ancestors, context), opts, state);

      if (result.errors === null) schema = schema.$merge(then);
      else schema = schema.$merge(otherwise);
    }

    const errors = [];
    const helpers = {
      schema,
      state,
      opts,
      original: value,
      error: (code, local, divedState = state) =>
        _createError(schema, code, divedState, context, local),
    };

    // Valid values
    const valids = schema._valids;

    if (valids.size > 0) {
      if (valids.has(value, ancestors, context)) return { value, errors: null };

      if (schema.$flags.only) {
        const s = valids.size > 1;
        const err = helpers.error('any.only', {
          values: valids,
          grammar: { verb: s ? 'are' : 'is', s: s ? 's' : '' },
        });

        if (abortEarly)
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
      if (invalids.has(value, ancestors, context)) {
        const s = invalids.size > 1;
        const err = helpers.error('any.invalid', {
          values: invalids,
          grammar: { verb: s ? 'are' : 'is', s: s ? 's' : '' },
        });

        if (abortEarly)
          return {
            value: null,
            errors: [err],
          };

        errors.push(err);
      }
    }

    let presence = overrides.presence;

    // If there's no presence override, use the flag
    if (presence === undefined) {
      presence = schema.$flags.presence;
      presence = presence === undefined ? opts.presence : presence;
    }

    const isForbidden = presence === 'forbidden';

    // Required

    if (value === undefined) {
      if (presence === 'required')
        return {
          value: null,
          errors: [helpers.error('any.required')],
        };

      if (isForbidden) return { value, errors: null };

      const defaultValue = schema.$flags.default;

      if (presence === 'optional') {
        if (defaultValue === undefined) return { value: undefined, errors: null };

        if (defaultValue !== symbols.deepDefault) {
          if (defaultValue[_literalSymbol]) {
            // If default value is a function and is literal
            try {
              return { value: defaultValue.value(ancestors[0], helpers), errors: null };
            } catch (err) {
              return {
                value: null,
                errors: [helpers.error('any.default', { error: err })],
              };
            }
          }

          return {
            value: isRef(defaultValue)
              ? defaultValue.resolve(value, ancestors, context)
              : defaultValue,
            errors: null,
          };
        }

        value = {};
      }
    }

    // Forbidden

    if (isForbidden) {
      return {
        value: null,
        errors: [helpers.error('any.forbidden')],
      };
    }

    const def = schema._definition;

    // Coerce
    // Always exit early

    if (!opts.strict && def.coerce !== null) {
      const coerced = def.coerce(value, helpers);
      const err = _error(coerced);

      if (!err) value = coerced;
      else return { value: null, errors: err };
    }

    // Base check
    // Always exit early
    if (def.validate !== null) {
      const result = def.validate(value, helpers);
      const err = _error(result);

      if (!err) value = result;
      else return { value: null, errors: err };
    }

    // Rules
    for (const { method, args: rawArgs, name } of schema._rules) {
      const { args: argDefs, validate } = def.rules[method];
      const args = { ...rawArgs };
      let errored = false;

      for (const argName of Object.keys(argDefs)) {
        const { assert, reason } = argDefs[argName];
        const arg = args[argName];

        if (!isRef(arg)) continue;

        const resolved = arg.resolve(value, ancestors, context);

        if (!assert(resolved)) {
          const err = helpers.error('any.ref', {
            ref: arg,
            reason,
          });

          errored = true;

          if (abortEarly)
            return {
              value: null,
              errors: [err],
            };

          errors.push(err);
        } else args[argName] = resolved;
      }

      if (errored) continue;

      const result = validate(value, { ...helpers, args, name });
      const err = _error(result);

      if (!err) value = result;
      else {
        if (abortEarly) return { value: null, errors: err };

        errors.push(...err);
      }
    }

    return { value, errors: errors.length === 0 ? null : errors };
  }

  validate(value, opts) {
    return this.$validate(value, _opts('any.validate', true, opts), createState());
  }

  attempt(value, opts) {
    const result = this.validate(value, opts);

    if (result.errors !== null) throw result.errors[0];

    return result.value;
  }

  when(ref, opts) {
    Dust.assert(
      typeof ref === 'string' || isRef(ref),
      'The parameter ref for any.when must be a valid reference or a string',
    );

    Dust.assert(Dust.isObject(opts), 'The parameter opts for any.when must be an object');

    Dust.assert(isSchema(opts.is), 'The option is for any.when must be a valid schema');

    Dust.assert(
      isSchema(opts.then) || isSchema(opts.otherwise),
      'The option then or otherwise for any.when must be a valid schema',
    );

    ref = typeof ref === 'string' ? createRef(ref) : ref;

    const next = this.$clone();

    next.$register(ref);

    next.$index.conditions.push({ ref, ...opts });

    return next;
  }
}

Object.defineProperty(_Base.prototype, _schemaSymbol, { value: true });

const _methods = [
  ['required', 'exists', 'present'],
  ['valid', 'allow', 'equal', 'is'],
  ['invalid', 'deny', 'disallow', 'not'],
  ['opts', 'options', 'prefs', 'preferences'],
];

for (const [method, ...aliases] of _methods) {
  aliases.forEach(alias => {
    Dust.attachMethod(_Base.prototype, alias, _Base.prototype[method]);
  });
}

function base() {
  return new _Base();
}

function isSchema(value) {
  return value != null && !!value[_schemaSymbol];
}

// Wrapper that deals with refs and values
function _display(value) {
  if (isRef(value)) return value._display;

  if (isList(value)) return _display(value.values().map(_display));

  return Dust.display(value);
}

function _opts(methodName, withDefaults, opts = {}) {
  Dust.assert(Dust.isObject(opts), 'The parameter opts for', methodName, 'must be an object');

  const withDefaultOpts = {
    strict: true,
    abortEarly: true,
    recursive: true,
    allowUnknown: false,
    stripUnknown: false,
    context: {},
    presence: 'optional',
    ...opts,
  };

  ['strict', 'abortEarly', 'recursive', 'allowUnknown', 'stripUnknown'].forEach(optName =>
    Dust.assert(
      typeof withDefaultOpts[optName] === 'boolean',
      'The option',
      optName,
      'for',
      methodName,
      'must be a boolean',
    ),
  );

  Dust.assert(
    Dust.isObject(withDefaultOpts.context),
    'The option context for',
    methodName,
    'must be an object',
  );

  const presence = withDefaultOpts.presence;

  Dust.assert(
    presence === 'optional' || presence === 'required' || presence === 'forbidden',
    'The option presence for',
    methodName,
    'must be optional, required or forbidden',
  );

  return withDefaults ? withDefaultOpts : opts;
}

function _isPrivate(key) {
  return key[0] === '_';
}

function _register(schema) {
  const flags = schema.$flags;
  const boundRegister = schema.$register.bind(schema);

  for (const key of Object.keys(flags)) {
    _walk(flags[key], boundRegister);
  }

  for (const rule of schema._rules) {
    _walk(rule, boundRegister);
  }

  const index = schema.$index;

  for (const key of Object.keys(index)) {
    _walk(index[key], boundRegister);
  }
}

function _walk(value, cb) {
  if (!Dust.isObject(value)) return;

  if (isSchema(value) || isRef(value)) cb(value);

  if (Array.isArray(value))
    for (const subValue of value) {
      _walk(subValue);
    }

  for (const key of Object.keys(value)) {
    if (_isPrivate(key)) continue;

    _walk(value[key]);
  }
}

function _joinRebuild(target, src) {
  if (target === null || src === null) return target || src;

  return schema => {
    target(schema);
    src(schema);
  };
}

function _joinValidate(target, src) {
  if (target === null || src === null) return target || src;

  return (value, helpers) => {
    const result = target(value, helpers);
    const err = _error(result);

    if (err) return err;

    return src(value, helpers);
  };
}

function _values(schema, values, type) {
  Dust.assert(values.length > 0, `At least a value must be provided to any.${type}`);

  type = `_${type}s`;

  const other = type === '_valids' ? '_invalids' : type;
  const target = schema.$clone();

  for (const value of values) {
    target[other].delete(value);
    target[type].add(value, schema.$register.bind(schema));
  }

  return target;
}

function _createError(schema, code, state, context, local = {}) {
  Dust.assert(typeof code === 'string', 'The parameter code for error must be a string');

  Dust.assert(isState(state), 'The parameter state for error must be a valid state');

  Dust.assert(Dust.isObject(local), 'The parameter local for error must be an object');

  // Return the error customizer if there is one
  let err = schema.$flags.error;

  if (err !== undefined) {
    if (typeof err === 'function') {
      err = err(code, state, context, local);

      Dust.assert(
        typeof err === 'string' || err instanceof Error,
        'The error customizer function must return either a string or an instance of Error',
      );
    }

    return new _ValidationError(err instanceof Error ? err.message : err, code, state);
  }

  const template = schema._definition.messages[code];

  Dust.assert(template !== undefined, 'Message template', code, 'not found');

  let label = schema.$flags.label;

  if (label === undefined) {
    const path = state._path;

    if (path.length > 0) label = path.join('.');
    else label = 'unknown';
  }

  // Reserved terms
  let message = template.replace(/{label}/g, label);

  message = message.replace(/{([\w+.]+)}/g, (_, match) => {
    const isContext = match[0] === '$';

    local = isContext ? context : local;
    match = isContext ? match.slice(1) : match;

    const found = Dust.get(local, match, { default: _defaultSymbol });

    Dust.assert(found !== _defaultSymbol, 'Term', match, 'not found');

    return _display(found);
  });

  return new _ValidationError(message, code, state);
}

function _error(err) {
  if (err instanceof _ValidationError) return [err];

  if (Array.isArray(err) && err[0] instanceof _ValidationError) return err;

  return false;
}

function _describe(term) {
  if (!Dust.isObject(term)) return term;

  if (Array.isArray(term)) return term.map(_describe);

  if (isSchema(term) || isRef(term) || isList(term)) return term.describe();

  const desc = {};

  for (const key of Object.keys(term)) {
    desc[key] = _describe(term[key]);
  }

  return desc;
}

module.exports = {
  base,
  isSchema,
};
