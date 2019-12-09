const L = require('./dist').default;

const a = {
  a: 1,
  c: 1,
  b: {
    e: '1',
    d: 1,
    f: 2,
    g: {
      h: 2,
    },
    c: 0,
  },
};

console.log(
  L.object({
    a: L.number()
      .min(L.ref('c'))
      .required(),
    c: L.number().min(L.ref('b.e')),
    b: L.object({
      e: L.number(),
      d: L.number().min(L.ref('.c')),
      f: L.number().min(L.ref('.g.h')),
      g: L.object({
        h: L.number().min(L.ref('....i.j')),
      }),
    }),
    i: L.object({
      j: L.number().default(2),
    }),
  }).validate(a, {
    abortEarly: false,
    strict: false,
  }),
);
