const equal = require('@botbind/dust/src/equal');
const date = require('../../schemas/date');
const State = require('../../State');
const utils = require('../utils');

const proto = Object.getPrototypeOf(date);
const state = new State();
const d = new Date('12/31/2019');
const d2 = new Date('01/01/2020');
const d3 = new Date('01/02/2020');

describe('date', () => {
  describe('Validate', () => {
    it('should validate correctly', () => {
      expect(date.validate(d).value).toBe(d);

      utils.spy(() => date.validate('x'), {
        proto,
        method: '$createError',
        args: ['date.base', state, {}, undefined],
      });

      utils.spy(() => date.validate(new Date(NaN)), {
        proto,
        method: '$createError',
        args: ['date.base', state, {}, undefined],
      });
    });
  });

  describe('Coerce', () => {
    it('should coerce strings to dates', () => {
      expect(equal(date.validate('12/31/2019', { strict: false }).value, d)).toBe(true);
      expect(equal(date.validate(d.getTime(), { strict: false }).value, d)).toBe(true);

      utils.spy(() => date.validate('x', { strict: false }), {
        proto,
        method: '$createError',
        args: ['date.coerce', state, {}, undefined],
      });

      utils.spy(() => date.validate(Infinity, { strict: false }), {
        proto,
        method: '$createError',
        args: ['date.coerce', state, {}, undefined],
      });
    });
  });

  ['max', 'min', 'greater', 'smaller'].forEach(method => {
    const [valid, invalid] = method === 'max' || method === 'smaller' ? [d, d3] : [d3, d];

    describe(`date.${method}()`, () => {
      [d2, 'now'].forEach(input => {
        const isNow = input === 'now';

        it(`should validate against ${isNow ? 'now' : 'a fixed date'}`, () => {
          if (isNow) {
            const original = Date.now;

            Date.now = () => d2.getTime();

            Date.now.restore = () => {
              Date.now = original;
            };
          }

          const schema = date[method](input);

          expect(schema.validate(valid).value).toBe(valid);

          if (method === 'max' || method === 'min') expect(schema.validate(d2).value).toBe(d2);

          if (method === 'greater' || method === 'smaller')
            utils.spy(() => schema.validate(d2), {
              proto,
              method: '$createError',
              args: [`date.${method}`, state, {}, { date: input }],
            });

          utils.spy(() => schema.validate(invalid), {
            proto,
            method: '$createError',
            args: [`date.${method}`, state, {}, { date: input }],
          });

          if (isNow) Date.now.restore();
        });
      });
    });
  });

  describe('Aliases', () => {
    it('date.smaller() aliases', () => {
      expect(date.smaller).toBe(date.less);
    });
  });
});
