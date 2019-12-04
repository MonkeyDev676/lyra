import L from '..';

const a = {
  a: -9,
  c: 0,
  b: {
    e: '1',
    d: -1,
    f: 1,
    g: {
      h: 1,
    },
  },
};

const v = L.object({
  a: L.number()
    .min(L.ref('c'))
    .required(),
  c: L.number().min(L.ref('b.e')),
  b: L.object({
    e: L.number(),
    d: L.number().min(L.ref('c')),
    f: L.number().min(L.ref('b.g.h')),
    g: L.object({
      h: L.number().min(L.ref('i.j')),
    }),
  }),
  i: L.object({
    j: L.number().default(2),
  }),
}).validate(a, {
  abortEarly: false,
  strict: false,
});

console.log(v);

/**
 * Schema {
 * a
 * b {
 *  c
 *  d
 * }
 * }
 *
 * Actual value {
 * a
 * }
 */
