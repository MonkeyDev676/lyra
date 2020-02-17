const assert = require('@botbind/dust/dist/assert');
const isObjectLike = require('@botbind/dust/dist/isObjectLike');
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
const _errorSymbol = Symbol('__ERROR__');

class BaseSchema {
  constructor() {
    this.type = 'any';

    // Register refs
    this._refs = []; // [ancestor, root]
    this._conditions = []; // [{ ref, is, then, otherwise }]
    this._rules = []; // [{ name, identifier, args }]

    // Defined variables that affect the validation internally
    this._definition = {
      coerce: null,
      validate: null,
      flags: {}, // Contain clone definition and merge defintion of a flag
      rules: {}, // Rule definition, different from the rules array
      messages: {
        'any.required': '{label} is required',
        'any.forbidden': '{label} is forbidden',
        'any.ref': '{ref} {reason}',
        'any.only': '{label} is invalid (valid value{grammar.s} {grammar.verb} {values})',
        'any.invalid': '{label} is invalid (invalid value{grammar.s} {grammar.verb} {values})',
      },
    };

    // Options that are later combined with ones passed into validation
    this._opts = {};
    this._valids = new Values();
    this._invalids = new Values();

    // User-defined variables that affect the outcomes of the validation.
    this.$flags = {};
  }

  static isValid(value) {
    return value != null && !!value.__SCHEMA__;
  }

  $clone() {
    // Can't use BaseSchema.prototype since define creates new prototypes
    // Therefore cloning on these newly defined schemas will not clone their methods
    // const next = Object.create(BaseSchema.prototype);
    const target = Object.create(Object.getPrototypeOf(this));

    return _assign(target, this);
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

    const target = this.$clone();

    if (src.type !== 'any') target.type = src.type;

    // Conditions
    target._conditions.push(...src._conditions);

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

    // Flags
    for (const key of Object.keys(target.$flags)) {
      const targetFlag = target.$flags[key];
      const srcFlag = src.$flags[key];
      const flagDef = target._definition.flags[key];

      // If flagDef is defined
      if (flagDef !== undefined) {
        // We look for the custom merge method defined inside the definition
        if (flagDef.merge !== undefined) {
          target.$flags[key] = flagDef.merge(targetFlag, srcFlag, key, target, src);

          continue;
        }

        // If the flag is immutable, we don't do anything
        if (flagDef.immutable) {
          if (srcFlag !== undefined) target.$flags[key] = clone(srcFlag, { recursive: false });

          continue;
        }

        // Continue with default merge
      }

      target.$flags[key] = merge(targetFlag, srcFlag, {
        customizer: (targetValue, srcValue) => {
          // If both the target and src are schema, we merge them
          if (BaseSchema.isValid(targetValue) && BaseSchema.isValid(srcValue))
            return targetValue.$merge(srcValue);

          // Same here. The second parameter won't be passed. Merge method must be defined to
          // achieve this
          if (Values.isValid(targetValue) && Values.isValid(srcValue))
            return targetValue.merge(srcValue);

          return undefined;
        },
      });
    }

    const targetDef = target._definition;
    const srcDef = src._definition;
    const def = { ...targetDef, ...srcDef };

    def.rules = { ...targetDef.rules, ...srcDef.rules };
    def.messages = { ...targetDef.messages, ...srcDef.messages };
    def.flags = { ...targetDef.flags, ...srcDef.flags };

    target._definition = def;

    // Re-register the refs
    target.$reregister();

    return target;
  }

  $setFlag(name, value, opts = {}) {
    assert(typeof name === 'string', 'The parameter name for BaseSchema.$setFlag must be a string');

    assert(isObjectLike(opts), 'The parameter opts for BaseSchema.$setFlag must be an object');

    opts = {
      clone: true,
      ...opts,
    };

    assert(
      typeof opts.clone === 'boolean',
      'The option clone for BaseSchema.$setFlag must be a boolean',
    );

    const current = this.$flags[name];
    const flagDef = this._definition.flags[name];

    if (flagDef !== undefined && flagDef.set !== undefined) {
      value = flagDef.set(current, value);
    }

    // If the flag and the value are already equal, we don't do anything
    if (equal(current, value)) return this;

    const target = opts.clone ? this.$clone() : this;

    target.$flags[name] = value;

    return target;
  }

