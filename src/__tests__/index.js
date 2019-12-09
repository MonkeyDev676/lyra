import L from '..';

const a = {
  a: [1],
  b: 1,
};

console.log(
  L.object({
    a: L.array(L.number()),
    b: L.number()
      .valid(L.ref('a[1]'))
      .required(),
  }).validate(a, { abortEarly: false }),
);
