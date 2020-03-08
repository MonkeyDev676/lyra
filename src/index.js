const assert = require('@botbind/dust/dist/assert');
const attachMethod = require('@botbind/dust/dist/attachMethod');
const BaseSchema = require('./schemas/BaseSchema');
const any = require('./schemas/any');
const boolean = require('./schemas/boolean');
const string = require('./schemas/string');
const date = require('./schemas/date');
const number = require('./schemas/number');
const array = require('./schemas/array');
const func = require('./schemas/function');
const object = require('./schemas/object');
const Ref = require('./Ref');
const Values = require('./Values');
const symbols = require('./symbols');

const root = {
  ...symbols,
  isSchema: BaseSchema.isValid,
  isRef: Ref.isValid,
  isValues: Values.isValid,
  any,
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
  define(...definitions) {
    const Lyra = { ...this };

    for (let definition of definitions) {
      assert(
        Lyra[definition.type] === undefined,
        'The option type for extend is invalid as it is built-in',
      );

      definition = {
        base: this.any,
        ...definition,
      };

      assert(
        BaseSchema.isValid(definition.base),
        'The option base for extend must be a valid schema',
      );

      const base = definition.base;

      delete definition.base;

      Lyra[definition.type] = base.define(definition);
    }

    return Lyra;
  },
  ref: (...args) => new Ref(...args),
  values: (...args) => new Values(...args),
};

for (const methodName of [
  'annotate',
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
  'note',
  'description',
  'when',
])
  attachMethod(root, methodName, function method(...args) {
    return any[methodName](...args);
  });

module.exports = root;
