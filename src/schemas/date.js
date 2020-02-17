const compare = require('@botbind/dust/dist/compare');
const any = require('./any');

function _isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

module.exports = any.define({
  type: 'date',
  messages: {
    'date.base': '{label} must be a valid date',
    'date.coerce': '{label}} cannot be coerced to a date object',
    'date.max': '{label} must be smaller than or equal to {date}',
    'date.min': '{label} must be greater than or equal to {date}',
    'date.greater': '{label} must be greater than {date}',
    'date.smaller': '{label} must be smaller than {date}',
  },

  coerce: (value, { error }) => {
    if (typeof value === 'number') {
      value = new Date(value);

      if (_isValidDate(value)) return value;
    }

    if (typeof value === 'string') {
      const timestamp = Date.parse(value);

      if (!Number.isNaN(timestamp)) {
        return new Date(timestamp);
      }
    }

    return error('date.coerce');
  },

  validate: (value, { error }) => {
    // Check for invalid dates
    if (_isValidDate(value)) return value;

    return error('date.base');
  },

  rules: {
    compare: {
      method: false,
      validate: (value, { args: { date, operator }, error, name }) => {
        let compareDate;

        if (date === 'now') compareDate = Date.now();
        else compareDate = date.getTime();

        if (compare(value.getTime(), compareDate, operator)) return value;

        return error(`date.${name}`, { date });
      },
      args: [
        {
          name: 'date',
          assert: resolved => resolved === 'now' || _isValidDate(resolved),
          reason: 'must be now or an instance of Date',
        },
      ],
    },

    min: {
      method(date) {
        return this.$addRule({
          name: 'min',
          method: 'compare',
          args: { date, operator: '>=' },
        });
      },
    },

    max: {
      method(date) {
        return this.$addRule({
          name: 'max',
          method: 'compare',
          args: { date, operator: '<=' },
        });
      },
    },

    greater: {
      method(date) {
        return this.$addRule({
          name: 'greater',
          method: 'compare',
          args: { date, operator: '>' },
        });
      },
    },

    smaller: {
      alias: ['less'],
      method(date) {
        return this.$addRule({
          name: 'smaller',
          method: 'compare',
          args: { date, operator: '<' },
        });
      },
    },
  },
});
