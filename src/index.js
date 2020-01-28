const AnySchema = require('./schemas/AnySchema');
const BooleanSchema = require('./schemas/BooleanSchema');
const StringSchema = require('./schemas/StringSchema');
const DateSchema = require('./schemas/DateSchema');
const NumberSchema = require('./schemas/NumberSchema');
const ArraySchema = require('./schemas/ArraySchema');
const FunctionSchema = require('./schemas/FunctionSchema');
const ObjectSchema = require('./schemas/ObjectSchema');
const Ref = require('./Ref');

module.exports = {
  any() {
    return new AnySchema();
  },

  boolean() {
    return new BooleanSchema();
  },

  string() {
    return new StringSchema();
  },

  date() {
    return new DateSchema();
  },

  number() {
    return new NumberSchema();
  },

  array(inner) {
    return new ArraySchema(inner);
  },

  function() {
    return new FunctionSchema();
  },

  object(inner) {
    return new ObjectSchema(inner);
  },

  ref(path, opts) {
    return new Ref(path, opts);
  },

  AnySchema,
  BooleanSchema,
  StringSchema,
  DateSchema,
  NumberSchema,
  ArraySchema,
  FunctionSchema,
  ObjectSchema,
  Ref,
};
