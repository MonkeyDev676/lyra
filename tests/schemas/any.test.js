const any = require('../../schemas/any');
const utils = require('../utils');

describe('any', () => {
  describe('any.custom()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => any.custom('x')).toThrow();
      expect(() => any.custom(() => {}, 1)).toThrow();
    });

    it('should validate using custom method', () => {
      const err = new Error('x');
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

      utils.validate(schema, '2', { pass: true, result: '3' });
      utils.validate(schema, 'x', { pass: true, result: 'x' });
      utils.validate(schema, '1', {
        pass: false,
        result: { code: 'any.custom', lookup: { name: 'custom method', error: err } },
      });

      utils.validate(schema, '4', { pass: false, result: { code: 'any.required' } });
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

      utils.validate(schema, 'a', { pass: true, result: 'z' });
      utils.validate(schema, 'c', {
        pass: false,
        result: { code: 'any.custom', lookup: { name: 'custom method 1', error: err } },
      });
      utils.validate(schema, 'b', {
        pass: false,
        result: { code: 'any.custom', lookup: { name: 'custom method 2', error: err2 } },
      });
    });
  });
});
