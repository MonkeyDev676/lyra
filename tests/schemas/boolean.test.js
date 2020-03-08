const boolean = require('../../schemas/boolean');
const utils = require('../utils');

describe('boolean', () => {
  describe('Validate', () => {
    it('should validate correctly', () => {
      utils.validate(boolean, true, { result: true });
      utils.validate(boolean, false, { result: false });
      utils.validate(boolean, 'x', { pass: false, result: { code: 'boolean.base' } });
    });
  });

  describe('Coerce', () => {
    it('should coerce strings to booleans sensitively by default', () => {
      utils.validate(boolean, 'true', { result: true, opts: { strict: false } });
      utils.validate(boolean, 'false', { result: false, opts: { strict: false } });
      utils.validate(boolean, 'TrUE', {
        pass: false,
        result: { code: 'boolean.coerce' },
        opts: { strict: false },
      });
    });

    it('should coerce strings to booleans insensitively if specified', () => {
      const schema = boolean.$clone();

      schema.$flags.sensitive = true;

      utils.validate(schema, 'tRuE', { result: true, opts: { strict: false } });
      utils.validate(schema, 'faLSe', { result: false, opts: { strict: false } });
    });
  });

  describe('boolean.sensitive()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => boolean.sensitive('x')).toThrow();
    });

    it('should set the sensitive flag', () => {
      const spy = jest.spyOn(Object.getPrototypeOf(boolean), '$setFlag');

      boolean.sensitive();

      expect(utils.callWith(spy, { args: ['sensitive', true] })).toBe(true);

      spy.mockClear();

      boolean.sensitive(false);

      expect(utils.callWith(spy, { args: ['sensitive', false] })).toBe(true);

      spy.mockRestore();
    });
  });

  describe.each(['truthy', 'falsy'])('boolean.%s()', method => {
    const truthiness = method === 'truthy';

    it(`should validate ${method} values`, () => {
      const schema = boolean[method]();

      utils.validate(schema, truthiness, { result: truthiness });
      utils.validate(schema, !truthiness, { pass: false, result: { code: `boolean.${method}` } });
    });
  });
});
