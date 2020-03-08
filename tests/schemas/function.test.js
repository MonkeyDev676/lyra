const functionSchema = require('../../schemas/function');
const utils = require('../utils');

describe('function', () => {
  describe('Validate', () => {
    it('should validate correctly', () => {
      const fn = () => {};

      utils.validate(functionSchema, fn, { result: fn });
      utils.validate(functionSchema, 'x', { pass: false, result: { code: 'function.base' } });
    });
  });

  describe('boolean.inherit()', () => {
    class X {}
    class Y extends X {}
    class Z extends Y {}

    it("should validate a function's inheritance", () => {
      const schema = functionSchema.inherit(X);

      utils.validate(schema, Y, { result: Y });
      utils.validate(schema, () => {}, {
        pass: false,
        result: { code: 'function.inherit', lookup: { ctor: X } },
      });
    });

    it("should validate multiple function's inheritances", () => {
      const schema = functionSchema.inherit(X).inherit(Y);

      utils.validate(schema, Z, { result: Z });
      utils.validate(schema, Y, {
        pass: false,
        result: { code: 'function.inherit', lookup: { ctor: Y } },
      });
    });
  });
});
