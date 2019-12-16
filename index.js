const L = require('./dist').default;

const schema = L.object({
  username: L.string()
    .alphanum()
    .min(3)
    .max(30)
    .required(),

  password: L.string()
    .test(/^[a-zA-Z0-9]{3,30}$/)
    .required()
    .strip(),

  repeat_password: L.string()
    .valid(L.ref('password'))
    .strip(),

  birth_year: L.number()
    .integer()
    .min(1900)
    .max(2013)
    .required(),

  email: L.string()
    .email()
    .required(),
});
const now = new Date();
const result = schema.validate({
  username: 'abc',
  birth_year: 1994,
  password: '123',
  repeat_password: '123',
  email: 'brianle1301@gmail.com',
});
const time = new Date() - now;

console.log(time);