  $register(value) {
    const isRef = Ref.isValid(value);
    const isSchema = BaseSchema.isValid(value);

    assert(
      isRef || isSchema,
      'The parameter ref for BaseSchema.$register must be an instance of Ref or BaseSchema',
    );

    if (isRef && value._ancestor !== 'context' && value._ancestor - 1 >= 0)
      this._refs.push([value._ancestor - 1, value._root]);

    if (isSchema) {
      for (const [ancestor, root] of value._refs) {
        if (ancestor - 1 >= 0) this._refs.push([ancestor - 1, root]);
      }
    }
  }

  // todo: Implement
  $reregister() {
    // Reset the refs
    this._refs = [];
  }

  $addRule(opts) {
    assert(isObjectLike(opts), 'The parameter opts for BaseSchema.$addRule must be an object');

    opts = {
      args: {},
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

    assert(isObjectLike(opts.args), 'The option args for BaseSchema.$addRule must be an object');

    const target = this.$clone();

    // Infer identifier. If method is present, use it as the identifier, otherwise use name
    opts.identifier = opts.method === undefined ? opts.name : opts.method;

    // Method is no longer needed so we delete it
    delete opts.method;

    const ruleDef = target._definition.rules[opts.identifier];

    assert(ruleDef !== undefined, 'Rule definition', opts.identifier, 'not found');

    // Param definitions
    const argDefs = ruleDef.args;

    for (const argName of Object.keys(argDefs)) {
      const { assert: argAssert, ref, reason } = argDefs[argName];
      const arg = opts.args[argName];
      const isRef = Ref.isValid(arg);

      // Params assertions
      assert(
        argAssert(arg) || (ref && isRef),
        'The parameter',
        argName,
        'of',
        `${target.type}.${opts.name}`,
        reason,
      );

      if (isRef) {
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

  define(opts) {
    assert(isObjectLike(opts), 'The parameter opts for BaseSchema.define must be an object');

    opts = {
      type: 'any',
      flags: {},
      messages: {},
      rules: {},
      ...opts,
    };

    assert(typeof opts.type === 'string', 'The option type for BaseSchema.define must be a string');

    assert(isObjectLike(opts.flags), 'The option flags for BaseSchema.define must be an object');

    assert(
      isObjectLike(opts.messages),
      'The option messages for BaseSchema.define must be an object',
    );

    ['validate', 'coerce'].forEach(optName => {
      const opt = opts[optName];

      assert(
        opt === undefined || typeof opt === 'function',
        'The option',
        optName,
        'for BaseSchema.define must be a function',
      );
    });

    assert(isObjectLike(opts.rules), 'The option rules for BaseSchema.define must be an object');

    // Clone the proto so we don't attach methods to all the instances
    // Can't use BaseSchema.prototype here either, same reason as $clone
    // const proto = clone(BaseSchema.prototype);
    const proto = clone(Object.getPrototypeOf(this));
    // Reconstruct the instance
    const next = _assign(Object.create(proto), this);

    next.type = opts.type;

    const def = next._definition;

    // Populate definition
    if (opts.validate !== undefined) def.validate = opts.validate;

    if (opts.coerce !== undefined) def.coerce = opts.coerce;

    def.messages = { ...def.messages, ...opts.messages };

    for (const key of Object.keys(opts.flags)) {
      const flag = opts.flag[key];

      // Immutable defaults to true for primitives
      flag.immutable = flag.immutable === undefined ? !isObjectLike(flag.value) : flag.immutable;

      assert(
        typeof flag.immutable === 'boolean',
        'The option immutable for flag',
        key,
        'must be a boolean',
      );

      ['clone', 'merge', 'describe', 'set'].forEach(optName => {
        const opt = flag[optName];

        assert(
          opt === undefined || typeof opt === 'function',
          'The option',
          optName,
          'for flag',
          key,
          'must be a function',
        );
      });

      next.$flags[key] = flag.value;

      delete flag.value;

      if (Object.keys(flag).length > 0) def.flags[key] = flag;
    }

    // Populate rule definitions
    for (const ruleName of Object.keys(opts.rules)) {
      let rule = opts.rules[ruleName];

      rule = {
        args: [],
        alias: [],
        single: true,
        priority: false,
        ...rule,
      };

      assert(Array.isArray(rule.args), 'The option args for rule', ruleName, 'must be an array');

      assert(
        Array.isArray(rule.alias) && rule.alias.every(alias => typeof alias === 'string'),
        'The options alias for rule',
        ruleName,
        'must be an array of strings',
      );

      ['single', 'priority'].forEach(optName => {
        const opt = rule[optName];

        assert(
          typeof opt === 'boolean',
          'The option',
          optName,
          'for rule',
          ruleName,
          'must be a boolean',
        );
      });

      assert(
        rule.validate === undefined || typeof rule.validate === 'function',
        'The option validate for rule',
        ruleName,
        'must be a function',
      );

      assert(
        rule.method === undefined || rule.method === false || typeof rule.method === 'function',
        'The option method for rule',
        ruleName,
        'must be false or a function',
      );

      // Make sure either validate or method is provided
      assert(
        typeof rule.method === 'function' || rule.validate !== undefined,
        'Either option method or option validate must be defined',
      );

      // Cannot have alias if method is false (a hidden rule)
      assert(
        rule.method !== false || rule.alias.length === 0,
        'Cannot have aliases for rule that has no method',
      );

      // If method is present, check if there's already one
      assert(
        rule.method === false || proto[ruleName] === undefined,
        'The rule',
        ruleName,
        'has already been defined',
      );

      const args = {};

      // Create arg definitions
      for (const { name: argName, ...otherOpts } of rule.args) {
        assert(
          typeof argName === 'string',
          'The option name for the argument of rule',
          ruleName,
          'must be a string',
        );

        const arg = {
          ref: true,
          ...otherOpts,
        };

        assert(
          typeof arg.ref === 'boolean',
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

      // Only add to rule definitions if the rule has the validate method defined
      if (rule.validate !== undefined) def.rules[ruleName] = rule;

      if (typeof rule.method === 'function') _attachMethod(proto, ruleName, rule.method);

      // rule.validate is defined
      if (rule.method === undefined)
        _attachMethod(proto, ruleName, function defaultMethod() {
          return this.$addRule({ name: ruleName });
        });

      for (const alias of rule.alias) {
        _attachMethod(proto, alias, proto[ruleName]);
      }
    }

    return next;
  }

  describe() {
    const desc = {};

    desc.type = this.type;

    if (this.$flags.size > 0) {
      desc.flags = {};

      for (const key of Object.keys(this.$flags)) {
        const flagDef = this._definition.flags[key];

        if (flagDef !== undefined && flagDef.describe !== undefined)
          desc.flags[key] = flagDef.describe();
        else desc.flags[key] = _describe(this.$flags[key]);
      }
    }

    if (this._conditions.length > 0)
      desc.conditions = this._conditions.map(({ ref, is, then, otherwise }) => {
        const condition = {};

        condition.ref = ref.describe();
        condition.is = is.describe();

        if (then !== undefined) condition.then = then.describe();

        if (otherwise !== undefined) condition.otherwise = otherwise.describe();

        return condition;
      });

    if (this._rules.length > 0)
      desc.rules = this._rules.map(({ name, args }) => {
        const rule = {};

        rule.name = name;
        rule.args = {};

        for (const argName of Object.keys(args)) {
          const arg = args[argName];

          rule.args[argName] = Ref.isValid(arg) ? arg.describe() : arg;
        }

        return rule;
      });

    if (Object.keys(this._opts).length > 0) desc.opts = clone(this._opts);

    if (this._valids.size > 0) desc.valids = this._valids.describe();

    if (this._invalids.size > 0) desc.invalids = this._invalids.describe();

    return desc;
  }

  annotate(note) {
    assert(typeof note === 'string', 'The parameter note for any.annotate must be a string');

    return this.$setFlag('note', note);
  }

  opts(opts) {
    const next = this.$clone();

    next._opts = { ...next._opts, ..._opts('any.opts', opts) };

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
    return _values(this, values, 'valid');
  }

  invalid(...values) {
    return _values(values, 'invalid');
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

  $validate(value, opts, state) {
    let schema = this;

    for (const { ref, is, then, otherwise } of this._conditions) {
      const result = is.$validate(ref.resolve(value, state.ancestors, opts.context), opts, state);

      if (result.errors === null) schema = schema.$merge(then);
      else schema = schema.$merge(otherwise);
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
    helpers.error = (code, local) => _createError(schema, code, state, opts.context, local);

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
        const err = helpers.error('any.invalid', {
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

    let presence = schema.$flags.presence;

    presence = presence === undefined ? 'optional' : presence;

    const isForbidden = presence === 'forbidden';

    // Required

    if (value === undefined) {
      if (presence === 'required')
        return {
          value: null,
          errors: [helpers.error('any.required')],
        };

      if (isForbidden) return { value, errors: null };

      if (presence === 'optional') {
        let defaultValue = schema.$flags.default;

        if (Ref.isValid(defaultValue))
          defaultValue = defaultValue.resolve(value, state.ancestors, opts.context);

        return { value: defaultValue, errors: null };
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

      if (coerced[_errorSymbol]) return { value: null, errors: [coerced] };

      value = coerced;
    }

    // Base check
    // Always exit early
    if (def.validate !== null) {
      const result = def.validate(value, helpers);

      if (result[_errorSymbol]) return { value: null, errors: [result] };

      value = result;
    }

    // Rules
    for (const rule of schema._rules) {
      const ruleDef = def.rules[rule.identifier];
      const args = { ...rule.args };

      let err;

      for (const argName of Object.keys(ruleDef.args)) {
        const { assert: argAssert, reason } = ruleDef.args[argName];
        const arg = args[argName];

        if (!Ref.isValid(arg)) continue;

        const resolved = arg.resolve(value, state.ancestors, opts.context);

        if (!argAssert(resolved)) {
          err = helpers.createError('any.ref', { ref: arg, reason });

          if (opts.abortEarly)
            return {
              value: null,
              errors: [err],
            };

          errors.push(err);
        } else args[argName] = resolved;
      }

      if (err !== undefined) continue;

      const result = ruleDef.validate(value, { ...helpers, args, name: rule.name });

      if (result[_errorSymbol]) {
        if (opts.abortEarly) return { value: null, errors: [result] };

        errors.push(result);
      } else value = result;
    }

    return { value, errors: errors.length === 0 ? null : errors };
  }

  validate(value, opts) {
    return this.$validate(
      value,
      { ..._const.DEFAULT_VALIDATE_OPTS, ...opts('any.validate', opts) },
      new State(),
    );
  }

  when(ref, opts) {
    assert(Ref.isValid(ref), 'The parameter ref for BaseSchema.when must be an instance of Ref');
    assert(isObjectLike(opts), 'The parameter opts for BaseSchema.when must be an object');
    assert(
      BaseSchema.isValid(opts.is),
      'The option is for BaseSchema.when must be an instance of BaseSchema',
    );
    assert(
      BaseSchema.isValid(opts.then) || BaseSchema.isValid(opts.otherwise),
      'The option then or otherwise for BaseSchema.when must be an instance of BaseSchema',
    );

    const next = this.$clone();

    next.$register(ref);

    next._conditions.push({ ref, ...opts });

    return next;
  }
}

// Wrapper that deals with refs and values
function _serialize(value) {
  if (Ref.isValid(value)) return value._display;

  if (Values.isValid(value)) return _serialize(value.values().map(_serialize));

  return serialize(value);
}

function _attachMethod(obj, key, method) {
  Object.defineProperty(obj, key, {
    value: method,
    configurable: true,
    writable: true,
  });
}

function _hasKey(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function _opts(methodName, opts = {}) {
  assert(isObjectLike(opts), 'The parameter opts for', methodName, 'must be an object');

  ['strict', 'abortEarly', 'recursive', 'allowUnknown', 'stripUnknown'].forEach(optName =>
    assert(
      _hasKey(opts, optName) || typeof opts[optName] === 'boolean',
      'The option',
      optName,
      'for',
      methodName,
      'must be a boolean',
    ),
  );

  assert(
    _hasKey(opts, 'context') || isObjectLike(opts.context),
    'The option context for',
    methodName,
    'must be an object',
  );

  return opts;
}

function _assign(target, src) {
  target.type = src.type;
  target._refs = [...src._refs];
  target._conditions = [...src._conditions];
  target._rules = [...src._rules];
  target._opts = { ...src._opts };
  target._valids = src._valids.clone();
  target._invalids = src._invalids.clone();
  target.$flags = new Map();

  for (const key of Object.keys(src.$flags)) {
    const flag = src.$flags[key];
    const flagDef = src._definition.flags[key];

    // If clone is defined on definition
    if (flagDef !== undefined) {
      if (flagDef.clone !== undefined) {
        target.$flags[key] = flagDef.clone(flag, key, src);

        continue;
      }

      if (flagDef.immutable) {
        target.$flags[key] = clone(flag, { recursive: false });

        continue;
      }
    }

    target.$flags[key] = clone(flag, {
      customizer: value => {
        if (BaseSchema.isValid(value) || Ref.isValid(value)) return value;

        if (Values.isValid(value)) return value.clone();
      },
    });
  }

  // Merge last due to flags
  const srcDef = src._definition;
  const def = { ...srcDef };

  def.messages = { ...srcDef.messages };
  def.rules = { ...srcDef.rules };
  def.flags = { ...srcDef.flags };

  target._definition = def;

  return target;
}

function _values(schema, values, type) {
  assert(values.length > 0, `At least a value must be provided to any.${type}`);

  type = `_${type}s`;

  const other = type === '_valids' ? '_invalids' : type;
  const target = schema.$clone();

  target[other].delete(...values);
  target[type].add(...values);

  return target;
}

function _createError(schema, code, state, context, local = {}) {
  assert(typeof code === 'string', 'The parameter code for report must be a string');

  assert(isObjectLike(local), 'The parameter local for report must be an object');

  // Return the error customizer if there is one
  let err = schema.$flags.error;
  let created;

  if (err !== undefined) {
    if (typeof err === 'function') {
      err = err(code, state, context, local);

      assert(
        typeof err === 'string' || err instanceof Error,
        'The error customizer function must return either a string or an instance of Error',
      );
    }

    created = new ValidationError(err instanceof Error ? err.message : err, code, state);
  } else {
    const template = schema._definition.messages[code];

    assert(template !== undefined, 'Message template', code, 'not found');

    let label = schema.$flags.label;

    if (label === undefined) {
      if (state.path !== null) label = state.path;
      else label = 'unknown';
    }

    // Reserved terms
    let message = template.replace(/{label}/g, label);

    message = message.replace(/{([\w+.]+)}/g, (_, match) => {
      const isContext = match[0] === '$';

      local = isContext ? context : local;
      match = isContext ? match.slice(1) : match;

      const found = get(local, match, { default: _defaultSymbol });

      assert(found !== _defaultSymbol, 'Term', match, 'not found');

      return _serialize(found);
    });

    created = new ValidationError(message, code, state);
  }

  // Mark this error as internally generated
  return Object.defineProperty(created, _errorSymbol, {
    value: true,
  });
}

function _describe(value) {
  if (!isObjectLike(value)) return value;

  if (Array.isArray(value)) return value.map(_describe);

  if (BaseSchema.isValid(value) || Ref.isValid(value) || Values.isValid(value))
    return value.describe();

  const desc = {};

  for (const key of Object.keys(value)) {
    desc[key] = _describe(value[key]);
  }

  return desc;
}

const _methods = [
  ['required', 'exists', 'present'],
  ['valid', 'allow', 'equal'],
  ['invalid', 'deny', 'disallow', 'not'],
  ['opts', 'options', 'prefs', 'preferences'],
  ['annotate', 'note', 'description'],
];

for (const [method, ...aliases] of _methods) {
  aliases.forEach(alias => {
    _attachMethod(BaseSchema.prototype, alias, BaseSchema.prototype[method]);
  });
}

Object.defineProperty(BaseSchema.prototype, '__SCHEMA__', { value: true });

module.exports = BaseSchema;
