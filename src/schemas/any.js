const Dust = require('@botbind/dust');
const { base } = require('./base');

module.exports = base().extend({
  messages: {
    'any.custom': "{label} fails because validation '{name}' throws '{error}'",
  },
  index: {
    notes: {},
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
          return error('any.custom', { error: err, name });
        }
      },
      args: [
        {
          name: 'method',
          assert: resolved => typeof resolved === 'function',
          reason: 'must be a function',
          ref: false,
        },
        {
          name: 'name',
          assert: resolved => typeof resolved === 'string',
          reason: 'must be a string',
          ref: false,
        },
      ],
    },
  },
});
