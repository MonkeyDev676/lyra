const Dust = require('@botbind/dust');
const { ref, isRef } = require('../ref');
const { state: createState, isState } = require('../state');
const { list, isList } = require('../list');
const symbols = require('../symbols');
const _hasKey = require('../internals/_hasKey');

const _defaultSymbol = Symbol('__DEFAULT__');
const _literalSymbol = Symbol('__LITERLA__');
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

class _Schema {
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
        presence: 'optional',
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
    const target = Object.create(Object.getPrototypeOf(this));

    return _assign(target, this);
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
    for (const { identifier } of src._rules) {
      const srcRuleDef = src._definition.rules[identifier];
      const targetRuleDef = target._definition.rules[identifier];

      if (targetRuleDef === undefined) continue;

      // If the source rule is single or the target rule is single
      if (srcRuleDef.single || targetRuleDef.single)
        target._rules = target._rules.filter(rule => rule.identifier !== identifier);
    }

    target._rules.push(...src._rules);
    // Opts, valids, invalids
    target._opts = { ...target._opts, ...src._opts };
    target._valids = target._valids.merge(src._valids, src._invalids);
    target._invalids = target._invalids.merge(src._invalids, src._valids);
    target.$flags = Dust.merge(target.$flags, src.$flags, { symbol: true });

    // Index
    for (const key of Object.keys(src.$index)) {
      const srcGrp = src.$index[key];
      const targetGrp = target.$index[key];
      const grpDef = target._definition.index[key];

      if (targetGrp === undefined) {
        target.$index[key] = srcGrp === null ? null : [...srcGrp];
      } else if (srcGrp !== null) {
        // If merge is a function
        const merge = grpDef.merge;

        if (typeof merge === 'function') target.$index[key] = merge(targetGrp, srcGrp, target, src);
        // If merge is undefined (default) then we perform concating
        else if (merge === undefined) target.$index[key] = [...targetGrp, ...srcGrp];

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

    // Register arguments
    _forEach(this._rules, this.$register);
    // Register flag refs (such as defaults)
    _forEach(this.$flags, this.$register);
    // Register terms (such as schemas and refs)
    _forEach(this.$terms, this.$register);

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

    // Infer identifier. If method is present, use it as the identifier, otherwise use name
    opts.identifier = opts.method === undefined ? opts.name : opts.method;

    // Method is no longer needed so we delete it
    delete opts.method;

    const ruleDef = target._definition.rules[opts.identifier];

    Dust.assert(ruleDef !== undefined, 'Rule definition', opts.identifier, 'not found');

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
        target.$register(arg);
      }
    }

