const assert = require('@botbind/dust/src/assert');
const any = require('./any');

module.exports = any.extend({
  type: 'alternatives',
  flags: {
    mode: 'any',
  },
  index: {
    items: {},
  },
  messages: {
    'alternatives.any': '{#label} must match at least one of the provided schemas',
    'alternatives.one': '{#label} must not match more than one of the provided schemas',
    'alternatives.all': '{#label} must match all of the provided schemas',
  },

  validate: (value, { schema, opts, state, error }) => {
    let matches = 0;
    let matched;

    const items = schema.$index.items;

    for (const item of items) {
      const result = item.$validate(value, opts, state);

      if (result.errors !== null) continue;

      matches++;
      matched = result.value;
    }

    const mode = schema.$getFlag('mode');

    if (mode === 'any' && matches === 0) return error('alternatives.any');

    if (mode === 'one' && matches !== 1) return error('alternatives.one');

    if (mode === 'all' && matches !== items.length) return error('alternatives.all');

    return matched;
  },

  rules: {
    try: {
      method(...items) {
        assert(items.length > 0, 'At least an item must be provided to alternatives.try');

        const target = this.$clone();

        for (const item of items) target.$index.items.push(this.$root.compile(item));

        return target.$rebuild();
      },
    },

    mode: {
      alias: ['match'],
      method(mode) {
        assert(
          mode === 'all' || mode === 'one' || mode === 'any',
          'The parameter mode for alternatives.mode must be all, one or any',
        );

        return this.$setFlag('mode', mode);
      },
    },
  },
});
