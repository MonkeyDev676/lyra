const any = require('../../schemas/any');
const State = require('../../State');
const utils = require('../utils');

const proto = Object.getPrototypeOf(any);
const state = new State();

describe('any', () => {
  describe('any.custom()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => any.custom('x')).toThrow();
      expect(() => any.custom(() => {}, 1)).toThrow();
    });

    it('should validate using custom method', () => {
      const err = new Error('nope');
      const schema = any.custom((value, helpers) => {
        if (value === '1') {
          throw err;
        }

        if (value === '2') {
          return { value: '3', errors: null };
        }

        if (value === '4') {
          return { value: null, errors: [helpers.createError('any.required')] };
        }

        if (value === '5') {
          return { value: undefined, errors: null };
        }

        return { value, errors: null };
      }, 'custom method');

      expect(schema.validate('2').value).toBe('3');
      expect(schema.validate('5').value).toBe(undefined);
      expect(schema.validate('x').value).toBe('x');

      utils.spy(() => schema.validate('1'), {
        proto,
        method: '$createError',
        args: ['any.custom', state, {}, { name: 'custom method', error: err }],
      });

      utils.spy(() => schema.validate('4'), {
        proto,
        method: '$createError',
        args: ['any.required', state, {}, undefined],
      });
    });
  });
});
