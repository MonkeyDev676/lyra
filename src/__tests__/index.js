import L from '..';

const a = {
  a: 1,
  c: 1,
  b: {
    e: 1,
    d: 1,
    f: 2,
    g: {
      h: 2,
    },
  },
  i: {
    j: 2,
  },
};

console.log(
  L.object({
    a: L.number()
      .min(L.ref('c'))
      .required()
      .strip(),
    c: L.number().min(L.ref('b.e')),
    b: L.object({
      e: L.number(),
      d: L.number()
        .min(L.ref('e'))
        .max(L.ref('f')),
      f: L.number().min(L.ref('g.h')),
      g: L.object({
        h: L.number().min(L.ref('....i.j')),
      }),
    }),
    i: L.object({
      j: L.number().min(L.ref('...test')),
    }),
    test: L.number(),
  }).validate(a, { abortEarly: false }),
);
