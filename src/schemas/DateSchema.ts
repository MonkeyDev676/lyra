import AnySchema from './AnySchema';
import Ref from '../Ref';
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

  older(date: Date | 'now' | Ref<Date | 'now'>, message?: string) {
    this.addRule({
      deps: { date },
      type: 'older',
      message,
      validate: ({ value, deps }) => {
        let enhancedDate: Date;

        if (deps.date === 'now') enhancedDate = new Date();
        else if (!Utils.instanceOf(deps.date, Date))
          throw new LyraError('The parameter date for date.older must be an instance of Date');
        else enhancedDate = deps.date;

        return value >= enhancedDate;
      },
    });

    return this;
  }

  newer(date: Date | 'now' | Ref<Date | 'now'>, message?: string) {
    this.addRule({
      deps: { date },
      type: 'newer',
      message,
      validate: ({ value, deps }) => {
        let enhancedDate: Date;

        if (deps.date === 'now') enhancedDate = new Date();
        else if (!Utils.instanceOf(deps.date, Date))
          throw new LyraError('The parameter date for date.newer must be an instance of Date');
        else enhancedDate = deps.date;

        return value <= enhancedDate;
      },
    });

    return this;
  }
}
