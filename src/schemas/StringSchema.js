const assert = require('@botbind/dust/src/assert');
const compare = require('@botbind/dust/src/compare');
const AnySchema = require('./AnySchema');
const _isNumber = require('../internals/_isNumber');

/* eslint-disable no-control-regex, no-useless-escape */
const emailRegex = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i;
const urlRegex = /^((https?|ftp):)?\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;
const alphanumRegex = /^[a-zA-Z0-9]+$/;
const numRegex = /^[0-9]+$/;
/* eslint-enable */

const StringSchema = AnySchema.define({
  type: 'string',
  flags: {
    case: null,
    reverse: false,
    trim: false,
    replace: null,
  },
  messages: {
    'string.base': '{label} must be a string',
    'string.coerce': '{label} cannot be coerced to a string',
    'string.length': '{label} must have {length} characters',
    'string.min': '{label} must have at least {length} characters',
    'string.max': '{label} must have at most {length} characters',
    'string.creditCard': '{label} must be a credit card',
    'string.pattern': '{label} must have a pattern of {regex}',
    'string.email': '{label} must be an email',
    'string.url': '{label} must be a URL',
    'string.alphanum': '{label} must only contain alpha-numeric characters',
    'string.numeric': '{label} must only contain numeric characters',
    'string.uppercase': '{label} must only contain uppercase characters',
    'string.lowercase': '{label} must only contain lowercase characters',
    'string.trim': '{label} must not contain leading and trailing whitespaces',
  },

  coerce({ value }) {
    return { value: String(value), errors: null };
  },

  transform({ value, schema }) {
    if (schema.$flags.case === 'upper') value = value.toLocaleUpperCase();

    if (schema.$flags.case === 'lower') value = value.toLocaleLowerCase();

    if (schema.$flags.trim) value = value.trim();

    if (schema.$flags.reverse)
      value = value
        .split('')
        .reverse()
        .join('');

    if (schema.$flags.replace !== null) {
      const [pattern, replacement] = schema.$flags.replace;

      value = value.replace(pattern, replacement);
    }

    return value;
  },

  validate({ value, helpers }) {
    if (typeof value !== 'string')
      return { value: null, errors: [helpers.createError('string.base')] };

    return { value, errors: null };
  },

  rules: {
    compare: {
      method: false,
      validate({ value, params }) {
        return compare(value.length, params.length, params.operator);
      },
      params: [
        {
          name: 'length',
          assert: _isNumber,
          reason: 'must be a number',
        },
      ],
    },

    length: {
      method(length) {
        return this.$addRule({
          name: 'length',
          method: 'compare',
          params: { length, operator: '=' },
        });
      },
    },

    min: {
      method(length) {
        return this.$addRule({
          name: 'min',
          method: 'compare',
          params: { length, operator: '>=' },
        });
      },
    },

    max: {
      method(length) {
        return this.$addRule({
          name: 'max',
          method: 'compare',
          params: { length, operator: '<=' },
        });
      },
    },

    creditCard: {
      validate({ value }) {
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
    },

    pattern: {
      method: regex => {
        return this.$addRule({ name: 'regex', params: { regex } });
      },
      validate({ value, params }) {
        return params.regex.test(value);
      },
      params: [
        {
          name: 'regex',
          assert(resolved) {
            return resolved instanceof RegExp;
          },
          reason: 'must be a regular expression',
        },
      ],
    },

    email: {
      method() {
        return this.$addRule({ name: 'email', method: 'pattern', params: { regex: emailRegex } });
      },
    },

    url: {
      method() {
        return this.$addRule({ name: 'url', method: 'pattern', params: { regex: urlRegex } });
      },
    },

    alphanum: {
      method() {
        return this.$addRule({
          name: 'alphanum',
          method: 'pattern',
          params: { regex: alphanumRegex },
        });
      },
    },

    numeric: {
      method() {
        return this.$addRule({ name: 'numeric', method: 'pattern', params: { regex: numRegex } });
      },
    },

    case: {
      method: false,
      validate({ value, params }) {
        if (params.dir === 'lower') return value.toLocaleLowerCase() === value;

        return value.toLocaleUpperCase() === value;
      },
      params: [
        {
          name: 'dir',
          assert(resolved) {
            return ['lower', 'upper'].includes(resolved);
          },
          reason: 'must be either lower or upper',
        },
      ],
    },

    uppercase: {
      method() {
        // Avoid cloning twice
        const next = this.$addRule({ name: 'uppercase', method: 'case', params: { dir: 'upper' } });

        next.$flags.case = 'upper';

        return next;
      },
    },

    lowercase: {
      method() {
        const next = this.$addRule({ name: 'lowercase', method: 'case', params: { dir: 'lower' } });

        next.$flags.case = 'lower';

        return next;
      },
    },

    trim: {
      method() {
        const next = this.$addRule({ name: 'trim' });

        next.$flags.trim = true;

        return next;
      },
      validate({ value }) {
        return value === value.trim();
      },
    },

    reverse: {
      method() {
        return this.$setFlag('reverse', true);
      },
    },

    replace: {
      method(pattern, replacement) {
        assert(
          pattern instanceof RegExp || typeof pattern === 'string',
          'The parameter pattern for string.replace must be an instance of RegExp or a string',
        );

        assert(
          typeof replacement === 'string',
          'The parameter replacement for string.replace must be a string',
        );

        return this.$setFlag('replace', [pattern, replacement]);
      },
    },
  },
});

module.exports = StringSchema;
