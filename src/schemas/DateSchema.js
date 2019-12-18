import AnySchema from './AnySchema';

class DateSchema extends AnySchema {
  constructor() {
    super('date', {
      'date.older': '{{label}} must be older than {{date}}',
      'date.newer': '{{label}} must be newer than {{date}}',
    });
  }

  check(value) {
    return value instanceof Date && !Number.isNaN(value);
  }

  coerce(value, state, context) {
    if (typeof value !== 'string')
      return { value: null, errors: [this.error('any.coerce', state, context)] };

    const timestamp = Date.parse(value);

    if (!Number.isNaN(timestamp)) {
      return { value: new Date(timestamp), errors: null };
    }

    return { value: null, errors: [this.error('any.coerce', state, context)] };
  }

  older(date) {
    return this.test({
      params: {
        date: {
          value: date,
          assert: resolved => [
            resolved === 'now' || resolved instanceof Date,
            'must be now or an instance of Date',
          ],
        },
      },
      type: 'date.older',
      validate: ({ value, params }) => {
        let enhancedDate;

        if (params.date === 'now') enhancedDate = new Date();
        else enhancedDate = params.date;

        return value <= enhancedDate;
      },
    });
  }

  newer(date) {
    return this.test({
      params: {
        date: {
          value: date,
          assert: resolved => [
            resolved === 'now' || resolved instanceof Date,
            'must be now or an instance of Date',
          ],
        },
      },
      type: 'date.newer',
      validate: ({ value, params }) => {
        let enhancedDate;

        if (params.date === 'now') enhancedDate = new Date();
        else enhancedDate = params.date;

        return value >= enhancedDate;
      },
    });
  }
}

export default DateSchema;
