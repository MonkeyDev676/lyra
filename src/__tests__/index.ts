import L from '..';

const result = L.array(L.array(L.number().required()).required()).validate([[1, 'a']]);

console.log(result);
