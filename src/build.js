const assert = require('@botbind/dust/src/assert');
const isPlainObject = require('@botbind/dust/src/isPlainObject');

module.exports = function build(root, desc) {
  assert(isPlainObject(desc), 'The parameter desc for build must be a plain object');

  assert(typeof desc.type === 'string', 'The option type for build must be a string');

  assert(desc.flags === undefined || isPlainObject(desc.flags), 'The option');

  assert(root._types.has(desc.type), 'Type is invalid');

  const schema = root[desc.type];

  for (const key of Object.keys(desc.flags)) {
  }

  return schema;
};
