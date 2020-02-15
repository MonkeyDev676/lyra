const assert = require('@botbind/dust/dist/assert');
const compare = require('@botbind/dust/dist/compare');
const BaseSchema = require('./BaseSchema');
const _isNumber = require('../internals/_isNumber');

/* eslint-disable no-control-regex, no-useless-escape */
// The email regex is meant to be simple. Custom implementation can use any.custom
// Copied from https://stackoverflow.com/a/41437076/10598722
const emailRegex = /(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@[*[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+]*/;
// Copied from https://mathiasbynens.be/demo/url-regex @stephenhay
const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/;
const alphanumRegex = /^[a-zA-Z0-9]+$/;
const numRegex = /^[0-9]+$/;
/* eslint-enable */

module.exports = new BaseSchema().define({
  type: 'string',
  flags: {
    replace: null,
  },
  messages: {
    'string.base': '{label} must be a string',
    'string.length': '{label} must have {length} characters',
    'string.min': '{label} must have at least {length} characters',
    'string.max': '{label} must have at most {length} characters',
    'string.creditCard': '{label} must be a credit card',
    'string.pattern': '{label} must have a pattern of {regexp}',
    'string.email': '{label} must be an email',
    'string.url': '{label} must be a URL',
    'string.alphanum': '{label} must only contain alpha-numeric characters',
    'string.numeric': '{label} must only contain numeric characters',
    'string.uppercase': '{label} must only contain uppercase characters',
    'string.lowercase': '{label} must only contain lowercase characters',
    'string.trim': '{label} must not contain leading and trailing whitespaces',
  },

  coerce: (value, { schema }) => {
    value = String(value);

    const casing = schema.$getRule({ identifier: 'case' });

    if (casing)
      value = casing.params.dir === 'upper' ? value.toLocaleUpperCase() : value.toLocaleLowerCase();

    const trim = schema.$getRule({ identifier: 'trim' });

    if (trim && trim.params.enabled) value = value.trim();

    if (schema.$flags.replace !== null) {
      const [pattern, replacement] = schema.$flags.replace;

      value = value.replace(pattern, replacement);
    }

    return { value, errors: null };
  },

  validate: (value, { createError }) => {
    if (typeof value !== 'string') return { value: null, errors: [createError('string.base')] };

    return { value, errors: null };
  },

  rules: {
    compare: {
      method: false,
      validate: (value, { params, createError, name }) => {
        if (compare(value.length, params.length, params.operator)) return { value, errors: null };

        return { value: null, errors: [createError(`string.${name}`, { length: params.length })] };
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
      validate: (value, { createError }) => {
        let i = value.length;
        let sum = 0;
        let mul = 1;

        while (i--) {
          const char = value.charAt(i) * mul;

          sum += char - (char > 9) * 9;
          // eslint-disable-next-line no-bitwise
          mul ^= 3;
        }

        if (sum > 0 && sum % 10 === 0) return { value, errors: null };

        return { value: null, errors: [createError('string.creditCard')] };
      },
    },

    pattern: {
      single: false,
      method(regexp) {
        return this.$addRule({ name: 'pattern', params: { regexp } });
      },
      validate: (value, { params, createError, name }) => {
        if (params.regexp.test(value)) return { value, errors: null };

        return {
          value: null,
          errors: [
            createError(
              `string.${name}`,
              name === 'pattern' ? { regexp: params.regexp } : undefined,
            ),
          ],
        };
      },
      params: [
        {
          name: 'regexp',
          assert: resolved => resolved instanceof RegExp,
          reason: 'must be a regular expression',
        },
      ],
    },

    email: {
      method() {
        return this.$addRule({ name: 'email', method: 'pattern', params: { regexp: emailRegex } });
      },
    },

    url: {
      method() {
        return this.$addRule({ name: 'url', method: 'pattern', params: { regexp: urlRegex } });
      },
    },

    alphanum: {
      method() {
        return this.$addRule({
          name: 'alphanum',
          method: 'pattern',
          params: { regexp: alphanumRegex },
        });
      },
    },

    numeric: {
      method() {
        return this.$addRule({ name: 'numeric', method: 'pattern', params: { regexp: numRegex } });
      },
    },

    case: {
      method: false,
      validate: (value, { params, name, createError }) => {
        if (params.dir === 'lower' && value.toLocaleLowerCase() === value)
          return { value, errors: null };

        if (value.toLocaleUpperCase() === value) return { value, errors: null };

        return { value: null, errors: [createError(`string.${name}`)] };
      },
    },

    uppercase: {
      method() {
        return this.$addRule({ name: 'uppercase', method: 'case', params: { dir: 'upper' } });
      },
    },

    lowercase: {
      method() {
        return this.$addRule({ name: 'lowercase', method: 'case', params: { dir: 'lower' } });
      },
    },

    trim: {
      method(enabled = true) {
        assert(
          typeof enabled === 'boolean',
          'The parameter enabled for string.trim must be a boolean',
        );

        return this.$addRule({ name: 'trim', params: { enabled } });
      },
      validate: (value, { createError, params }) => {
        if (!params.enabled || value === value.trim()) return { value, errors: null };

        return { value: null, errors: [createError('string.trim')] };
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
