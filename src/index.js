/* eslint-disable global-require */
const assert = require('@botbind/dust/src/assert');
const attachMethod = require('@botbind/dust/src/attachMethod');
const Any = require('./any');

const _types = {
  any: Any.any,
  alternatives: require('./schemas/alternatives'),
  boolean: require('./schemas/boolean'),
  string: require('./schemas/string'),
  date: require('./schemas/date'),
  number: require('./schemas/number'),
  array: require('./schemas/number'),
  function: require('./schemas/function'),
  object: require('./schemas/object'),
};

const root = {
  ...require('./identities'),
  ...require('./ref'),

  symbols: require('./symbols'),
  compile: require('./compile'),
  isSchema: Any.isSchema,
  _types: new Set(Object.keys(_types)),

  ..._types,

  // Methods
  attempt: (schema, value, opts) => {
    return schema.attempt(value, opts);
  },
  validate: (schema, value, opts) => {
    return schema.validate(value, opts);
  },
  extend: (...extensions) => {
    const Lyra = { ...root };

    // Clone types
    Lyra._types = new Set(Lyra._types);

    assert(extensions.length > 0, 'The parameter extensions must contain at least an extension');

    for (let extension of extensions) {
      if (typeof extension === 'function') extension = extension(Lyra);

      assert(
        Lyra[extension.type] === undefined || Lyra._types.has(extension.type),
        'Invalid extension',
        extension.type,
      );

      assert(
        extension.from === undefined || this.isSchema(extension.from),
        'The option from for extend must be a valid schema',
      );

      const from = extension.from === undefined ? Lyra.any : extension.from;

      Lyra[extension.type] = from.extend(extension);

      Lyra._types.add(extension.type);
    }

    return Lyra;
  },
};

// Aliases
for (const [type, alias] of [
  ['boolean', 'bool'],
  ['string', 'str'],
  ['alternatives', 'alt'],
  ['number', 'num'],
  ['function', 'func'],
  ['array', 'arr'],
  ['object', 'obj'],
])
  root[alias] = root[type];

// Shortcut
for (const methodName of [
  'annotate',
  'custom',
  'opts',
  'strip',
  'presence',
  'optional',
  'required',
  'forbidden',
  'default',
  'only',
  'valid',
  'invalid',
  'exists',
  'present',
  'allow',
  'equal',
  'is',
  'deny',
  'disallow',
  'not',
  'options',
  'prefs',
  'preferences',
  'when',
  'note',
  'description',
])
  attachMethod(root, methodName, function method(...args) {
    return this.any[methodName](...args);
  });

module.exports = root;
