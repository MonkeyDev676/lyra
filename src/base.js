const assert = require('@botbind/dust/src/assert');
const attachMethod = require('@botbind/dust/src/attachMethod');
const clone = require('@botbind/dust/src/clone');
const display = require('@botbind/dust/src/display');
const equal = require('@botbind/dust/src/equal');
const get = require('@botbind/dust/src/get');
const isObject = require('@botbind/dust/src/isObject');
const merge = require('@botbind/dust/src/merge');
const Ref = require('./ref');
const symbols = require('./symbols');

const _symbols = {
  default: Symbol('__DEFAULT__'),
  callableDefault: Symbol('__CALLABLE_DEFAULT__'),
  schema: Symbol('__SCHEMA__'),
};

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

// Stores registered refs
class _Refs {
  constructor(refs = []) {
    this.refs = refs; // Register refs [ancestor, root]
  }

  reset() {
    this.refs = [];
  }

  clone() {
    return new _Refs(this.refs);
  }

  register(value) {
    if (Ref.isRef(value) && value._ancestor !== 'context' && value._ancestor - 1 >= 0)
      this.refs.push([value._ancestor - 1, value._root]);

    if (isSchema(value)) {
      for (const [ancestor, root] of value._refs.refs)
        if (ancestor - 1 >= 0) this.refs.push([ancestor - 1, root]);
    }
  }

  references() {
    return this.refs.filter(([ancestor]) => ancestor === 0).map(([, root]) => root);
  }
}

// Stores valids/invalids
class _Values {
  constructor(values, refs) {
    this.values = new Set(values);
    this.refs = new Set(refs);
  }

  get size() {
    return this.values.size + this.refs.size;
  }

  get items() {
    return [...this.values, ...this.refs];
  }

  get display() {
    return [...this.values, ...this.refs.map(ref => ref._display)];
  }

  clone() {
    return new _Values(this.values, this.refs);
  }

  merge(src, remove) {
    for (const value of src.items) this.add(value);

    if (remove !== undefined) for (const value of remove.items) this.delete(value);

    return this;
  }

  add(item, refs) {
    if (Ref.isRef(item)) {
      this.refs.add(item);

      if (refs !== undefined) refs.register(item);
    } else this.values.add(item);

    return this;
  }

  delete(item) {
    if (Ref.isRef(item)) this.refs.delete(item);
    else this.values.delete(item);

    return this;
  }

  has(value, ancestors, context) {
    if (this.values.has(value)) return true;

    for (const v of this.values) {
      if (equal(v, value)) return true;
    }

    for (const ref of this.refs) {
      const resolved = ref.resolve(value, ancestors, context);

      if (equal(resolved, value)) return true;
    }

    return false;
  }

  describe() {
    const desc = [];

    for (const value of this.values) {
      desc.push(value);
    }

    for (const ref of this.refs) {
      desc.push(ref.describe());
    }

    return desc;
  }
}

// Validation state
class _State {
  constructor(ancestors = [], path = [], depth = 0) {
    this._ancestors = ancestors;
    this._depth = depth;
    this._path = path;
  }

  dive(ancestor, path) {
    return new _State([ancestor, ...this._ancestors], [...this._path, path], this._depth++);
  }
}

