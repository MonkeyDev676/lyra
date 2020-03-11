const Dust = require('@botbind/dust');
const alternatives = require('./schemas/alternatives');
const any = require('./schemas/any');
const boolean = require('./schemas/boolean');
const string = require('./schemas/string');
const date = require('./schemas/date');
const number = require('./schemas/number');
const array = require('./schemas/array');
const func = require('./schemas/function');
const object = require('./schemas/object');
const ref = require('./ref');
const list = require('./list');
const symbols = require('./symbols');

const root = {
  ...ref,
  ...list,
  ...any,
  symbols,
  alternatives,
  alt: alternatives,
  boolean,
  bool: boolean,
  string,
  str: string,
  date,
  number,
  num: number,
  array,
  arr: array,
  func,
  function: func,
  object,
  obj: object,
  attempt: (schema, value, opts) => {
    return schema.attempt(value, opts);
  },
  validate: (schema, value, opts) => {
    return schema.validate(value, opts);
  },
  extend(...definitions) {
    const Lyra = { ...this };

    for (let definition of definitions) {
      Dust.assert(
        Lyra[definition.type] === undefined,
        'The option type for extend is invalid as it is built-in',
      );

      definition = {
        from: this.any,
        ...definition,
      };

      Dust.assert(
        this.isSchema(definition.from),
        'The option from for extend must be a valid schema',
      );

      const from = definition.from;

      delete definition.from;

      Lyra[definition.type] = from.extend(definition);
    }

    return Lyra;
  },
};

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
  Dust.attachMethod(root, methodName, function method(...args) {
    return any[methodName](...args);
  });

module.exports = root;
