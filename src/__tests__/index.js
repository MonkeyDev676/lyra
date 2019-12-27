const L = require('..');

const schema = L.object({
  a: L.string(),
  b: L.number(),
  c: L.object({
    d: L.number().greater(L.ref('...b')),
  }).required(),
  e: L.any().when(L.ref('c.d'), {
    is: L.number().valid(2),
    then: L.boolean().default(true),
    else: L.boolean().default(false),
  }),
}).validate({
  b: 1,
  c: {
    d: 2,
  },
});

console.log(schema);
