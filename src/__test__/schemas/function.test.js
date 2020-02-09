const functionSchema = require('../../schemas/function');
const State = require('../../State');
const utils = require('../utils');

const proto = Object.getPrototypeOf(functionSchema);
const state = new State();

class X {}
class Y extends X {}
class Z extends Y {}

describe('function', () => {
  describe('Validate', () => {
    it('should validate correctly', () => {
      const fn = () => {};

      expect(functionSchema.validate(fn).value).toBe(fn);

      utils.spy(() => functionSchema.validate('x'), {
        proto,
        method: '$createError',
        args: ['function.base', state, {}, undefined],
      });
    });
  });

  describe('boolean.inherit()', () => {
    it("should validate a function's inheritance", () => {
      const schema = functionSchema.inherit(X);

      expect(schema.validate(Y).value).toBe(Y);

      utils.spy(() => schema.validate(() => {}), {
        proto,
        method: '$createError',
        args: ['function.inherit', state, {}, { ctor: X }],
      });
    });

    it("should validate multiple function's inheritances", () => {
      const schema = functionSchema.inherit(X).inherit(Y);

      expect(schema.validate(Z).value).toBe(Z);

      utils.spy(() => schema.validate(Y), {
        proto,
        method: '$createError',
        args: ['function.inherit', state, {}, { ctor: Y }],
      });
    });
  });
});
