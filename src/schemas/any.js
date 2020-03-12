const Dust = require('@botbind/dust');
const Base = require('../base');

module.exports = Base.base().extend({
  flags: {
    strip: false,
  },
  index: {
    notes: [],
  },
  messages: {
    'any.custom': '{label} fails validation {name} due to {err}',
  },

  rules: {
    annotate: {
      alias: ['description', 'note'],
      method(...notes) {
        Dust.assert(
          notes.length > 0,
          'The parameter notes for any.annotate must have at least a note',
        );

        Dust.assert(
          notes.every(note => typeof note === 'string'),
          'The paramater notes for any.annotate must be an array of strings',
        );

        const target = this.$clone();

        target.$index.notes.push(...notes);

        return target;
      },
    },

    custom: {
      single: false,
      method(method, name = 'unknown') {
        return this.$addRule({ name: 'custom', args: { method, name } });
      },
      validate: (value, helpers) => {
        const {
          args: { method, name },
          error,
        } = helpers;

        try {
          return method(value, helpers);
        } catch (err) {
          return error('any.custom', { err, name });
        }
      },
      args: {
        method: {
          assert: arg => typeof arg === 'function',
          reason: 'must be a function',
        },
        name: {
          assert: arg => typeof arg === 'string',
          reason: 'must be a string',
        },
      },
    },

    strip: {
      method(enabled = true) {
        Dust.assert(
          typeof enabled === 'boolean',
          'The parameter enabled for any.strip must be a boolean',
        );

        return this.$setFlag('strip', enabled);
      },
    },
  },
});
