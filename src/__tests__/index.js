import L from '..';

const schema = L.string()
  .valid('abc')
  .length(4)
  .min(4)
  .validate('', { abortEarly: false });
console.log(schema);
