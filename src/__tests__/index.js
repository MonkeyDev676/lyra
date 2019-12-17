import L from '..';

/* const schema = L.object({
  a: L.number(),
  b: L.number(),
  c: L.number(),
})
  .xor(L.ref('a'), L.ref('b'), L.ref('c'))
  .validate({});
console.log(schema); */

const Discord = {
  Collection: class {},
};

console.log(
  L.object({
    shouldType: L.boolean().default(false),
    prefix: L.string().default('!'),
    owners: L.array(L.string()).default([]),
    shouldEditCommandResponses: L.boolean().default(false),
    commandMessageLifetime: L.number().when(L.ref('shouldEditCommandResponses'), {
      is: L.boolean().valid(true),
      then: L.number().default(180000),
      else: L.number().default(0),
    }),
    provider: L.function()
      .inherit(Discord.Collection)
      .default(function Test() {}, { literal: true }),
  }).validate({}),
);
