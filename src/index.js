const AnySchema = require('./schemas/AnySchema');
const BooleanSchema = require('./schemas/BooleanSchema');
const StringSchema = require('./schemas/StringSchema');
const DateSchema = require('./schemas/DateSchema');
const NumberSchema = require('./schemas/NumberSchema');
const ArraySchema = require('./schemas/ArraySchema');
const FunctionSchema = require('./schemas/FunctionSchema');
const ObjectSchema = require('./schemas/ObjectSchema');
const LyraError = require('./errors/LyraError');
const LyraValidationError = require('./errors/LyraValidationError');
const Values = require('./Values');
const Utils = require('./Utils');
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

  ref(path) {
    return new Ref(path);
  },

  AnySchema,
  BooleanSchema,
  StringSchema,
  DateSchema,
  NumberSchema,
  ArraySchema,
  FunctionSchema,
  ObjectSchema,
  LyraError,
  LyraValidationError,
  Values,
  Utils,
  Ref,
};