function _assign(target, src) {
  target.type = src.type;
  target._refs = src._refs.clone();
  target._rules = [...src._rules];
  target._opts = { ...src._opts };
  target._valids = src._valids.clone();
  target._invalids = src._invalids.clone();
  target._flags = clone(src._flags, { symbol: true });
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
  if (!isObject(value)) return;

  if (isSchema(value) || Ref.isRef(value)) {
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
  if (!isObject(term)) return term;

  if (Array.isArray(term)) return term.map(_describe);

  if (isSchema(term) || Ref.isRef(term)) return term.describe();

  const desc = {};

  for (const key of Object.keys(term)) {
    desc[key] = _describe(term[key]);
  }

  return desc;
}

function _opts(methodName, withDefaults, rawOpts = {}) {
  assert(isObject(rawOpts), 'The parameter opts for', methodName, 'must be an object');

  const opts = {
    strict: true,
    abortEarly: true,
    recursive: true,
    allowUnknown: false,
    stripUnknown: false,
    context: {},
    ...rawOpts,
  };

  ['strict', 'abortEarly', 'recursive', 'allowUnknown', 'stripUnknown'].forEach(optName =>
    assert(
      typeof opts[optName] === 'boolean',
      'The option',
      optName,
      'for',
      methodName,
      'must be a boolean',
    ),
  );

  assert(isObject(opts.context), 'The option context for', methodName, 'must be an object');

  return withDefaults ? opts : rawOpts;
}

function _values(schema, values, type) {
  assert(values.length > 0, `At least a value must be provided to any.${type}`);

  type = `_${type}s`;

  const other = type === '_valids' ? '_invalids' : type;
  const target = schema.$clone();

  for (const value of values) {
    target[other].delete(value);
    target[type].add(value, schema._refs);
  }

  return target;
}

function _createError(schema, code, state, context, terms = {}) {
  assert(typeof code === 'string', 'The parameter code for error must be a string');

  assert(state instanceof _State, 'The parameter state for error must be a valid state');

  assert(isObject(terms), 'The parameter terms for error must be an object');

  // Return the error customizer if there is one
  let err = schema.$getFlag('error');

  if (err !== undefined) {
    if (typeof err === 'function') {
      err = err(code, state, context, terms);

      assert(
        err === symbols.next || typeof err === 'string' || err instanceof Error,
        'The error customizer function must return a string or an instance of Error',
      );
    }

    if (err !== symbols.next)
      return new _ValidationError(err instanceof Error ? err.message : err, code, state);
  }

  const template = schema._definition.messages[code];

  assert(template !== undefined, 'Message template', code, 'not found');

  let label = schema.$getFlag('label');

  if (label === undefined) {
    if (state._path.length > 0) label = state._path.join('.');
    else label = 'unknown';
  }

  const reserved = { label };

  // Message {#reserved} {$context} {terms}
  const message = template.replace(/{(#|\$)?([a-zA-z0-9_-]+)}/g, (_, prefix, term) => {
    let newTerms = terms;

    if (prefix === '$') newTerms = context;

    if (prefix === '#') newTerms = reserved;

    const found = get(newTerms, term, { default: _symbols.default });

    assert(found !== _symbols.default, 'Term', term, 'not found');

    return Ref.isRef(found) ? found._display : display(found);
  });

  return new _ValidationError(message, code, state);
}

function _error(err) {
  if (err instanceof _ValidationError) return [err];

  if (Array.isArray(err) && err[0] instanceof _ValidationError) return err;

  return false;
}

class _Base {
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
        presence: { default: 'optional' },
      },
      index: {
        conditions: {},
      },
      rules: {}, // Rule definition, different from the rules array
      messages: {
        'any.required': '{#label} is required',
        'any.forbidden': '{#label} is forbidden',
        'any.default': "Default value for {#label} fails to resolve due to '{error}'",
        'any.ref': '{ref} {reason}',
        'any.only': '{#label} must be {values}',
        'any.invalid': '{#label} must not be {values}',
      },
    };

    // Options that are later combined with ones passed into validation
    this._opts = {};
    this._valids = new _Values();
    this._invalids = new _Values();

    // Simple variables that affect outcome of validation (preferably primitives)
    this._flags = {};
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

    assert(isSchema(src), 'The parameter src for any.$merge must be a valid schema');

    assert(
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
    target._flags = merge(target._flags, src._flags, { symbol: true });

    // Index
    for (const key of Object.keys(src.$index)) {
      const srcTerms = src.$index[key];
      const terms = target.$index[key];
      const termsDef = target._definition.index[key];

      if (terms === undefined) {
        target.$index[key] = [...srcTerms];
      } else if (typeof termsDef.merge === 'function')
        target.$index[key] = termsDef.merge(terms, srcTerms, target, src);
      // If merge is undefined (default) then we perform concating
      else if (termsDef.merge === undefined) target.$index[key] = [...terms, ...srcTerms];

      // If merge  = false then nothing will be done to that terms
    }

    // Re-register the refs
    target.$rebuild();

    return target;
  }

  $getFlag(name) {
    if (!Object.prototype.hasOwnProperty.call(this._flags, name)) {
      const flagDef = this._definition.flags[name];

      return flagDef === undefined ? undefined : flagDef.default;
    }

    return this._flags[name];
  }

  $setFlag(name, value, opts = {}) {
    assert(typeof name === 'string', 'The parameter name for any.$setFlag must be a string');

    assert(isObject(opts), 'The parameter opts for any.$setFlag must be an object');

    opts = {
      clone: true,
      ...opts,
    };

    assert(typeof opts.clone === 'boolean', 'The option clone for any.$setFlag must be a boolean');

    const flagDef = this._definition.flags[name];

    // If the flag is set to its default value, we remove it
    if (flagDef !== undefined && equal(value, flagDef.default)) value = symbols.removeFlag;

    // If the flag and the value are already equal, we don't do anything
    if (equal(this._flags[name], value, { symbol: true })) return this;

    const target = opts.clone ? this.$clone() : this;

    if (value === symbols.removeFlag) delete target._flags[name];
    else {
      target._flags[name] = value;

      // For any flags that store refs such as default
      target._refs.register(value);
    }

    return target;
  }

  $rebuild() {
    // Reset the refs
    this._refs.reset();

    _register(this._flags, this._refs);
    _register(this._rules, this._refs);
    _register(this.$index, this._refs);

    if (this._definition.rebuild !== null) this._definition.rebuild(this);

    return this;
  }

  $references() {
    return this._refs.references();
  }

  $addRule(opts) {
    assert(isObject(opts), 'The parameter opts for any.$addRule must be an object');

    opts = {
      args: {},
      clone: true,
      ...opts,
    };

    assert(typeof opts.name === 'string', 'The option name for any.$addRule must be a string');

    assert(
      opts.method === undefined || typeof opts.method === 'string',
      'The option method for any.$addRule must be a string',
    );

    assert(typeof opts.clone === 'boolean', 'The option clone for any.$addRule must be a boolean');

    assert(isObject(opts.args), 'The option args for any.$addRule must be an object');

    const target = opts.clone ? this.$clone() : this;

    delete opts.clone;

    // Infer method
    opts.method = opts.method === undefined ? opts.name : opts.method;
    opts.refs = [];

    const ruleDef = target._definition.rules[opts.method];

    assert(ruleDef !== undefined, 'Rule definition', opts.method, 'not found');

    // Param definitions
    const argDefs = ruleDef.args;

    for (const argName of Object.keys(argDefs)) {
      const argDef = argDefs[argName];
      const arg = opts.args[argName];
      const isArgRef = Ref.isRef(arg);

      // Params assertions
      if (argDef.ref && isArgRef) {
        opts.refs.push(argName);
        target._refs.register(arg);
      } else
        assert(
          argDef.assert === undefined || argDef.assert(arg),
          'The parameter',
          argName,
          'of',
          `${target.type}.${opts.name}`,
          argDef.reason,
        );
    }

    if (ruleDef.single) {
      // Remove duplicate rules
      target._rules = target._rules.filter(rule => rule.name !== opts.name);
    }

    if (ruleDef.priority) target._rules.unshift(opts);
    else target._rules.push(opts);

    return target;
  }

  extend(opts) {
    assert(isObject(opts), 'The parameter opts for any.extend must be an object');

    opts = {
      type: 'any',
      flags: {},
      index: {},
      messages: {},
      rules: {},
      ...opts,
    };

    assert(typeof opts.type === 'string', 'The option type for any.extend must be a string');

    ['flags', 'index', 'messages', 'rules'].forEach(optName =>
      assert(isObject(opts[optName]), 'The option', optName, 'for any.extend must be an object'),
    );

    ['validate', 'rebuild', 'coerce', 'prepare'].forEach(optName =>
      assert(
        opts[optName] === undefined || typeof opts[optName] === 'function',
        'The option',
        optName,
        'for any.extend must be a function',
      ),
    );

    // Have to clone proto for $clone to work on different types
    // If only instances are cloned then $clone() will not return the extended rules
    const proto = clone(Object.getPrototypeOf(this), { symbol: true });
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
      assert(def.flags[key] === undefined, 'The flag', key, 'has already been defined');

      def.flags[key] = { default: opts.flags[key] };
    }

    // Index
    for (const key of Object.keys(opts.index)) {
      assert(target.$index[key] === undefined, 'The index terms', key, 'has already been defined');

      const isPrivate = _isPrivate(key);
      const termsDef = {
        value: [],
        merge: !isPrivate,
        ...opts.index[key],
      };

      assert(Array.isArray(termsDef.value), 'The option value for terms', key, 'must be an array');

      assert(
        termsDef.describe === undefined || typeof termsDef.describe === 'function',
        'The option describe for terms',
        key,
        'must be a function',
      );

      assert(
        typeof termsDef.merge === 'boolean' || typeof termsDef.merge === 'function',
        'The option merge for terms',
        key,
        'must be a function or a boolean',
      );

      assert(
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

      assert(isObject(ruleDef.args), 'The option args for rule', ruleName, 'must be an object');

      assert(
        Array.isArray(ruleDef.alias) && ruleDef.alias.every(alias => typeof alias === 'string'),
        'The options alias for rule',
        ruleName,
        'must be an array of strings',
      );

      ['single', 'priority'].forEach(optName =>
        assert(
          typeof ruleDef[optName] === 'boolean',
          'The option',
          optName,
          'for rule',
          ruleName,
          'must be a boolean',
        ),
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
        'Either option method or option validate for rule',
        ruleName,
        'must be defined',
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

      const argDefs = {};

      // Create arg definitions
      for (const argName of Object.keys(ruleDef.args)) {
        const argDef = {
          ref: true,
          ...ruleDef.args[argName],
        };

        assert(
          typeof argDef.ref === 'boolean',
          'The option ref for argument',
          argName,
          'of rule',
          ruleName,
          'must be a boolean',
        );

        assert(
          argDef.assert === undefined || typeof argDef.assert === 'function',
          'The option assert for argument',
          argName,
          'of rule',
          ruleName,
          'must be a function',
        );

        assert(
          argDef.reason === undefined || typeof argDef.reason === 'string',
          'The option reason for argument',
          argName,
          'of rule',
          ruleName,
          'must be a string',
        );

        assert(
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

      if (typeof ruleDef.method === 'function') attachMethod(proto, ruleName, ruleDef.method);

      // rule.validate is defined
      if (ruleDef.method === undefined)
        attachMethod(proto, ruleName, function defaultMethod() {
          return this.$addRule({ name: ruleName });
        });

      for (const alias of ruleDef.alias) {
        attachMethod(proto, alias, target[ruleName]);
      }
    }

    return target;
  }

  describe() {
    const desc = {};

    desc.type = this.type;

    if (Object.keys(this._flags).length > 0) desc.flags = clone(this._flags, { symbol: true });

    if (this._rules.length > 0)
      desc.rules = this._rules.map(({ name, args }) => {
        const rule = {};

        rule.name = name;
        rule.args = {};

        for (const argName of Object.keys(args)) {
          const arg = args[argName];

          rule.args[argName] = Ref.isRef(arg) ? arg.describe() : arg;
        }

        return rule;
      });

    if (Object.keys(this._opts).length > 0) desc.opts = clone(this._opts);

    if (this._valids.size > 0) desc.valids = this._valids.describe();

    if (this._invalids.size > 0) desc.invalids = this._invalids.describe();

    const indexKeys = Object.keys(this.$index);

    for (const key of indexKeys) {
      assert(
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

    opts = {
      literal: false,
      ...opts,
    };

    assert(
      typeof opts.literal === 'boolean',
      'The option literal for any.default must be a boolean',
    );

    assert(
      typeof value === 'function' || !opts.literal,
      'The option literal for any.default only applies to function value',
    );

    if (typeof value === 'function' && !opts.literal)
      return this.$setFlag('default', { [_symbols.callableDefault]: true, value });

    return this.$setFlag('default', clone(value, opts.cloneOpts));
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
    return _values(this, values, 'valid');
  }

  invalid(...values) {
    return _values(this, values, 'invalid');
  }

  error(customizer) {
    assert(
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
      error: (code, terms, divedState = state) =>
        _createError(schema, code, divedState, opts.context, terms),
    };

    // Valid values
    const valids = schema._valids;

    if (valids.size > 0) {
      if (valids.has(value, state._ancestors, opts.context)) return { value, errors: null };

      if (schema.$getFlag('only')) {
        const err = helpers.error('any.only', {
          values: valids.display,
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
          values: invalids.display,
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
      presence = schema.$getFlag('presence');
    }

    // Required

    if (value === undefined) {
      if (presence === 'required')
        return {
          value: null,
          errors: [helpers.error('any.required')],
        };

      if (presence === 'forbidden') return { value, errors: null };

      const defaultValue = schema.$getFlag('default');

      if (presence === 'optional') {
        if (defaultValue === undefined) return { value: undefined, errors: null };

        if (defaultValue !== symbols.deepDefault) {
          if (defaultValue[_symbols.callableDefault]) {
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
            value: Ref.isRef(defaultValue)
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

    // Methods
    // Always exit early
    for (const method of ['prepare', 'coerce', 'validate']) {
      const isCoerce = method === 'coerce';

      if (def[method] && isCoerce && !opts.strict) {
        const result = def[method](value, helpers);
        const err = _error(result);

        if (!err) value = result;
        else return { value: null, errors: err };
      }
    }

    // Rules
    for (const rule of schema._rules) {
      const ruleDef = def.rules[rule.method];
      const argDefs = ruleDef.args;
      const args = { ...rule.args };
      let errored = false;

      for (const argName of rule.refs) {
        const argDef = argDefs[argName];
        const arg = args[argName];

        const resolved = arg.resolve(value, state._ancestors, opts.context);

        if (argDef.assert !== undefined && !argDef.assert(resolved)) {
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
    return this.$validate(value, _opts('any.validate', true, opts), new _State());
  }

  attempt(value, opts) {
    const result = this.validate(value, opts);

    if (result.errors !== null) throw result.errors[0];

    return result.value;
  }

  when(ref, opts) {
    assert(
      typeof ref === 'string' || Ref.isRef(ref),
      'The parameter ref for any.when must be a valid reference or a string',
    );

    assert(isObject(opts), 'The parameter opts for any.when must be an object');

    assert(isSchema(opts.is), 'The option is for any.when must be a valid schema');

    assert(
      isSchema(opts.then) || isSchema(opts.otherwise),
      'The option then or otherwise for any.when must be a valid schema',
    );

    ref = typeof ref === 'string' ? Ref.ref(ref) : ref;

    const next = this.$clone();

    next._refs.register(ref);

    next.$index.conditions.push({ ref, ...opts });

    return next;
  }
}

Object.defineProperty(_Base.prototype, _symbols.schema, { value: true });

for (const [method, ...aliases] of [
  ['required', 'exists', 'present'],
  ['valid', 'allow', 'equal', 'is'],
  ['invalid', 'deny', 'disallow', 'not'],
  ['opts', 'options', 'prefs', 'preferences'],
]) {
  aliases.forEach(alias => {
    attachMethod(_Base.prototype, alias, _Base.prototype[method]);
  });
}

function base() {
  return new _Base();
}

function isSchema(value) {
  return value != null && !!value[_symbols.schema];
}

module.exports = {
  base,
  isSchema,
};
