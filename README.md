# Lyra

![BotBind's logo](https://botbind.com/images/logoBB.png)

## What is Lya?

Lyra is a robust and powerful data validator. It uses a human-readable language that is heavily inspired by [@hapi/joi](https://github.com/hapi/joi) to compose re-usable complex data validator.

If you are using Lyra for your Discord bot, check out [Nebula](https://github.com/botbind/nebula) and [BotBind](https://botbind.com/).

## Installation

Lyra is available on npm:

```bash
npm install @botbind/lyra
```

## Usage

All documented APIs are accessible under the `Lyra` namespace:

```js
const Lyra = require('@botbind/lyra');

const schema = Lyra.obj
  .keys({
    username: Lyra.str
      .min(5)
      .max(30)
      .required(),
    email: Lyra.str.email().required(),
    dob: Lyra.date.max('now').required(),
    password: Lyra.str
      .min(6)
      .max(30)
      .required(),
  })
  .required();

schema.validate({
  username: 'BotBind',
  email: 'example@botbind.com',
  dob: '01/01/2020',
  password: 'BotbindIsAwesome',
});
```

Any modules under internals should not be imported as they are considered private and not documented.
