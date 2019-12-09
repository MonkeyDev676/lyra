import AnySchema from './AnySchema';
import Utils from '../Utils';

class DateSchema extends AnySchema {
  constructor() {
    super('date');
  }

  _check(value) {
    return value instanceof Date;
  }

  _coerce(value) {
    if (!Utils.isString(value)) return null;

    const timestamp = Date.parse(value);

    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp);
    }

    return value;
  }

  older(date, message) {
    return this.addRule({
      params: { date },
      type: 'older',
      message,
      pre: params => {
        if (params.date !== 'now' || !this._check(params.date))
          return 'The parameter date for date.older must be either now or an instance of Date';

        return undefined;
      },
      validate: ({ value, params }) => {
        let enhancedDate;

        if (params.date === 'now') enhancedDate = new Date();
        else enhancedDate = params.date;

        return value >= enhancedDate;
      },
    });
  }

  newer(date, message) {
    return this.addRule({
      params: { date },
      type: 'newer',
      message,
      pre: params => {
        if (params.date !== 'now' || !this._check(params.date))
          return 'The parameter date for date.newer must be either now or an instance of Date';

        return undefined;
      },
      validate: ({ value, params }) => {
        let enhancedDate;

        if (params.date === 'now') enhancedDate = new Date();
        else enhancedDate = params.date;

        return value <= enhancedDate;
      },
    });
  }
}

export default DateSchema;
