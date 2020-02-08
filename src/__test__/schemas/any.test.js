const any = require('../../schemas/any');

describe('any', () => {
  describe('any.custom()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => any.custom('x')).toThrow();
      expect(() => any.custom(() => {}, 1)).toThrow();
    });

    it('should validate using custom method', () => {
      const error = new Error('nope');
      const schema = any.custom((value, helpers) => {
        if (value === '1') {
          throw error;
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

      expect(schema.validate('1').errors[0].message).toBe(
        "unknown fails because validation 'custom method' throws 'Error: nope'",
      );
      expect(schema.validate('2').value).toBe('3');
      expect(schema.validate('4').errors[0].code).toBe('any.required');
      expect(schema.validate('5').value).toBe(undefined);
      expect(schema.validate('x').value).toBe('x');
    });
  });
});
