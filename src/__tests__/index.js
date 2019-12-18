import L from '..';

const schema = L.object({
  a: L.number(),
  b: L.number(),
  c: L.number(),
})
  .and(L.ref('.a'), L.ref('.b'), L.ref('.c'))
  .min(L.ref('.a'))
  .validate({
    a: 1,
    b: 1,
    c: 0,
  });
console.log(schema);

console.log(
  L.array(L.number().default(2))
    .min(L.ref('.[0]'))
    .validate([3, 1, undefined]),
);