    if (ruleDef.single) {
      // Remove duplicate rules
      target._rules = target._rules.filter(rule => rule.identifier !== opts.identifier);
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

    // Clone the proto so we don't attach methods to all the instances
    // Can't use Schema.prototype here either, same reason as $clone
    // const proto = clone(Schema.prototype);
    const proto = Dust.clone(Object.getPrototypeOf(this));
    // Reconstruct the instance
    const next = _assign(Object.create(proto), this);

    next.type = opts.type;

    const def = next._definition;

    // Populate definition
    if (opts.validate !== undefined) def.validate = opts.validate;

    if (opts.coerce !== undefined) def.coerce = opts.coerce;

    if (opts.rebuild !== undefined) def.rebuild = _rebuild(def.rebuild, opts.rebuild);

    def.flags = { ...def.flags, ...opts.flags };
    def.messages = { ...def.messages, ...opts.messages };

    for (const key of Object.keys(opts.index)) {
      Dust.assert(
        next.$index[key] === undefined,
        'The index group',
        key,
        'has already been defined',
      );

      const isPrivate = _isPrivate(key);
      const grp = {
        value: [],
        merge: !isPrivate,
        ...opts.index[key],
      };

      Dust.assert(
        grp.value === null || Array.isArray(grp.value),
        'The option value for group',
        key,
        'must be null or an array',
      );

      Dust.assert(
        grp.describe === undefined || typeof grp.describe === 'function',
        'The option describe for group',
        key,
        'must be a function',
      );

      Dust.assert(
        typeof grp.merge === 'boolean' || typeof grp.merge === 'function',
        'The option merge for group',
        key,
        'must be a function or a boolean',
      );

      Dust.assert(
        grp.describe === undefined || !isPrivate,
        'Cannot have a describe function for private group',
        key,
      );

      next.$index[key] = grp.value;

      delete grp.value;

      def.index[key] = grp;
    }

    // Populate rule definitions
    for (const ruleName of Object.keys(opts.rules)) {
      const rule = {
        args: [],
        alias: [],
        single: true,
        priority: false,
        ...opts.rules[ruleName],
      };

      Dust.assert(
        Array.isArray(rule.args),
        'The option args for rule',
        ruleName,
        'must be an array',
      );

      Dust.assert(
        Array.isArray(rule.alias) && rule.alias.every(alias => typeof alias === 'string'),
        'The options alias for rule',
        ruleName,
        'must be an array of strings',
      );

      ['single', 'priority'].forEach(optName => {
        const opt = rule[optName];

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
        rule.validate === undefined || typeof rule.validate === 'function',
        'The option validate for rule',
        ruleName,
        'must be a function',
      );

      Dust.assert(
        rule.method === undefined || rule.method === false || typeof rule.method === 'function',
        'The option method for rule',
        ruleName,
        'must be false or a function',
      );

      // Make sure either validate or method is provided
      Dust.assert(
        typeof rule.method === 'function' || rule.validate !== undefined,
        'Either option method or option validate for rule',
        ruleName,
        'must be defined',
      );

      // Cannot have alias if method is false (a hidden rule)
      Dust.assert(
        rule.method !== false || rule.alias.length === 0,
        'Cannot have aliases for rule that has no method',
      );

      // If method is present, check if there's already one
      Dust.assert(
        rule.method === false || proto[ruleName] === undefined,
        'The rule',
        ruleName,
        'has already been defined',
      );

      const args = {};

      // Create arg definitions
      for (const { name: argName, ...otherOpts } of rule.args) {
        Dust.assert(
          typeof argName === 'string',
          'The option name for the argument of rule',
          ruleName,
          'must be a string',
        );

        const arg = {
          ref: true,
          ...otherOpts,
        };

        Dust.assert(
          typeof arg.ref === 'boolean',
          'The option ref for argument',
          argName,
          'of rule',
          ruleName,
          'must be a boolean',
        );

        Dust.assert(
          arg.assert === undefined || typeof arg.assert === 'function',
          'The option assert for argument',
          argName,
          'of rule',
          ruleName,
          'must be a function',
        );

        Dust.assert(
          arg.reason === undefined || typeof arg.reason === 'string',
          'The option reason for argument',
          argName,
          'of rule',
          ruleName,
          'must be a string',
        );

        Dust.assert(
          arg.assert !== undefined ? arg.reason !== undefined : arg.reason === undefined,
          'The option assert and reason for argument',
          argName,
          'must be defined together',
        );

        args[argName] = arg;
      }

      rule.args = args;

      // Only add to rule definitions if the rule has the validate method defined
      if (rule.validate !== undefined) def.rules[ruleName] = rule;

      if (typeof rule.method === 'function') Dust.attachMethod(proto, ruleName, rule.method);

      // rule.validate is defined
      if (rule.method === undefined)
        Dust.attachMethod(proto, ruleName, function defaultMethod() {
          return this.$addRule({ name: ruleName });
        });

      for (const alias of rule.alias) {
        Dust.attachMethod(proto, alias, proto[ruleName]);
      }
    }

    return next;
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

      const grpDef = this._definition.index[key];
      const grp = this.$index[key];

      if (_isPrivate(key) || grp === null || grp.length === 0) continue;

      desc[key] = this.$index[key].map(term => {
        if (grpDef.describe !== undefined) return grpDef.describe(term);

        return _describe(term);
      });
    }

    return desc;
  }

  annotate(note) {
    Dust.assert(typeof note === 'string', 'The parameter note for any.annotate must be a string');

    return this.$setFlag('note', note);
  }

