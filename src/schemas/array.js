const Dust = require('@botbind/dust');
const { any, isSchema } = require('./any');
const _isNumber = require('../internals/_isNumber');

module.exports = any.extend({
  type: 'array',
  index: {
    ordereds: {},
    items: {},
    _requireds: {},
    _forbiddens: {},
    _optionals: {},
  },
  flags: {
    sparse: false,
  },
  messages: {
    'array.base': '{label} must be an array',
    'array.coerce': '{label} cannot be coerced to an array due to {err}',
    'array.sparse': '{label} must not be a sparse array item',
    'array.forbidden': "{label} has a forbidden item '{item}'",
    'array.required': '{label} does not match any of the allowed types',
    'array.requiredBoth':
      '{label} does not have {knownMisses} and {unknownMisses} other required value{grammar.s}',
    'array.requiredKnowns': '{label} does not have {knownMisses}',
    'array.requiredUnknowns': '{label} does not have {unknownMisses} required value{grammar.s}',
    'array.orderedLength': '{label} must have at most {length} ordered items',
    'array.length': '{label} must have {length} items',
    'array.min': '{label} must have at least {length} items',
    'array.max': '{label} must have at most {length} items',
  },

  coerce: (value, { error }) => {
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (err) {
      return error('array.coerce', { err });
    }
  },

  rebuild: schema => {
    // In order to pass:
    // All required schemas must be met
    // If no required schemas are present, at least one of the optional schema must be met
    // Forbidden schemas mustn't be met
    // Reset
    schema.$index._requireds = [];
    schema.$index._optionals = [];
    schema.$index._forbiddens = [];

    for (const item of schema.$index.items) {
      if (item.$flags.presence === 'required') schema.$index._requireds.push(item);

      if (item.$flags.presence === 'forbidden') schema.$index._forbiddens.push(item);
      else schema.$index._optionals.push(item);
    }
  },

  validate: (value, { error, state, schema, opts, original }) => {
    if (!Array.isArray(value)) return error('array.base');

    if (!opts.recursive) return value;

    const stripUnknown = opts.stripUnknown;
    const abortEarly = opts.abortEarly;
    const errors = [];
    const sparse = schema.$flags.sparse;
    const ordereds = [...schema.$index.ordereds];
    const items = schema.$index.items;
    const requireds = [...schema.$index._requireds];
    const includeds = [...schema.$index._optionals, ...schema.$index._requireds];

    // Shallow clone value
    value = Dust.clone(value, { recursive: false });

    for (let i = 0; i < value.length; i++) {
      const subValue = value[i];
      const divedState = state.dive(original, i);

      // Sparse
      // Check sparse item before anything else
      if (!sparse && subValue === undefined) {
        const err = error('array.sparse', undefined, divedState);

        if (abortEarly) return err;

        errors.push(err);
        ordereds.shift();

        continue;
      }

      let errored = false;
      // Forbiddens
      for (const forbidden of schema.$index._forbiddens) {
        // If we don't pass presence: ignore, undefined will result in array.forbidden
        const result = forbidden.$validate(subValue, opts, divedState, {
          presence: 'ignore',
        });

        // If there are errors, we know that we don't meet the schema, so we move on to the next
        if (result.errors !== null) continue;

        const err = error('array.forbidden', { item: subValue });

        if (abortEarly) return err;

        // If a forbiden schema is met, we move on to the next subValue
        errored = true;

        errors.push(err);
        ordereds.shift();

        break;
      }

      if (errored) continue;

      // Ordereds
      if (ordereds.length > 0) {
        const ordered = ordereds.shift();
        const result = ordered.$validate(subValue, opts, divedState);

        if (result.errors !== null) {
          if (abortEarly) return result.errors;

          errors.push(...result.errors);

          continue;
        }

        // Strip
        if (ordered.$flags.strip) {
          value.splice(i, 1);

          // Decrease i since the item has been spliced
          i--;
        } else if (result.value === undefined && !sparse) {
          // If the returned value from the schema is undefined, we check for the sparse item
          const err = error('array.sparse', undefined, divedState);

          if (abortEarly) return err;

          errors.push(err);

          continue;
        } else value[i] = result.value;

        // Move on to the next item
        continue;
      } else if (items.length === 0) {
        // If there is no ordered schemas or item schemas left, we know that we have more items than
        // ordered schemas
        const err = error('array.orderedLength', { length: ordereds.length });

        if (abortEarly) return err;

        errors.push(err);

        break;
      }

      let isValid = false;
      const requiredChecks = [];

      // Requireds
      // Match every single item with every required
      // If the first required matches the item, remove that required schema
      for (let j = 0; j < requireds.length; j++) {
        const required = requireds[i];
        const result = required.$validate(subValue, opts, divedState);

        // Override passed result because j would the the index of the previously deleted schema
        requiredChecks[j] = result;

        if (result.errors === null) {
          isValid = true;

          if (required.$flags.strip) {
            value.splice(i, 1);

            i--;
          } else if (!sparse && result.value === undefined) {
            const err = error('array.sparse', undefined, divedState);

            if (abortEarly) return err;

            errors.push(err);
          } else value[i] = result.value;

          requireds.splice(j, 1);

          break;
        }
      }

      // This item has matched the required schema, we move on
      if (isValid) continue;

      for (const included of includeds) {
        let result;
        const idx = requireds.indexOf(included);

        // requireds still includes this schema, we know that this rule failed
        if (idx !== -1) {
          result = requiredChecks[idx];
        } else {
          result = included.$validate(value, opts, divedState);

          if (result.errors === null) {
            isValid = true;

            if (included.$flags.strip) {
              value.splice(i, 1);

              i--;
            } else if (!sparse && result.value === undefined) {
              const err = error('array.sparse', undefined, divedState);

              if (abortEarly) return err;

              errors.push(err);
            } else value[i] = result.value;

            break;
          }
        }
      }

      // isValid could be false if no required and optional schemas are provided
      if (includeds.length > 0 && !isValid) {
        if (stripUnknown) {
          value.splice(i, 1);

          i--;

          continue;
        }

        const err = error('array.required', undefined, divedState);

        if (abortEarly) return err;

        errors.push(err);
      }
    }

    if (requireds.length > 0) {
      const err = _errorMissedRequireds(requireds, error);

      if (abortEarly) return err;

      errors.push(err);
    }

    const requiredOrdereds = ordereds.filter(ordered => ordered.$flags.presence === 'required');

    if (requiredOrdereds.length > 0) {
      const err = _errorMissedRequireds(requiredOrdereds, error);

      if (abortEarly) return err;

      errors.push(err);
    }

    if (errors.length > 0) return errors;

    return errors.length > 0 ? errors : value;
  },

  rules: {
    items: {
      alias: ['of'],
      method(...items) {
        return _items(this, items, 'items');
      },
    },

    ordered: {
      alias: ['tuple'],
      method(...items) {
        return _items(this, items, 'ordereds');
      },
    },

    sparse: {
      method(enabled = true) {
        Dust.assert(
          typeof enabled === 'boolean',
          'The parameter enabled for array.sparse must be a boolean',
        );

        return this.$setFlag('sparse', enabled);
      },
    },

    compare: {
      method: false,
      validate: (value, { args: { length, operator }, error, name }) => {
        if (Dust.compare(value.length, length, operator)) return value;

        return error(`array.${name}`, { length });
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
  },
});

function _items(schema, items, type) {
  Dust.assert(items.length > 0, `At least an item must be provided to array.${type}`);

  const target = schema.$clone();

  for (const item of items) {
    Dust.assert(
      isSchema(item),
      `The parameter items for array.${type} must only contain valid schemas`,
    );

    target.$index[type].push(item);
  }

  return target.$rebuild();
}

function _errorMissedRequireds(requireds, error) {
  const knownMisses = [];
  let unknownMisses = 0;

  for (const required of requireds) {
    const label = required.$flags.label;

    if (label !== null) knownMisses.push(label);
    else unknownMisses++;
  }

  const s = unknownMisses > 1 ? 's' : '';

  if (knownMisses.length) {
    if (unknownMisses > 0)
      return error('array.requiredBoth', {
        knownMisses,
        unknownMisses,
        grammar: { s },
      });

    return error('array.requiredKnowns', { knownMisses });
  }

  return error('array.requiredUnknowns', { unknownMisses, grammar: { s } });
}
