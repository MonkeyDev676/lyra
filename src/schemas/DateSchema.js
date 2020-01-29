const compare = require('@botbind/dust/src/compare');
const AnySchema = require('./AnySchema');

const DateSchema = new AnySchema().define({
  type: 'date',
  messages: {
    'date.base': '{label} must be a valid date',
    'date.coerce': '{label}} cannot be coerced to a JS date object',
    'date.max': '{label} must be smaller than or equal to {date}',
    'date.min': '{label} must be greater than or equal to {date}',
    'date.greater': '{label} must be greater than {date}',
    'date.smaller': '{label} must be smaller than {date}',
  },

  coerce({ value, createError }) {
    if (typeof value !== 'string') return { value: null, errors: [createError('date.coerce')] };

    const timestamp = Date.parse(value);

    if (!Number.isNaN(timestamp)) {
      return { value: new Date(timestamp), errors: null };
    }

    return { value: null, errors: [createError('date.coerce')] };
  },

  validate({ value, createError }) {
    // Check for invalid dates
    if (!(value instanceof Date) || Number.isNaN(value.getTime()))
      return { value: null, errors: [createError('date.base')] };

    return { value, errors: null };
  },

  rules: {
    compare: {
      method: false,
      validate({ value, params }) {
        let date;

        if (params.date === 'now') date = new Date();
        else date = params.date.getTime();

        return compare(value.getTime(), date, params.operator);
      },
      params: [
        {
          name: 'date',
          assert(resolved) {
            return resolved === 'now' || resolved instanceof Date;
          },
          reason: 'must be now or an instance of Date',
        },
      ],
    },

    min: {
      method(date) {
        return this.$addRule({ name: 'min', method: 'compare', params: { date, operator: '>=' } });
      },
    },

    max: {
      method(date) {
        return this.$addRule({ name: 'max', method: 'compare', params: { date, operator: '<=' } });
      },
    },

    greater: {
      method(date) {
        return this.$addRule({
          name: 'greater',
          method: 'compare',
          params: { date, operator: '>' },
        });
      },
    },

    smaller: {
      method(date) {
        return this.$addRule({
          name: 'smaller',
          method: 'compare',
          params: { date, operator: '<' },
        });
      },
    },
  },
});

module.exports = DateSchema;
