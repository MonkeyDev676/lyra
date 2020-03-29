const assert = require('@botbind/dust/src/assert');

function _simple(root, value) {
  const type = typeof value;

  return (
    value === null ||
    type === 'number' ||
    type === 'string' ||
    type === 'boolean' ||
    root.isRef(value)
  );
}

module.exports = function compile(root, value) {
  assert(value !== undefined, 'The parameter value for compile must not be undefined');

  // If already schema, return it
  if (root.isSchema(value)) return value;

  // null, number, string, boolean, refs
  if (_simple(root, value)) return root.any().valid(value);

  // Custom rules
  if (typeof value === 'function') return root.any().rule(value);

  // Valid if all are null, number, string, boolean or refs, otherwise alternatives
  if (Array.isArray(value)) {
    for (const subValue of value)
      if (!_simple(root, subValue)) return root.alternatives().try(...value);

    return root.any().valid(...value);
  }

  // Object
  return root.object(value);
};
