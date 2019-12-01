import L from '..';

const { value, errors } = L.object({
  a: L.number().required(),
  b: L.object({
    c: L.string(),
    d: L.number(),
  }),
}).validate({
  a: '1',
});

console.log(value, errors);
