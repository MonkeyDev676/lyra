const date = require('../../schemas/date');
const utils = require('../utils');

const d = new Date('12/31/2019');
const d2 = new Date('01/01/2020');
const d3 = new Date('01/02/2020');

describe('date', () => {
  describe('Validate', () => {
    it('should validate correctly', () => {
      utils.validate(date, d, { result: d });
      utils.validate(date, 'x', { pass: false, result: { code: 'date.base' } });
      utils.validate(date, new Date(NaN), { pass: false, result: { code: 'date.base' } });
    });
  });

  describe('Coerce', () => {
    it('should coerce strings to dates', () => {
      utils.validate(date, '12/31/2019', { opts: { strict: false }, result: d });
      utils.validate(date, d.getTime(), { opts: { strict: false }, result: d });
      utils.validate(date, NaN, {
        opts: { strict: false },
        pass: false,
        result: { code: 'date.coerce' },
      });
      utils.validate(date, 'x', {
        opts: { strict: false },
        pass: false,
        result: { code: 'date.coerce' },
      });
    });
  });

  describe.each(['max', 'min', 'greater', 'smaller'])('date.%s()', method => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => date[method]()).toThrow();
      expect(() => date[method]('x')).toThrow();
      expect(() => date[method](new Date(NaN))).toThrow();
    });

    const [valid, invalid] = method === 'max' || method === 'smaller' ? [d, d3] : [d3, d];

    [d2, 'now'].forEach(input => {
      const isNow = input === 'now';
      const err = { pass: false, result: { code: `date.${method}`, lookup: { date: input } } };
      const fn = () => {
        const schema = date[method](input);

        utils.validate(schema, valid, { result: valid });
        utils.validate(schema, d2, method === 'max' || method === 'min' ? { result: d2 } : err);
        utils.validate(schema, invalid, err);
      };

      it(`should validate against ${isNow ? 'now' : 'a fixed date'}`, () => {
        if (isNow) {
          const original = Date.now;

          Date.now = () => d2.getTime();

          fn();

          Date.now = original;
        } else fn();
      });
    });
  });

  describe('Aliases', () => {
    it('date.smaller() aliases', () => {
      expect(date.smaller).toBe(date.less);
    });
  });
});
