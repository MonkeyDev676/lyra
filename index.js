const L = require('./src');

console.log(
  L.obj
    .keys({
      test: L.obj.keys({
        b: L.num,
      }),
    })
    .extract('test.b.c'),
);
