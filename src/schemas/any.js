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

    this.path = state._path.length > 0 ? state._path.join('.') : null;
    this.depth = state._depth;
    this.ancestors = state._ancestors;
  }
}

class _Refs {
  constructor(refs = []) {
    this._refs = refs; // Register refs [ancestor, root]
  }

  reset() {
    this._refs = [];
  }

  clone() {
    return new _Refs(this._refs);
  }

  register(value) {
    if (isRef(value) && value._ancestor !== 'context' && value._ancestor - 1 >= 0)
      this._refs.push([value._ancestor - 1, value._root]);

    if (isSchema(value)) {
      for (const [ancestor, root] of value._refs._refs)
        if (ancestor - 1 >= 0) this._refs.push([ancestor - 1, root]);
    }
  }

  references() {
    return this._refs.filter(([ancestor]) => ancestor === 0).map(([, root]) => root);
  }
}

class _Schema {
  constructor() {
    this.type = 'any';
    this._refs = new _Refs();
    this._rules = []; // [{ name, method, args }]

    // Defined variables that affect the validation internally
    this._definition = {
      rebuild: null,
      prepare: null,
      coerce: null,
      validate: null,
      flags: {
        only: { default: false },
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
        'any.only': '{label} must be {values}',
        'any.invalid': '{label} must not be {values}',
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
    // Prototypes for different types are not _Schema
    const target = Object.create(Object.getPrototypeOf(this));

    return _assign(target, this);
  }

  $merge(src) {
    if (src === undefined) return this;

    if (this === src) return this;

    Dust.assert(isSchema(src), 'The parameter src for any.$merge must be a valid schema');

    Dust.assert(
      this.type === 'any' || src.type === 'any' || this.type === src.type,
      `Cannot merge a ${src.type} schema into a ${this.type} schema`,
    );

    const target = this.$clone();

    if (src.type !== 'any') target.type = src.type;

    // Rules
    // We are merging rules before definitions because we need the before singularity and after singularity
    for (const srcRule of src._rules) {
      const ruleDef = target._definition.rules[srcRule.method];

      if (ruleDef.single) target._rules = target._rules.filter(rule => rule.name !== srcRule.name);
    }

    target._rules.push(...src._rules);

    // Opts, valids, invalids
    target._opts = { ...target._opts, ...src._opts };
    target._valids = target._valids.merge(src._valids, src._invalids);
    target._invalids = target._invalids.merge(src._invalids, src._valids);

    // Flags
    target.$flags = Dust.merge(target.$flags, src.$flags, { symbol: true });

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

        // If merge  = false then nothing will be done to that terms
      }
    }

    // Re-register the refs
    target.$rebuild();

    return target;
  }

  $setFlag(name, value, opts = {}) {
    Dust.assert(typeof name === 'string', 'The parameter name for any.$setFlag must be a string');

    Dust.assert(Dust.isObject(opts), 'The parameter opts for any.$setFlag must be an object');

    opts = {
      clone: true,
      ...opts,
    };

    Dust.assert(
      typeof opts.clone === 'boolean',
      'The option clone for any.$setFlag must be a boolean',
    );

    const flagDef = this._definition.flags[name];

    // If the flag is set to its default value, we either remove it or do nothing
    if (flagDef !== undefined && Dust.equal(value, flagDef.default)) value = undefined;

    // If the flag and the value are already equal, we don't do anything
    if (Dust.equal(this.$flags[name], value, { symbol: true })) return this;

    const target = opts.clone ? this.$clone() : this;

    if (value === undefined) delete target.$flags[name];
    else {
      target.$flags[name] = value;

      // For any flags that store refs such as default
      target._refs.register(value);
    }

    return target;
  }

  $rebuild() {
    // Reset the refs
    this._refs.reset();

    _register(this.$flags, this._refs);
    _register(this._rules, this._refs);
    _register(this.$index, this._refs);

    if (this._definition.rebuild !== null) this._definition.rebuild(this);

    return this;
  }

  $references() {
    return this._refs.references();
  }