  opts(opts) {
    const next = this.$clone();

    next._opts = { ...next._opts, ..._opts('any.opts', opts) };

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
    return _values(values, 'invalid');
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

    for (const { ref: whenRef, is, then, otherwise } of this.$index.conditions) {
      const result = is.$validate(whenRef.resolve(value, ancestors, context), opts, state);

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
      presence = presence === undefined ? 'optional' : presence;
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
      const err = _getError(coerced);

      if (!err) value = coerced;
      else return { value: null, errors: err };
    }

    // Base check
    // Always exit early
    if (def.validate !== null) {
      const result = def.validate(value, helpers);
      const err = _getError(result);

      if (!err) value = result;
      else return { value: null, errors: err };
    }

    // Rules
    for (const rule of schema._rules) {
      const ruleDef = def.rules[rule.identifier];
      const args = { ...rule.args };
      let errored = false;

      for (const argName of Object.keys(ruleDef.args)) {
        const { assert: argAssert, reason } = ruleDef.args[argName];
        const arg = args[argName];

        if (!isRef(arg)) continue;

        const resolved = arg.resolve(value, ancestors, context);

        if (!argAssert(resolved)) {
          const err = _createError(schema, 'any.ref', state, context, {
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

      const result = ruleDef.validate(value, { ...helpers, args, name: rule.name });
      const err = _getError(result);

      if (!err) value = result;
      else {
        if (abortEarly) return { value: null, errors: err };

        errors.push(...err);
      }
    }

    return { value, errors: errors.length === 0 ? null : errors };
  }

  validate(value, opts) {
    return this.$validate(
      value,
      {
        strict: true,
        abortEarly: true,
        recursive: true,
        allowUnknown: false,
        stripUnknown: false,
        context: {},
        ..._opts('any.validate', opts),
      },
      createState(),
    );
  }

  attempt(value, opts) {
    const result = this.validate(value, opts);

    if (result.errors !== null) throw result.errors[0];

    return result.value;
  }

  when(passedRef, opts) {
    Dust.assert(
      typeof passedRef === 'string' || isRef(passedRef),
      'The parameter ref for any.when must be an instance of Ref or a string',
    );

    Dust.assert(Dust.isObject(opts), 'The parameter opts for any.when must be an object');

    Dust.assert(isSchema(opts.is), 'The option is for any.when must be a valid schema');

    Dust.assert(
      isSchema(opts.then) || isSchema(opts.otherwise),
      'The option then or otherwise for any.when must be a valid schema',
    );

    passedRef = typeof passedRef === 'string' ? ref(passedRef) : passedRef;

    const next = this.$clone();

    next.$register(passedRef);

    next.$index.conditions.push({ ref: passedRef, ...opts });

    return next;
  }
}

Object.defineProperty(_Schema.prototype, _schemaSymbol, { value: true });

const _methods = [
  ['required', 'exists', 'present'],
  ['valid', 'allow', 'equal', 'is'],
  ['invalid', 'deny', 'disallow', 'not'],
  ['opts', 'options', 'prefs', 'preferences'],
  ['annotate', 'note', 'description'],
];

for (const [method, ...aliases] of _methods) {
  aliases.forEach(alias => {
    Dust.attachMethod(_Schema.prototype, alias, _Schema.prototype[method]);
  });
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

function _opts(methodName, opts = {}) {
  Dust.assert(Dust.isObject(opts), 'The parameter opts for', methodName, 'must be an object');

  ['strict', 'abortEarly', 'recursive', 'allowUnknown', 'stripUnknown'].forEach(optName =>
    Dust.assert(
      !_hasKey(opts, optName) || typeof opts[optName] === 'boolean',
      'The option',
      optName,
      'for',
      methodName,
      'must be a boolean',
    ),
  );

  Dust.assert(
    !_hasKey(opts, 'context') || Dust.isObject(opts.context),
    'The option context for',
    methodName,
    'must be an object',
  );

  return opts;
}

function _assign(target, src) {
  target.type = src.type;
  target._refs = [...src._refs];
  target._rules = [...src._rules];
  target._opts = { ...src._opts };
  target._valids = src._valids.clone();
  target._invalids = src._invalids.clone();
  target.$flags = Dust.clone(src.$flags, { symbol: true });
  target.$index = {};

  for (const key of Object.keys(src.$index)) {
    const grp = src.$index[key];

    target.$index[key] = grp === null ? null : [...grp];
  }

  // Merge last due to index
  const srcDef = src._definition;
  const def = { ...srcDef };

  def.messages = { ...srcDef.messages };
  def.rules = { ...srcDef.rules };
  def.index = { ...srcDef.index };

  target._definition = def;

  return target;
}

function _isPrivate(key) {
  return key[0] === '_';
}

function _forEach(value, cb) {
  if (!Dust.isObject(value)) return;

  if (isSchema(value) || isRef(value)) cb(value);

  if (Array.isArray(value))
    for (const subValue of value) {
      _forEach(subValue);
    }

  for (const key of Object.keys(value)) {
    if (_isPrivate(key)) continue;

    _forEach(value[key]);
  }
}

function _rebuild(target, src) {
  if (target === null || src === null) return target || src;

  return schema => {
    target(schema);
    src(schema);
  };
}

function _values(schema, values, type) {
  Dust.assert(values.length > 0, `At least a value must be provided to any.${type}`);

  type = `_${type}s`;

  const other = type === '_valids' ? '_invalids' : type;
  const target = schema.$clone();

  for (const value of values) {
    target[other].delete(value);
    target[type].add(value, schema.$register.bind(this));
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

function _getError(err) {
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

const any = new _Schema().define({
  messages: {
    'any.custom': "{label} fails because validation '{name}' throws '{error}'",
  },

  rules: {
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
          return error('any.custom', { error: err, name });
        }
      },
      args: [
        {
          name: 'method',
          assert: resolved => typeof resolved === 'function',
          reason: 'must be a function',
          ref: false,
        },
        {
          name: 'name',
          assert: resolved => typeof resolved === 'string',
          reason: 'must be a string',
          ref: false,
        },
      ],
    },
  },
});

module.exports = {
  any,
  isSchema,
};
