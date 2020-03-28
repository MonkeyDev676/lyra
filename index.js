const Lyra = require('./src');

console.log(
  Lyra.object
    .keys({
      test: {
        a: Lyra.num.required(),
      },
    })
    .validate({
      test: {},
    }),
);
