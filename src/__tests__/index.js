import L from '..';

/* const schema = L.object({
  a: L.number(),
  b: L.number(),
  c: L.number(),
})
  .xor(L.ref('a'), L.ref('b'), L.ref('c'))
  .validate({});
console.log(schema); */

console.log(
  L.object({
    a: L.number(),
  })
    .when(L.ref('.'), {
      is: L.object({ a: L.number().min(10) }),
      then: L.object({
        b: L.number()
          .min(15)
          .required(),
      }),
    })
    .validate({
      a: 10,
      b: 16,
    }),
);
