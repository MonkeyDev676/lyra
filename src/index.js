/* eslint-disable global-require */
const assert = require('@botbind/dust/src/assert');
const attachMethod = require('@botbind/dust/src/attachMethod');
const compile = require('./compile');

const _types = {
  any: require('./schemas/any'),
  alternatives: require('./schemas/alternatives'),
  boolean: require('./schemas/boolean'),
  string: require('./schemas/string'),
  date: require('./schemas/date'),
  number: require('./schemas/number'),
  array: require('./schemas/array'),
  function: require('./schemas/function'),
  object: require('./schemas/object'),
};

function _create(schema, root, args) {
  schema.$root = root;

  // Constructor argumnets
  if (schema._definition.args !== undefined && args.length > 0)
    return schema._definition.args(schema, ...args);

  return schema;
}

const root = {
  ...require('./identities'),
  ...require('./ref'),

  symbols: require('./symbols'),
  isSchema: require('./schema').isSchema,
  _types: new Set(Object.keys(_types)),

  // Methods
  compile(value) {
    return compile(this, value);
  },
  attempt: (schema, value, opts) => {
    return schema.attempt(value, opts);
  },
  validate: (schema, value, opts) => {
    return schema.validate(value, opts);
  },
  extend(...extensions) {
    const newRoot = { ...this };

    // Clone types
    newRoot._types = new Set(newRoot._types);

    assert(extensions.length > 0, 'The parameter extensions must contain at least an extension');

    for (let extension of extensions) {
      if (typeof extension === 'function') extension = extension(newRoot);

      assert(
        newRoot[extension.type] === undefined || newRoot._types.has(extension.type),
        'Invalid extension',
        extension.type,
      );

      assert(
        extension.from === undefined || this.isSchema(extension.from),
        'The option from for extend must be a valid schema',
      );

      newRoot._types.add(extension.type);

      const from = extension.from === undefined ? newRoot.any() : extension.from;

      newRoot[extension.type] = function method(...args) {
        return _create(from.extend(extension), this, args);
      };
    }

    return newRoot;
  },
};

for (const type of root._types) {
  root[type] = function method(...args) {
    return _create(_types[type], this, args);
  };
}

for (const [type, alias] of [
  ['boolean', 'bool'],
  ['string', 'str'],
  ['alternatives', 'alt'],
  ['number', 'num'],
  ['function', 'func'],
  ['array', 'arr'],
  ['object', 'obj'],
]) {
  root[alias] = root[type];
}

// Shortcut
for (const methodName of [
  'annotate',
  'rule',
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
    return this.any()[methodName](...args);
  });

module.exports = root;
