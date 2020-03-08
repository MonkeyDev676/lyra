const number = require('../../schemas/number');
const utils = require('../utils');

describe('number', () => {
  describe('Validate', () => {
    it('should validate correctly', () => {
      utils.validate(number, 1, { result: 1 });
      utils.validate(number, 'x', { pass: false, result: { code: 'number.base' } });

      const maxSafeInt = Number.MAX_SAFE_INTEGER;
      const minSafeInt = Number.MIN_SAFE_INTEGER;

      utils.validate(number, maxSafeInt, { result: maxSafeInt });
      utils.validate(number, minSafeInt, { result: minSafeInt });
      utils.validate(number, maxSafeInt + 1, { pass: false, result: { code: 'number.unsafe' } });
      utils.validate(number, minSafeInt - 1, { pass: false, result: { code: 'number.unsafe' } });
      utils.validate(number, Infinity, { pass: false, result: { code: 'number.infinity' } });
      utils.validate(number, -Infinity, { pass: false, result: { code: 'number.infinity' } });
    });
  });

  describe('Coerce', () => {
    it('should only coerce strings to numbers', () => {
      utils.validate(number, '1', { result: 1, opts: { strict: false } });
      utils.validate(number, true, {
        pass: false,
        result: { code: 'number.coerce' },
        opts: { strict: false },
      });
      utils.validate(number, '1a', {
        pass: false,
        result: { code: 'number.coerce' },
        opts: { strict: false },
      });
    });

    it('should coerce any js values to numbers if specified', () => {
      const schema = number.$clone();

      schema.$flags.loose = true;

      utils.validate(schema, true, { result: 1, opts: { strict: false } });
    });
  });

  describe.each(['loose', 'unsafe'])('number.%s()', method => {
    const proto = Object.getPrototypeOf(number);

    it('should throw when incorrect parameters are passed', () => {
      expect(() => number[method]('x')).toThrow();
    });

    it(`should set the ${method} flag`, () => {
      const spy = jest.spyOn(proto, '$setFlag');

      number[method]();

      expect(utils.callWith(spy, { args: [method, true] })).toBe(true);

      spy.mockClear();

      number[method](false);

      expect(utils.callWith(spy, { args: [method, false] })).toBe(true);

      spy.mockRestore();
    });
  });

  describe('number.integer()', () => {
    it('should validate if a number is an integer', () => {
      const schema = number.integer();

      utils.validate(schema, 1, { result: 1 });
      utils.validate(schema, 1.2, { pass: false, result: { code: 'number.integer' } });
    });
  });

  describe.each(['multiple', 'divide'])('number.%s()', method => {
    it('should throw an error when incorrect parameters are passed', () => {
      expect(() => number[method]());
      expect(() => number[method]('x')).toThrow();
      expect(() => number[method](NaN)).toThrow();
    });

    const isMultiple = method === 'multiple';
    const input = isMultiple ? 5 : 10;

    it(`should validate if a number ${isMultiple ? 'is a multiple of' : 'divides'} another`, () => {
      const schema = number[method](input);

      utils.validate(schema, 5, { result: 5 });
      utils.validate(schema, 6, {
        pass: false,
        result: { code: `number.${method}`, lookup: { num: input } },
      });
    });

    const firstInput = isMultiple ? 5 : 20;
    const secondInput = isMultiple ? 2 : 30;

    it('should validate the rule multiple times', () => {
      const schema = number[method](firstInput)[method](secondInput);

      utils.validate(schema, 10, { result: 10 });
      utils.validate(schema, firstInput, {
        pass: false,
        result: { code: `number.${method}`, lookup: { num: secondInput } },
      });
      utils.validate(schema, secondInput, {
        pass: false,
        result: { code: `number.${method}`, lookup: { num: firstInput } },
      });
    });
  });

  describe.each(['max', 'min', 'greater', 'smaller'])('number.%s()', method => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => number[method]('x')).toThrow();
      expect(() => number[method](NaN)).toThrow();
    });

    const [valid, invalid] = method === 'max' || method === 'smaller' ? [4, 6] : [6, 4];
    const err = {
      pass: false,
      result: { code: `number.${method}`, lookup: { num: 5 } },
    };

    it('should compare against the specified number', () => {
      const schema = number[method](5);

      utils.validate(schema, valid, { result: valid });
      utils.validate(schema, 5, method === 'max' || method === 'min' ? { result: 5 } : err);
      utils.validate(schema, invalid, err);
    });
  });

  describe('Aliases', () => {
    it.each([
      ['smaller', 'less'],
      ['multiple', 'divisible', 'factor'],
    ])('number.%s() aliases', (methodName, ...aliases) => {
      aliases.forEach(alias => {
        expect(number[alias]).toBe(number[methodName]);
      });
    });
  });
});
