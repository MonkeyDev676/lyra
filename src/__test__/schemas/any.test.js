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

        return { value, errors: null };
      }, 'custom method');

      expect(schema.validate('2').value).toBe('3');
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

    it('should validate multiple custom methods', () => {
      const err = new Error('not a or b');
      const err2 = new Error('not x');
      const schema = any
        .custom(value => {
          if (value === 'a') return { value: 'x', errors: null };

          if (value === 'b') return { value: 'y', errors: null };

          throw err;
        }, 'custom method 1')
        .custom(value => {
          if (value === 'x') return { value: 'z', errors: null };

          throw err2;
        }, 'custom method 2');

      expect(schema.validate('a').value).toBe('z');

      utils.spy(() => schema.validate('c'), {
        proto,
        method: '$createError',
        args: ['any.custom', state, {}, { name: 'custom method 1', error: err }],
      });

      utils.spy(() => schema.validate('b'), {
        proto,
        method: '$createError',
        args: ['any.custom', state, {}, { name: 'custom method 2', error: err2 }],
      });
    });
  });
});
