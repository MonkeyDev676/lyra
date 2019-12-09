import AnySchema from './AnySchema';
import Utils from '../Utils';

/* eslint-disable no-control-regex, no-useless-escape */
const emailRegex = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i;
const urlRegex = /^((https?|ftp):)?\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;
/* eslint-enable */

class StringSchema extends AnySchema {
  constructor() {
    super('string');
  }

  _check(value) {
    return Utils.isString(value);
  }

  _coerce(value) {
    return String(value);
  }

  length(length, message) {
    return this.addRule({
      params: { length },
      type: 'length',
      message,
      pre: params => {
        if (!Utils.isNumber(params.length))
          return ['The parameter length for string.length must be a number', 'length'];

        return undefined;
      },
      validate: ({ value, params }) => value.length === params.length,
    });
  }

  min(length, message) {
    return this.addRule({
      params: { length },
      type: 'min',
      message,
      pre: params => {
        if (!Utils.isNumber(params.length))
          return ['The parameter length for string.min must be a number', 'length'];

        return undefined;
      },
      validate: ({ value, params }) => value.length >= params.length,
    });
  }

  max(length, message) {
    return this.addRule({
      params: { length },
      type: 'max',
      message,
      pre: params => {
        if (!Utils.isNumber(params.length))
          return ['The parameter length for string.max must be a number', 'length'];

        return undefined;
      },
      validate: ({ value, params }) => value.length <= params.length,
    });
  }

  test(regex, message) {
    return this._test(regex, 'test', message);
  }

  email(message) {
    return this._test(emailRegex, 'email', message);
  }

  url(message) {
    return this._test(urlRegex, 'url', message);
  }

  _test(regex, type, message) {
    return this.addRule({
      params: {
        regex: { regex },
      },
      type,
      message,
      pre: params => {
        if (!Utils.isNumber(params.regex))
          return [`The parameter regex for string.${type} must be a number`, 'regex'];

        return undefined;
      },
      validate: ({ value, params }) => params.regex.test(value),
    });
  }

  uppercase() {
    return this.addTransformation({
      transform: value => value.toUpperCase(),
    });
  }

  lowercase() {
    return this.addTransformation({
      transform: value => value.toLowerCase(),
    });
  }

  trim() {
    return this.addTransformation({
      transform: value => value.trim(),
    });
  }

  reverse() {
    return this.addTransformation({
      transform: value => value.split('').reverse(),
    });
  }

  replace(pattern, replacement) {
    return this.addTransformation({
      pre: () => {
        if (!(pattern instanceof RegExp) || !Utils.isString(pattern))
          return 'The parameter pattern for string.replace must be an instance of RegExp or a string';

        if (!Utils.isString(replacement))
          return 'The parameter replacement for string.replace must be a string';

        return undefined;
      },
      transform: value => value.replace(pattern, replacement),
    });
  }
}

export default StringSchema;
