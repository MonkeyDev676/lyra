const BaseSchema = require('../../schemas/BaseSchema');
const boolean = require('../../schemas/boolean');
const State = require('../../State');
const utils = require('../utils');

const state = new State();

describe('boolean', () => {
  describe('Validate', () => {
    it('should validate correctly', () => {
      utils.spy(() => boolean.validate('x'), {
        proto: BaseSchema.prototype,
        method: '$createError',
        args: ['boolean.base', state, {}, undefined],
      });

      expect(boolean.validate(true).value).toBe(true);
      expect(boolean.validate(false).value).toBe(false);
    });
  });

  describe('Coerce', () => {
    it('should coerce strings to booleans sensitively by default', () => {
      expect(boolean.validate('true', { strict: false }).value).toBe(true);
      expect(boolean.validate('false', { strict: false }).value).toBe(false);

      utils.spy(() => boolean.validate('TRuE', { strict: false }), {
        proto: BaseSchema.prototype,
        method: '$createError',
        args: ['boolean.base', state, {}, undefined],
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

  describe('boolean.truthy()', () => {
    it('should validate truthy values', () => {
      const schema = boolean.truthy();

      expect(schema.validate(true).value).toBe(true);

      utils.spy(() => schema.validate(false), {
        proto: BaseSchema.prototype,
        method: '$createError',
        args: ['boolean.truthy', state, {}, undefined],
      });
    });
  });

  describe('boolean.falsy()', () => {
    it('should validate falsy values', () => {
      const schema = boolean.falsy();

      expect(schema.validate(false).value).toBe(false);

      utils.spy(() => schema.validate(true), {
        proto: BaseSchema.prototype,
        method: '$createError',
        args: ['boolean.falsy', state, {}, undefined],
      });
    });
  });
});
