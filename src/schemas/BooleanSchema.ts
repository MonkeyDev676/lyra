import AnySchema from './AnySchema';
import Utils from '../Utils';

const truthyValues: unknown[] = [
  'true',
  '1',
  '+',
  'on',
  'enable',
  'enabled',
  't',
  'yes',
  'y',
  1,
  true,
];

const falsyValues: unknown[] = [
  'false',
  '0',
  '-',
  'off',
  'disable',
  'disabled',
  'f',
  'no',
  'n',
  0,
  false,
];

export default class BooleanSchema extends AnySchema<boolean> {
  constructor() {
    super('boolean');
  }

  protected check(value: unknown): value is boolean {
    return Utils.isBoolean(value);
  }

  protected coerce(value: unknown) {
    if (truthyValues.includes(value)) return true;
    if (falsyValues.includes(value)) return false;

    return null;
  }

  public truthy(message?: string) {
    this.addRule({
      type: 'truthy',
      message,
      validate: ({ value }) => value,
    });

    return this;
  }

  public falsy(message?: string) {
    this.addRule({
      type: 'truthy',
      message,
      validate: ({ value }) => !value,
    });

    return this;
  }
}
