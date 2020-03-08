const Dust = require('@botbind/dust');
const any = require('./any');
const _isNumber = require('../internals/_isNumber');

const _regexp = {
  // The email regex is meant to be simple. Custom implementation can use any.custom
  // Copied from https://stackoverflow.com/a/41437076/10598722
  // eslint-disable-next-line no-useless-escape
  email: /(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@[*[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+]*/,

  // Copied from https://mathiasbynens.be/demo/url-regex @stephenhay
  url: /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/,
  alphanum: /^[a-zA-Z0-9]+$/,
  num: /^[0-9]+$/,
};

module.exports = any.extend({
  type: 'string',
  flags: {
    case: null,
    trim: false,
  },
  index: {
    replace: {
      describe: ([pattern, replacement]) => ({ pattern: pattern.toString(), replacement }),
    },
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

    const casing = schema.$flags.case;

    if (casing === 'upper') value = value.toLocaleUpperCase();

    if (casing === 'lower') value.toLocaleLowerCase();

    if (schema.$flags.trim) value = value.trim();

    for (const [pattern, replacement] of schema.$index.replace)
      value = value.replace(pattern, replacement);

    return value;
  },

  validate: (value, { error }) => {
    if (typeof value !== 'string') return error('string.base');

    return value;
  },

  rules: {
    compare: {
      method: false,
      validate: (value, { args: { length, operator }, error, name }) => {
        if (Dust.compare(value.length, length, operator)) return value;

        return error(`string.${name}`, { length });
      },
      args: [
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
          args: { length, operator: '=' },
        });
      },
    },

    min: {
      method(length) {
        return this.$addRule({
          name: 'min',
          method: 'compare',
          args: { length, operator: '>=' },
        });
      },
    },

    max: {
      method(length) {
        return this.$addRule({
          name: 'max',
          method: 'compare',
          args: { length, operator: '<=' },
        });
      },
    },

    creditCard: {
      validate: (value, { error }) => {
        let i = value.length;
        let sum = 0;
        let mul = 1;

        while (i--) {
          const char = value.charAt(i) * mul;

          sum += char - (char > 9) * 9;
          // eslint-disable-next-line no-bitwise
          mul ^= 3;
        }

        if (sum > 0 && sum % 10 === 0) return value;

        return error('string.creditCard');
      },
    },

    pattern: {
      single: false,
      method(regexp) {
        return this.$addRule({ name: 'pattern', args: { regexp } });
      },
      validate: (value, { args: { regexp }, error, name }) => {
        if (regexp.test(value)) return value;

        return error(`string.${name}`, name === 'pattern' ? { regexp } : undefined);
      },
      args: [
        {
          name: 'regexp',
          assert: resolved => resolved instanceof RegExp,
          reason: 'must be a regular expression',
        },
      ],
    },

    email: {
      method() {
        return this.$addRule({ name: 'email', method: 'pattern', args: { regexp: _regexp.email } });
      },
    },

    url: {
      method() {
        return this.$addRule({ name: 'url', method: 'pattern', args: { regexp: _regexp.url } });
      },
    },

    alphanum: {
      method() {
        return this.$addRule({
          name: 'alphanum',
          method: 'pattern',
          args: { regexp: _regexp.alphanum },
        });
      },
    },

    numeric: {
      method() {
        return this.$addRule({ name: 'numeric', method: 'pattern', args: { regexp: _regexp.num } });
      },
    },

    case: {
      method: false,
      validate: (value, { args: { dir }, name, error }) => {
        if (dir === 'lower' && value.toLocaleLowerCase() === value) return { value, errors: null };

        if (value.toLocaleUpperCase() === value) return value;

        return error(`string.${name}`);
      },
    },

    uppercase: {
      method() {
        const target = this.$addRule({ name: 'uppercase', method: 'case', args: { dir: 'upper' } });

        target.$setFlag('case', 'upper', { clone: false });

        return target;
      },
    },

    lowercase: {
      method() {
        const target = this.$addRule({ name: 'lowercase', method: 'case', args: { dir: 'lower' } });

        target.$setFlag('case', 'lower', { clone: false });

        return target;
      },
    },

    trim: {
      method(enabled = true) {
        Dust.assert(
          typeof enabled === 'boolean',
          'The parameter enabled for string.trim must be a boolean',
        );

        const target = this.$addRule({ name: 'trim', args: { enabled } });

        target.$setFlag('trim', enabled);

        return target;
      },
      validate: (value, { error, args: { enabled } }) => {
        if (!enabled || value === value.trim()) return value;

        return { value: null, errors: [error('string.trim')] };
      },
    },

    replace: {
      method(pattern, replacement) {
        Dust.assert(
          pattern instanceof RegExp || typeof pattern === 'string',
          'The parameter pattern for string.replace must be an instance of RegExp or a string',
        );

        Dust.assert(
          typeof replacement === 'string',
          'The parameter replacement for string.replace must be a string',
        );

        const target = this.$clone();

        target.$index.replace.push([pattern, replacement]);

        return target;
      },
    },
  },
});
