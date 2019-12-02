import L from '..';

const v = L.object({
  a: L.number()
    .min(L.ref('c'))
    .required(),
  c: L.number().min(L.ref('b.e')),
  b: L.object({
    e: L.string(),
    d: L.number().min(L.ref('c')),
    f: L.number().min(L.ref('g.h')),
    g: L.object({
      h: L.number().min(L.ref('i.j')),
    }),
  }),
  i: L.object({
    j: L.number(),
  }),
}).validate({});
