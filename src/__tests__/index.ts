import L from '..';

const result = L.array(L.number().required()).validate([1, 'a', new Date()], {
  abortEarly: false,
  recursive: false,
});

console.log(result);
