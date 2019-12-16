import AnySchema from './AnySchema';
import Utils from '../Utils';

/* eslint-disable no-control-regex, no-useless-escape */
const emailRegex = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i;
const urlRegex = /^((https?|ftp):)?\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;
const alphanumRegex = /^[a-zA-Z0-9]+$/;
const numRegex = /^[0-9]+$/;
/* eslint-enable */

class StringSchema extends AnySchema {
  constructor() {
    super('string', {
      'string.length': '{{label}} must have {{length}} characters',
      'string.min': '{{label}} must have at least {{length}} characters',
      'string.max': '{{label}} must have at most {{length}} characters',
      'string.creditCard': '{{label}} must be a credit card',
      'string.pattern': '{{label}} must have a pattern of {{regex}}',
      'string.email': '{{label}} must be an email',
      'string.url': '{{label}} must be a URL',
      'string.alphanum': '{{label}} must only contain alpha-numeric characters',
      'string.numeric': '{{label}} must only contain numeric characters',
    });
  }

  check(value) {
    return typeof value === 'string';
  }

  coerce(value) {
    return String(value);
  }

  length(length) {
    return this.test({
      params: {
        length: {
          value: length,
          assert: 'number',
        },
      },
      type: 'string.length',
      validate: ({ value, params }) => value.length === params.length,
    });
  }

  min(length) {
    return this.test({
      params: {
        length: {
          value: length,
          assert: 'number',
        },
      },
      type: 'string.min',
      validate: ({ value, params }) => value.length >= params.length,
    });
  }

  max(length) {
    return this.test({
      params: {
        length: {
          value: length,
          assert: 'number',
        },
      },
      type: 'string.max',
      validate: ({ value, params }) => value.length <= params.length,
    });
  }

  creditCard() {
    return this.test({
      type: 'creditCard',
      validate: ({ value }) => {
        let i = value.length;
        let sum = 0;
        let mul = 1;

        while (i--) {
          const char = value.charAt(i) * mul;

          sum += char - (char > 9) * 9;
          // eslint-disable-next-line no-bitwise
          mul ^= 3;
        }

        return sum > 0 && sum % 10 === 0;
      },
    });
  }

  pattern(regex) {
    return this._pattern(regex, 'string.pattern');
  }

  email() {
    return this._pattern(emailRegex, 'string.email');
  }

  url() {
    return this._pattern(urlRegex, 'string.url');
  }

  alphanum() {
    return this._pattern(alphanumRegex, 'string.alphanum');
  }

  numeric() {
    return this._pattern(numRegex, 'string.numeric');
  }

  _pattern(regex, type) {
    return this.test({
      params: {
        regex: {
          value: regex,
          type: resolved => [resolved instanceof RegExp, 'must be an instance of RegExp'],
        },
      },
      type,
      validate: ({ value, params }) => params.regex.test(value),
    });
  }

  uppercase() {
    return this.addTransformation(value => value.toUpperCase());
  }

  lowercase() {
    return this.addTransformation(value => value.toLowerCase());
  }

  trim() {
    return this.addTransformation(value => value.trim());
  }

  reverse() {
    return this.addTransformation(value => value.split('').reverse());
  }

  replace(pattern, replacement) {
    Utils.assert(
      pattern instanceof RegExp || typeof pattern === 'string',
      'The parameter pattern for string.replace must be an instance of RegExp or a string',
    );

    Utils.assert(
      typeof replacement === 'string',
      'The parameter replacement for string.replace must be a string',
    );

    return this.addTransformation(value => value.replace(pattern, replacement));
  }
}

export default StringSchema;
