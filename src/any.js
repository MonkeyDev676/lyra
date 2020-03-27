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
  callable: Symbol('__CALLABLE__'),
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

function _assign(schema, target) {
  target.type = schema.type;
  target._refs = schema._refs.clone();
  target._rules = [...schema._rules];
  target._opts = { ...schema._opts };
  target._valids = schema._valids.clone();
  target._invalids = schema._invalids.clone();
  target._flags = clone(schema._flags, { symbol: true });
  target.$index = {};

  for (const key of Object.keys(schema.$index)) {
    const terms = schema.$index[key];

    if (terms !== undefined) target.$index[key] = [...terms];
  }

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
    if (key[0] === '_') continue;

    _register(value[key], refs);
  }
}

function _joinRebuild(target, src) {
  if (target === undefined || src === undefined) return target || src;

  return schema => {
    target(schema);
    src(schema);
  };
}

function _joinMethod(target, src) {
  if (target === undefined || src === undefined) return target || src;

  return (value, helpers) => {
    const result = target(value, helpers);
    const err = _error(result);

    if (!err) return src(value, helpers);

    return err;
  };
}

function _describe(term) {
  if (!isObject(term)) return term;

  // Callable default
  if (term[_symbols.callable]) return { callable: term.value };

  if (Array.isArray(term)) return term.map(_describe);

  if (isSchema(term) || Ref.isRef(term)) return term.describe();

  const desc = {};

  for (const key of Object.keys(term)) {
    desc[key] = _describe(term[key]);
  }

  return desc;
}

function _opts(methodName, opts) {
  assert(isObject(opts), 'The parameter opts for', methodName, 'must be an object');

  for (const key of ['strict', 'abortEarly', 'recursive', 'allowUnknown', 'stripUnknown'])
    assert(
      opts[key] === undefined || typeof opts[key] === 'boolean',
      'The option',
      key,
      'for',
      methodName,
      'must be a boolean',
    );

  assert(
    opts.context === undefined || isObject(opts.context),
    'The option context for',
    methodName,
    'must be an object',
  );

  return opts;
}

function _values(schema, values, type) {
  assert(values.length > 0, `At least a value must be provided to any.${type}`);

  const other = type === '_valids' ? '_invalids' : type;
  const target = schema.$clone();

  for (const value of values) {
    target[other].delete(value);
    target[type].add(value, schema._refs);
  }

  return target;
}

