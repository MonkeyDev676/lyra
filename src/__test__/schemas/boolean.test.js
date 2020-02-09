const boolean = require('../../schemas/boolean');
const State = require('../../State');
const utils = require('../utils');

const proto = Object.getPrototypeOf(boolean);
const state = new State();

describe('boolean', () => {
  describe('Validate', () => {
    it('should validate correctly', () => {
      expect(boolean.validate(true).value).toBe(true);
      expect(boolean.validate(false).value).toBe(false);

      utils.spy(() => boolean.validate('x'), {
        proto,
        method: '$createError',
        args: ['boolean.base', state, {}, undefined],
      });
    });
  });

  describe('Coerce', () => {
    it('should coerce strings to booleans sensitively by default', () => {
      expect(boolean.validate('true', { strict: false }).value).toBe(true);
      expect(boolean.validate('false', { strict: false }).value).toBe(false);

      utils.spy(() => boolean.validate('TRuE', { strict: false }), {
        proto,
        method: '$createError',
        args: ['boolean.coerce', state, {}, undefined],
      });
    });
  });

  describe('boolean.sensitive()', () => {
    it('should coerce strings to booleans insensitively if on', () => {
      const schema = boolean.sensitive();

      expect(schema.validate('tRuE', { strict: false }).value).toBe(true);
      expect(schema.validate('faLSe', { strict: false }).value).toBe(false);
    });
  });

  ['truthy', 'falsy'].forEach(method => {
    const truthiness = method === 'truthy';

    describe(`boolean.${method}()`, () => {
      it(`should validate ${method} values`, () => {
        const schema = boolean[method]();

        expect(schema.validate(truthiness).value).toBe(truthiness);

        utils.spy(() => schema.validate(!truthiness), {
          proto,
          method: '$createError',
          args: [`boolean.${method}`, state, {}, undefined],
        });
      });
    });
  });
});
