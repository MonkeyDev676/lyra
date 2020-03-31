const assert = require('@botbind/dust/src/assert');
const Schema = require('./schema');
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

function compile(root, value) {
  assert(value !== undefined, 'The parameter value for compile must not be undefined');

  // If already schema, return it
  if (Schema.isSchema(value)) return value;

  // null, number, string, boolean, refs
  if (_simple(value)) return root.any().valid(value);

  // Custom rules
  if (typeof value === 'function') return root.any().rule(value);

  // Valid if all are null, number, string, boolean or refs, otherwise alternatives
  if (Array.isArray(value)) {
    for (const subValue of value) if (!_simple(subValue)) return root.alternatives().try(...value);

    return root.any().valid(...value);
  }

  // Object
  return root.object(value);
}

compile.ref = function compileRef(value) {
  return Ref.isRef(value) ? value : Ref.ref(value);
};

module.exports = compile;