  $addRule(opts) {
    Dust.assert(Dust.isObject(opts), 'The parameter opts for any.$addRule must be an object');

    opts = {
      args: {},
      clone: true,
      ...opts,
    };

    Dust.assert(typeof opts.name === 'string', 'The option name for any.$addRule must be a string');

    Dust.assert(
      opts.method === undefined || typeof opts.method === 'string',
      'The option method for any.$addRule must be a string',
    );

    Dust.assert(
      typeof opts.clone === 'boolean',
      'The option clone for any.$addRule must be a boolean',
    );

    Dust.assert(Dust.isObject(opts.args), 'The option args for any.$addRule must be an object');

    const target = opts.clone ? this.$clone() : this;

    // Infer method
    opts.method = opts.method === undefined ? opts.name : opts.method;

    const ruleDef = target._definition.rules[opts.method];

    Dust.assert(ruleDef !== undefined, 'Rule definition', opts.method, 'not found');

    // Param definitions
    const argDefs = ruleDef.args;

    for (const argName of Object.keys(argDefs)) {
      const argDef = argDefs[argName];
      const arg = opts.args[argName];
      const isArgRef = isRef(arg);

      // Params assertions
      Dust.assert(
        argDef.assert(arg) || (argDef.ref && isArgRef),
        'The parameter',
        argName,
        'of',
        `${target.type}.${opts.name}`,
        argDef.reason,
      );

      if (isArgRef) {
        target._refs.register(arg);
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
    Dust.assert(Dust.isObject(opts), 'The parameter opts for any.extend must be an object');

    opts = {
      type: 'any',
      flags: {},
      index: {},
      messages: {},
      rules: {},
      ...opts,
    };

    Dust.assert(typeof opts.type === 'string', 'The option type for any.extend must be a string');

    ['flags', 'index', 'messages', 'rules'].forEach(optName => {
      const opt = opts[optName];

      Dust.assert(Dust.isObject(opt), 'The option', optName, 'for any.extend must be an object');
    });

    ['validate', 'rebuild', 'coerce'].forEach(optName => {
      const opt = opts[optName];

      Dust.assert(
        opt === undefined || typeof opt === 'function',
        'The option',
        optName,
        'for any.extend must be a function',
      );
    });

    // Have to clone proto for $clone to work on different types
    // If only instances are cloned then $clone() will not return the extended rules
    const proto = Dust.clone(Object.getPrototypeOf(this), { symbol: true });
    const target = _assign(Object.create(proto), this);

    target.type = opts.type;

    const def = target._definition;

    // Populate definition
    if (opts.prepare !== undefined) def.prepare = _joinMethod(def.prepare, opts.prepare);

    if (opts.coerce !== undefined) def.coerce = _joinMethod(def.coerce, opts.coerce);

    if (opts.validate !== undefined) def.validate = _joinMethod(def.validate, opts.validate);

    if (opts.rebuild !== undefined) def.rebuild = _joinRebuild(def.rebuild, opts.rebuild);

    def.messages = { ...def.messages, ...opts.messages };

    // Flag defaults
    for (const key of Object.keys(opts.flags)) {
      Dust.assert(def.flags[key] === undefined, 'The flag', key, 'has already been defined');

      def.flags[key] = { default: opts.flags[key] };
    }

    // Index
    for (const key of Object.keys(opts.index)) {
      Dust.assert(
        target.$index[key] === undefined,
        'The index terms',
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
        'The option value for terms',
        key,
        'must be an array',
      );

      Dust.assert(
        termsDef.describe === undefined || typeof termsDef.describe === 'function',
        'The option describe for terms',
        key,
        'must be a function',
      );

      Dust.assert(
        typeof termsDef.merge === 'boolean' || typeof termsDef.merge === 'function',
        'The option merge for terms',
        key,
        'must be a function or a boolean',
      );

      Dust.assert(
        termsDef.describe === undefined || !isPrivate,
        'Cannot have a describe function for private terms',
        key,
      );

      target.$index[key] = termsDef.value;

      delete termsDef.value;

      if (termsDef.merge === true) delete termsDef.merge;
      if (termsDef.describe === undefined) delete termsDef.describe;

      def.index[key] = termsDef;
    }

    // Populate rule definitions
    for (const ruleName of Object.keys(opts.rules)) {
      const ruleDef = {
        args: {},
        alias: [],
        single: true,
        priority: false,
        ...opts.rules[ruleName],
      };

      Dust.assert(
        Dust.isObject(ruleDef.args),
        'The option args for rule',
        ruleName,
        'must be an object',
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
        ruleDef.method === false || proto[ruleName] === undefined,
        'The rule',
        ruleName,
        'has already been defined',
      );

      const argDefs = {};

      // Create arg definitions
      for (const argName of Object.keys(ruleDef.args)) {
        const argDef = {
          ref: true,
          ...ruleDef.args[argName],
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

      if (typeof ruleDef.method === 'function') Dust.attachMethod(proto, ruleName, ruleDef.method);

      // rule.validate is defined
      if (ruleDef.method === undefined)
        Dust.attachMethod(proto, ruleName, function defaultMethod() {
          return this.$addRule({ name: ruleName });
        });

      for (const alias of ruleDef.alias) {
        Dust.attachMethod(proto, alias, target[ruleName]);
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

  presence(presence) {
    Dust.assert(
      _validPresence(presence),
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

    for (const condition of this.$index.conditions) {
      const result = condition.is.$validate(
        condition.ref.resolve(value, state._ancestors, opts.context),
        opts,
        state,
      );

      if (result.errors === null) schema = schema.$merge(condition.then);
      else schema = schema.$merge(condition.otherwise);
    }

    const errors = [];
    const helpers = {
      schema,
      state,
      opts,
      original: value,
      error: (code, local, divedState = state) =>
        _createError(schema, code, divedState, opts.context, local),
    };

    // Valid values
    const valids = schema._valids;

    if (valids.size > 0) {
      if (valids.has(value, state._ancestors, opts.context)) return { value, errors: null };

      if (schema.$flags.only) {
        const err = helpers.error('any.only', {
          values: valids,
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
      if (invalids.has(value, state._ancestors, opts.context)) {
        const err = helpers.error('any.invalid', {
          values: invalids,
        });

        if (opts.abortEarly)
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
      presence = schema.$flags.presence === undefined ? opts.presence : schema.$flags.presence;
    }

    // Required

    if (value === undefined) {
      if (presence === 'required')
        return {
          value: null,
          errors: [helpers.error('any.required')],
        };

      if (presence === 'forbidden') return { value, errors: null };

      const defaultValue = schema.$flags.default;

      if (presence === 'optional') {
        if (defaultValue === undefined) return { value: undefined, errors: null };

        if (defaultValue !== symbols.deepDefault) {
          if (defaultValue[_literalSymbol]) {
            // If default value is a function and is literal
            try {
              return { value: defaultValue.value(state._ancestors[0], helpers), errors: null };
            } catch (err) {
              return {
                value: null,
                errors: [helpers.error('any.default', { error: err })],
              };
            }
          }

          return {
            value: isRef(defaultValue)
              ? defaultValue.resolve(value, state._ancestors, opts.context)
              : defaultValue,
            errors: null,
          };
        }

        // Deep default. Object schema will loop through all the keys
        value = {};
      }
    }

    // Forbidden

    if (presence === 'forbidden') {
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
    for (const rule of schema._rules) {
      const ruleDef = def.rules[rule.method];
      const argDefs = ruleDef.args;
      const args = { ...rule.args };
      let errored = false;

      for (const argName of Object.keys(argDefs)) {
        const argDef = argDefs[argName];
        const arg = args[argName];

        if (!isRef(arg)) continue;

        const resolved = arg.resolve(value, state._ancestors, opts.context);

        if (!argDef.assert(resolved)) {
          const err = helpers.error('any.ref', {
            ref: arg,
            reason: argDef.reason,
          });

          errored = true;

          if (opts.abortEarly)
            return {
              value: null,
              errors: [err],
            };

          errors.push(err);
        } else args[argName] = resolved;
      }

      if (errored) continue;

      const result = ruleDef.validate(value, { ...helpers, args, name: rule.name });
      const err = _error(result);

      if (!err) value = result;
      else {
        if (opts.abortEarly) return { value: null, errors: err };

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

    next._refs.register(ref);

    next.$index.conditions.push({ ref, ...opts });

    return next;
  }
}

Object.defineProperty(_Schema.prototype, _schemaSymbol, { value: true });

const _methods = [
  ['required', 'exists', 'present'],
  ['valid', 'allow', 'equal', 'is'],
  ['invalid', 'deny', 'disallow', 'not'],
  ['opts', 'options', 'prefs', 'preferences'],
];

for (const [method, ...aliases] of _methods) {
  aliases.forEach(alias => {
    Dust.attachMethod(_Schema.prototype, alias, _Schema.prototype[method]);
  });
}

function isSchema(value) {
  return value != null && !!value[_schemaSymbol];
}

// internals
function _assign(target, src) {
  target.type = src.type;
  target._refs = src._refs.clone();
  target._rules = [...src._rules];
  target._opts = { ...src._opts };
  target._valids = src._valids.clone();
  target._invalids = src._invalids.clone();
  target.$flags = Dust.clone(src.$flags, { symbol: true });
  target.$index = {};

  for (const key of Object.keys(src.$index)) target.$index[key] = [...src.$index[key]];

  const srcDef = src._definition;
  const def = { ...srcDef };

  def.messages = { ...srcDef.messages };
  def.rules = { ...srcDef.rules };
  def.index = { ...srcDef.index };

  target._definition = def;

  return target;
}

function _register(value, refs) {
  if (!Dust.isObject(value)) return;

  if (isSchema(value) || isRef(value)) {
    refs.register(value);

    return;
  }

  if (Array.isArray(value)) {
    for (const subValue of value) {
      _register(subValue, refs);
    }

    return;
  }

  for (const key of Object.keys(value)) {
    if (_isPrivate(key)) continue;

    _register(value[key], refs);
  }
}

function _joinRebuild(target, src) {
  if (target === null || src === null) return target || src;

  return schema => {
    target(schema);
    src(schema);
  };
}

function _joinMethod(target, src) {
  if (target === null || src === null) return target || src;

  return (value, helpers) => {
    const result = target(value, helpers);
    const err = _error(result);

    if (!err) return src(value, helpers);

    return err;
  };
}

function _isPrivate(key) {
  return key[0] === '_';
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

function _opts(methodName, withDefaults, rawOpts = {}) {
  Dust.assert(Dust.isObject(rawOpts), 'The parameter opts for', methodName, 'must be an object');

  const opts = {
    strict: true,
    abortEarly: true,
    recursive: true,
    allowUnknown: false,
    stripUnknown: false,
    context: {},
    presence: 'optional',
    ...rawOpts,
  };

  ['strict', 'abortEarly', 'recursive', 'allowUnknown', 'stripUnknown'].forEach(optName =>
    Dust.assert(
      typeof opts[optName] === 'boolean',
      'The option',
      optName,
      'for',
      methodName,
      'must be a boolean',
    ),
  );

  Dust.assert(
    Dust.isObject(opts.context),
    'The option context for',
    methodName,
    'must be an object',
  );

  Dust.assert(
    _validPresence(opts.presence),
    'The option presence for',
    methodName,
    'must be optional, required or forbidden',
  );

  return withDefaults ? opts : rawOpts;
}

function _validPresence(presence) {
  return presence === 'optional' || presence === 'required' || presence === 'forbidden';
}

function _values(schema, values, type) {
  Dust.assert(values.length > 0, `At least a value must be provided to any.${type}`);

  type = `_${type}s`;

  const other = type === '_valids' ? '_invalids' : type;
  const target = schema.$clone();

  for (const value of values) {
    target[other].delete(value);
    target[type].add(value, schema._refs);
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

// Wrapper that deals with refs and values
function _display(value) {
  if (isRef(value)) return value._display;

  if (isList(value)) return _display(value.values().map(_display));

  return Dust.display(value);
}

function _error(err) {
  if (err instanceof _ValidationError) return [err];

  if (Array.isArray(err) && err[0] instanceof _ValidationError) return err;

  return false;
}

// Actual any schema
const any = new _Schema().extend({
  flags: {
    strip: false,
  },
  index: {
    notes: [],
  },
  messages: {
    'any.custom': '{label} fails validation {name} due to {err}',
  },

  rules: {
    annotate: {
      alias: ['description', 'note'],
      method(...notes) {
        Dust.assert(
          notes.length > 0,
          'The parameter notes for any.annotate must have at least a note',
        );

        Dust.assert(
          notes.every(note => typeof note === 'string'),
          'The paramater notes for any.annotate must be an array of strings',
        );

        const target = this.$clone();

        target.$index.notes.push(...notes);

        return target;
      },
    },

    custom: {
      single: false,
      method(method, name = 'unknown') {
        return this.$addRule({ name: 'custom', args: { method, name } });
      },
      validate: (value, helpers) => {
        const {
          args: { method, name },
          error,
        } = helpers;

        try {
          return method(value, helpers);
        } catch (err) {
          return error('any.custom', { err, name });
        }
      },
      args: {
        method: {
          assert: arg => typeof arg === 'function',
          reason: 'must be a function',
        },
        name: {
          assert: arg => typeof arg === 'string',
          reason: 'must be a string',
        },
      },
    },

    strip: {
      method(enabled = true) {
        Dust.assert(
          typeof enabled === 'boolean',
          'The parameter enabled for any.strip must be a boolean',
        );

        return this.$setFlag('strip', enabled);
      },
    },
  },
});

module.exports = {
  any,
  isSchema,
};
