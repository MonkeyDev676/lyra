const assert = require('@botbind/dust/src/assert');
const alternatives = require('./schemas/alternatives');
const object = require('./schemas/object');
const Any = require('./any');
const Ref = require('./ref');

function _simple(value) {
  const type = typeof value;

  return (
    value === null ||
    type === 'number' ||
    type === 'string' ||
    type === 'boolean' ||
    Ref.isRef(value)
  );
}

module.exports = function compile(value) {
  assert(value !== undefined, 'The parameter value for compile must not be undefined');

  // If already schema, return it
  if (Any.isSchema(value)) return value;

  // null, number, string, boolean, refs
  if (_simple(value)) return Any.any.valid(value);

  // Custom rules
  if (typeof value === 'function') return Any.any.rule(value);

  // Valid if all are null, number, string, boolean or refs, otherwise alternatives
  if (Array.isArray(value)) {
    for (const subValue of value) if (!_simple(subValue)) return alternatives.try(...value);

    return Any.any.valid(...value);
  }

  // Object
  return object.keys(value);
};