function _createError(schema, code, state, context = {}, terms = {}) {
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

  const template = schema._def.messages[code];

  assert(template !== undefined, 'Message template', code, 'not found');

  let label = schema.$getFlag('label');

  if (label === undefined) {
    if (state._path.length > 0) label = state._path.join('.');
    else label = 'unknown';
  }

  const reserved = { label };

  // Message {#reserved} {$context} {terms}
  const message = template.replace(/{(#|\$)?([a-zA-z0-9_-]+)}/g, (_, prefix, term) => {
    let actualTerms = terms;

    if (prefix === '$') actualTerms = context;

    if (prefix === '#') actualTerms = reserved;

    const found = get(actualTerms, term, { default: _symbols.default });

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

class _Any {
  constructor() {
    this.type = 'any';
    this._refs = new _Refs();
    this._rules = []; // [{ name, method, args }]

    // Options that are later combined with ones passed into validation
    this._opts = {};
    this._valids = new _Values();
    this._invalids = new _Values();

    // Simple variables that affect outcome of validation (preferably primitives)
    this._flags = {};
    // Hash of arrays of immutable objects
    this.$index = {
      notes: [],
      conditions: [],
    };
  }

  $clone() {
    // Prototypes for different types are not _Schema
    const target = Object.create(Object.getPrototypeOf(this));

    return _assign(this, target);
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

    for (const rule of src._rules)
      if (target._def.rules[rule.method].single)
        target._rules = target._rules.filter(({ name }) => name !== rule.name);

    target._rules.push(...src._rules);

    target._opts = { ...target._opts, ...src._opts };
    target._valids = target._valids.merge(src._valids, src._invalids);
    target._invalids = target._invalids.merge(src._invalids, src._valids);

    for (const key of Object.keys(src._flags)) {
      if (key[0] === '_') continue;

      target._flags[key] = merge(target._flags[key], src._flags[key], { symbol: true });
    }

    // Index
    for (const key of Object.keys(src.$index)) {
      if (key[0] === '_') continue;

      const terms = src.$index[key];
      const def = target._def.index[key];

      if (target.$index[key] === undefined) {
        target.$index[key] = [...src.$index[key]];

        continue;
      }

      if (def !== undefined && def.merge !== undefined) {
        target.$index[key] = def.merge(target.$index[key], terms, target, src);

        continue;
      }

      target.$index[key] = [...target.$index[key], ...src.$index[key]];
    }

    // Re-register the refs
    target.$rebuild();

    return target;
  }

  $getFlag(name) {
    // flags could be undefined
    if (!Object.prototype.hasOwnProperty.call(this._flags, name)) {
      const def = this._def.flags[name];

      return def === undefined ? undefined : def.default;
    }

    return this._flags[name];
  }

  $setFlag(name, value, opts = {}) {
    assert(typeof name === 'string', 'The parameter name for any.$setFlag must be a string');

    assert(isObject(opts), 'The parameter opts for any.$setFlag must be an object');

    assert(
      opts.clone === undefined || typeof opts.clone === 'boolean',
      'The option clone for any.$setFlag must be a boolean',
    );

    const def = this._def.flags[name];
    const defaultValue = def === undefined ? undefined : def.default;

    // If the flag is set to its default value, we remove it
    if (equal(value, defaultValue)) value = symbols.removeFlag;

    // If the flag and the value are already equal, we don't do anything
    if (equal(this._flags[name], value, { symbol: true })) return this;

    const target = /* Defaults to true */ opts.clone !== false ? this.$clone() : this;

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

    if (this._def.rebuild !== undefined) this._def.rebuild(this);

    return this;
  }

  $references() {
    return this._refs.references();
  }

  $addRule(opts) {
    assert(isObject(opts), 'The parameter opts for any.$addRule must be an object');

    const rule = { ...opts };

    assert(typeof rule.name === 'string', 'The option name for any.$addRule must be a string');

    assert(
      rule.method === undefined || typeof rule.method === 'string',
      'The option method for any.$addRule must be a string',
    );

    assert(
      rule.args === undefined || isObject(rule.args),
      'The option args for any.$addRule must be an object',
    );

    const target = /* Defaults to true */ rule.clone !== false ? this.$clone() : this;

    delete rule.clone;

    // Infer method
    rule.method = rule.method === undefined ? rule.name : rule.method;
    rule.refs = [];

    const def = target._def.rules[rule.method];

    assert(def !== undefined, 'Rule', rule.method, 'not found');

    assert(
      def.args !== undefined || rule.args === undefined,
      'Invalid arguments for rule',
      rule.name,
    );

    if (def.args !== undefined) {
      const keys = Object.keys(def.args);

      assert(
        Object.keys(rule.args).length === keys.length,
        'Invalid arguments for rule',
        rule.name,
      );

      for (const key of keys) {
        const arg = def.args[key];
        const rawArg = rule.args[key];

        // Params assertions
        if (/* Defaults to true */ def.args[key].ref !== false && Ref.isRef(rawArg)) {
          rule.refs.push(key);
          target._refs.register(rawArg);
        } else
          assert(
            arg.assert === undefined || arg.assert(arg),
            'The parameter',
            key,
            'of',
            `${target.type}.${rule.name}`,
            arg.reason,
          );
      }
    } else delete rule.args;

    if (/* Defaults to true */ def.single !== false) {
      // Remove duplicate rules
      target._rules = target._rules.filter(({ name }) => name !== rule.name);
    }

    if (/* Defaults to false */ def.priority) target._rules.unshift(rule);
    else target._rules.push(rule);

    return target;
  }

  extend(opts) {
    assert(isObject(opts), 'The parameter opts for any.extend must be an object');

    assert(
      opts.type === undefined || typeof opts.type === 'string',
      'The option type for any.extend must be a string',
    );

    for (const key of ['flags', 'index', 'messages', 'rules'])
      assert(
        opts[key] === undefined || isObject(opts[key]),
        'The option',
        key,
        'for any.extend must be an object',
      );

    for (const key of ['validate', 'rebuild', 'coerce', 'prepare'])
      assert(
        opts[key] === undefined || typeof opts[key] === 'function',
        'The option',
        key,
        'for any.extend must be a function',
      );

    // Have to clone proto for $clone to work on different types
    // If only instances are cloned then $clone() will not return the extended rules
    const proto = clone(Object.getPrototypeOf(this), { symbol: true });
    const target = _assign(this, Object.create(proto));
    const def = proto._def;

    target.type = opts.type === undefined ? 'any' : opts.type;

    // Populate definition
    for (const key of ['prepare', 'coerce', 'validate'])
      if (opts[key] !== undefined) def[key] = _joinMethod(def[key], opts[key]);

    if (opts.rebuild !== undefined) def.rebuild = _joinRebuild(def.rebuild, opts.rebuild);

    def.messages = { ...def.messages, ...opts.messages };

    // Flags
    if (opts.flags !== undefined)
      for (const key of Object.keys(opts.flags)) {
        assert(def.flags[key] === undefined, 'The flag', key, 'has already been defined');

        if (opts.flags[key] === undefined) continue;

        def.flags[key] = { default: opts.flags[key] };
      }

    // Index
    if (opts.index !== undefined)
      for (const key of Object.keys(opts.index)) {
        assert(def.index[key] === undefined, 'The index terms', key, 'has already been defined');

        const terms = { ...opts.index[key] };

        assert(
          terms.value === undefined || Array.isArray(terms.value),
          'The option value for terms',
          key,
          'must be an array',
        );

        assert(
          terms.describe === undefined || typeof terms.describe === 'function',
          'The option describe for terms',
          key,
          'must be a function',
        );

        assert(
          terms.merge === undefined || typeof terms.merge === 'function',
          'The option merge for terms',
          key,
          'must be a function or a boolean',
        );

        assert(
          terms.describe === undefined || key[0] !== '_',
          'Cannot have a describe function for private terms',
          key,
        );

        target.$index[key] = terms.value === undefined ? [] : terms.value;

        if (terms.merge !== undefined || terms.describe !== undefined) {
          delete terms.value;

          def.index[key] = terms;
        }
      }

    // Populate rule definitions
    if (opts.rules !== undefined)
      for (const ruleName of Object.keys(opts.rules)) {
        const rule = { ...opts.rules[ruleName] };

        assert(
          rule.args === undefined || isObject(rule.args),
          'The option args for rule',
          ruleName,
          'must be an object',
        );

        assert(
          rule.alias === undefined ||
            (Array.isArray(rule.alias) && rule.alias.every(alias => typeof alias === 'string')),
          'The options alias for rule',
          ruleName,
          'must be an array of strings',
        );

        assert(
          rule.validate === undefined || typeof rule.validate === 'function',
          'The option validate for rule',
          ruleName,
          'must be a function',
        );

        assert(
          rule.validate !== undefined || rule.args === undefined,
          'The option validate and args for rule',
          ruleName,
          'must be defined together',
        );

        for (const key of ['single', 'priority']) {
          assert(
            rule[key] === undefined || typeof rule[key] === 'boolean',
            'The option',
            key,
            'for rule',
            ruleName,
            'must be a boolean',
          );

          assert(
            rule.validate !== undefined || rule[key] === undefined,
            'THe option validate and',
            key,
            'for rule',
            ruleName,
            'must be defined together',
          );
        }

        assert(
          rule.method === undefined || rule.method === false || typeof rule.method === 'function',
          'The option method for rule',
          ruleName,
          'must be false or a function',
        );

        // Make sure either validate or method is provided
        assert(
          typeof rule.method === 'function' || rule.validate !== undefined,
          'Either option method or option validate for rule',
          ruleName,
          'must be defined',
        );

        // Cannot have alias if method is false (a hidden rule)
        assert(
          rule.method !== false || rule.alias === undefined || rule.alias.length === 0,
          'Cannot have aliases for',
          ruleName,
          'because it has no method',
        );

        // If method is present, check if there's already one
        assert(
          rule.method === false || proto[ruleName] === undefined,
          'The rule',
          ruleName,
          'has already been defined',
        );

        if (rule.args !== undefined) {
          const args = {};

          // Create arg definitions
          for (const argName of Object.keys(rule.args)) {
            const arg = rule.args[argName];

            assert(
              arg.ref === undefined || typeof arg.ref === 'boolean',
              'The option ref for argument',
              argName,
              'of rule',
              ruleName,
              'must be a boolean',
            );

            assert(
              arg.assert === undefined || typeof arg.assert === 'function',
              'The option assert for argument',
              argName,
              'of rule',
              ruleName,
              'must be a function',
            );

            assert(
              arg.reason === undefined || typeof arg.reason === 'string',
              'The option reason for argument',
              argName,
              'of rule',
              ruleName,
              'must be a string',
            );

            assert(
              arg.assert !== undefined ? arg.reason !== undefined : arg.reason === undefined,
              'The option assert and reason for argument',
              argName,
              'must be defined together',
            );

            args[argName] = arg;
          }

          rule.args = args;
        }

        if (typeof rule.method === 'function') attachMethod(proto, ruleName, rule.method);

        // rule.validate is defined
        if (rule.method === undefined)
          attachMethod(proto, ruleName, function defaultMethod() {
            return this.$addRule({ name: ruleName });
          });

        if (rule.alias !== undefined)
          for (const alias of rule.alias) {
            attachMethod(proto, alias, target[ruleName]);
          }

        if (rule.validate !== undefined) {
          delete rule.method;
          delete rule.alias;

          def.rules[ruleName] = rule;
        }
      }

    return target;
  }

  describe() {
    const desc = {};

    desc.type = this.type;

    for (const key of Object.keys(this._flags)) {
      if (key[0] === '_') continue;

      desc.flags[key] = _describe(this._flags[key]);
    }

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

    for (const key of Object.keys(this.$index)) {
      assert(
        desc[key] === undefined,
        'Cannot generate description for this schema due to internal key conflicts',
      );

      const def = this._def.index[key];
      const terms = this.$index[key];

      if (key[0] === '_' || terms.length === 0 || terms === undefined) continue;

      desc[key] = terms.map(term => {
        if (def !== undefined && def.describe !== undefined) return def.describe(term);

        return _describe(term);
      });
    }

    return desc;
  }

  opts(opts) {
    assert(opts.context === undefined, 'The parameter opts for any.opts must not contain context');

    const target = this.$clone();

    target._opts = { ...target._opts, ..._opts('any.opts', opts) };

    return target;
  }

  annotate(...notes) {
    assert(notes.length > 0, 'The parameter notes for any.annotate must have at least a note');

    assert(
      notes.every(note => typeof note === 'string'),
      'The paramater notes for any.annotate must be an array of strings',
    );

    const target = this.$clone();

    target.$index.notes.push(...notes);

    return target;
  }

  rule(method, name = 'unknown') {
    return this.$addRule({ name: 'custom', args: { method, name } });
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

    assert(
      opts.literal === undefined || opts.literal === true,
      'The option literal for any.default must be a boolean',
    );

    assert(
      typeof value === 'function' || opts.literal === undefined,
      'The option literal for any.default only applies to function value',
    );

    if (typeof value === 'function' && opts.literal === undefined)
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
    return _values(this, values, '_valids');
  }

  invalid(...values) {
    return _values(this, values, '_invalids');
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

    const target = this.$clone();

    target._refs.register(ref);

    target.$index.conditions.push({ ref, ...opts });

    return target;
  }

  $validate(value, opts, state, overrides = {}) {
    let schema = this;

    opts = {
      ...opts,
      ...schema._opts,
    };

    if (schema.$index.conditions !== undefined)
      for (const condition of schema.$index.conditions) {
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

        if (/* Defaults to true */ opts.abortEarly !== false)
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

        if (opts.abortEarly !== false)
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
            // If default value is a function and is callable
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

    const def = schema._def;

    // Methods
    // Always exit early
    for (const method of ['prepare', 'coerce', 'validate']) {
      if (
        def[method] !== undefined &&
        (method !== 'coerce' || /* Defaults to true */ opts.strict !== false)
      ) {
        const result = def[method](value, helpers);
        const err = _error(result);

        if (!err) value = result;
        else return { value: null, errors: err };
      }
    }

    // Rules
    for (const { refs, method, args: rawArgs, validate, ...rule } of schema._rules) {
      const resolveds = { ...rawArgs };
      let errored = false;

      for (const argName of refs) {
        const arg = def.rules[method].args[argName];
        const ref = resolveds[argName];

        const resolved = ref.resolve(value, state._ancestors, opts.context);

        if (arg.assert !== undefined && !arg.assert(resolved)) {
          const err = helpers.error('any.ref', {
            ref: arg,
            reason: arg.reason,
          });

          errored = true;

          if (opts.abortEarly !== false)
            return {
              value: null,
              errors: [err],
            };

          errors.push(err);
        } else resolveds[argName] = resolved;
      }

      if (errored) continue;

      const result = validate(value, { ...helpers, args: resolveds, ...rule });
      const err = _error(result);

      if (!err) value = result;
      else {
        if (opts.abortEarly !== false) return { value: null, errors: err };

        errors.push(...err);
      }
    }

    return { value, errors: errors.length === 0 ? null : errors };
  }

  validate(value, opts = {}) {
    return this.$validate(value, _opts('any.validate', opts), new _State());
  }

  attempt(value, opts) {
    const result = this.validate(value, opts);

    if (result.errors !== null) throw result.errors[0];

    return result.value;
  }
}

// Default definitions
_Any.prototype._def = {
  flags: {
    strip: { default: false },
    only: { default: false },
    presence: { default: 'optional' },
  },
  index: {},
  messages: {
    'any.required': '{#label} is required',
    'any.forbidden': '{#label} is forbidden',
    'any.default': "Default value for {#label} fails to resolve due to '{error}'",
    'any.ref': '{ref} {reason}',
    'any.only': '{#label} must be {values}',
    'any.invalid': '{#label} must not be {values}',
    'any.custom': '{#label} fails validation {name} due to {err}',
  },
  rules: {
    custom: {
      single: false,
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
          ref: false,
          assert: arg => typeof arg === 'function',
          reason: 'must be a function',
        },
        name: {
          assert: arg => typeof arg === 'string',
          reason: 'must be a string',
        },
      },
    },
  },
};

Object.defineProperty(_Any.prototype, _symbols.schema, { value: true });

for (const [method, ...aliases] of [
  ['annotate', 'note', 'description'],
  ['rule', 'custom'],
  ['required', 'exists', 'present'],
  ['valid', 'allow', 'equal', 'is'],
  ['invalid', 'deny', 'disallow', 'not'],
  ['opts', 'options', 'prefs', 'preferences'],
]) {
  for (const alias of aliases) {
    attachMethod(_Any.prototype, alias, _Any.prototype[method]);
  }
}

function isSchema(value) {
  return value != null && !!value[_symbols.schema];
}

module.exports = {
  any: new _Any(),
  isSchema,
};
