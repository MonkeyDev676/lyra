const compare = require('@botbind/dust/dist/compare');
const BaseSchema = require('./BaseSchema');

function _isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

module.exports = new BaseSchema().define({
  type: 'date',
  messages: {
    'date.base': '{label} must be a valid date',
    'date.coerce': '{label}} cannot be coerced to a date object',
    'date.max': '{label} must be smaller than or equal to {date}',
    'date.min': '{label} must be greater than or equal to {date}',
    'date.greater': '{label} must be greater than {date}',
    'date.smaller': '{label} must be smaller than {date}',
  },

  coerce: (value, { createError }) => {
    if (typeof value === 'number') {
      value = new Date(value);

      if (_isValidDate(value)) return { value, errors: null };
    }

    if (typeof value === 'string') {
      const timestamp = Date.parse(value);

      if (!Number.isNaN(timestamp)) {
        return { value: new Date(timestamp), errors: null };
      }
    }

    return { value: null, errors: [createError('date.coerce')] };
  },

  validate: (value, { createError }) => {
    // Check for invalid dates
    if (_isValidDate(value)) return { value, errors: null };

    return { value: null, errors: [createError('date.base')] };
  },

  rules: {
    compare: {
      method: false,
      validate: (value, { params, createError, name }) => {
        let date;

        if (params.date === 'now') date = Date.now();
        else date = params.date.getTime();

        if (compare(value.getTime(), date, params.operator)) return { value, errors: null };

        return {
          value: null,
          errors: createError(`date.${name}`, { date: params.date }),
        };
      },
      params: [
        {
          name: 'date',
          assert: resolved => resolved === 'now' || resolved instanceof Date,
          reason: 'must be now or an instance of Date',
        },
      ],
    },

    min: {
      method(date) {
        return this.$addRule({
          name: 'min',
          method: 'compare',
          params: { date, operator: '>=' },
        });
      },
    },

    max: {
      method(date) {
        return this.$addRule({
          name: 'max',
          method: 'compare',
          params: { date, operator: '<=' },
        });
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
      alias: ['less'],
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
