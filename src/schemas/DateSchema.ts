import AnySchema from './AnySchema';
import Utils from '../Utils';
import LyraError from '../errors/LyraError';

export default class DateSchema extends AnySchema<Date> {
  constructor() {
    super('date');
  }

  protected check(value: unknown): value is Date {
    return Utils.instanceOf(value, Date);
  }

  protected coerce(value: string) {
    const timestamp = Date.parse(value);

    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp);
    }

    return null;
  }

  older(date: Date | 'now', message?: string) {
    this.addRule({
      type: 'older',
      message,
      validate: ({ value }) => {
        let enhancedDate: Date;

        if (date === 'now') enhancedDate = new Date();
        else if (!this.check(date))
          throw new LyraError('The parameter date for date.older must be an instance of Date');
        else enhancedDate = date;

        return value >= enhancedDate;
      },
    });

    return this;
  }

  newer(date: Date | string, message?: string) {
    this.addRule({
      type: 'newer',
      message,
      validate: ({ value }) => {
        let enhancedDate: Date;

        if (date === 'now') enhancedDate = new Date();
        else if (!this.check(date))
          throw new LyraError('The parameter date for date.newer must be an instance of Date');
        else enhancedDate = date;

        return value <= enhancedDate;
      },
    });

    return this;
  }
}
