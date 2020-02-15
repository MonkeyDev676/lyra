const equal = require('@botbind/dust/dist/equal');
const compare = require('@botbind/dust/dist/compare');
const serialize = require('@botbind/dust/dist/serialize');
const State = require('../State');
const Ref = require('../Ref');
const _const = require('../internals/_constants');

const refs = [];

function _callWith(mock, { args, equalOpts, operator = '>=' }) {
  return (
    compare(mock.mock.calls.length, 1, operator) &&
    mock.mock.calls.some(callArgs => equal(callArgs, args, equalOpts))
  );
}

function _validate(method) {
  const extension = method === '$validate';
  const state = new State();

  return (schema, input, { pass = true, result, opts = {} }) => {
    opts = { ..._const.DEFAULT_VALIDATE_OPTS, ...opts };

    const args = [input, opts];

    if (extension) args.push(state);

    const spy = jest.spyOn(Object.getPrototypeOf(schema), '$createError');
    const { value } = schema[method](...args);

    if (pass) {
      const isEqual = equal(value, result);

      if (!isEqual) {
        console.log(`
Expected result: ${serialize(result)}
But received: ${serialize(value)}
Test failed with input: ${serialize(input)}
          `);
      }

      expect(isEqual).toBe(true);
    } else {
      const callArgs = [
        result.code,
        result.state === undefined ? state : result.state,
        opts.context,
        result.lookup,
      ];

      const isCalled = _callWith(spy, {
        args: callArgs,
      });

      if (!isCalled) {
        console.log(`
Expected result: ${serialize(callArgs)}
is not in: ${serialize(spy.mock.calls)}
Test failed with input: ${serialize(input)}
        `);
      }

      expect(isCalled).toBe(true);
    }

    spy.mockRestore();
  };
}

module.exports = {
  callWith: _callWith,
  validate: _validate('validate'),
  $validate: _validate('$validate'),
  createRef: resolveTo => {
    const ref = new Ref('a');
    const original = ref.resolve;

    ref.resolve = () => resolveTo;

    refs.push([ref, original]);

    ref.update = updateTo => {
      ref.resolve = () => updateTo;
    };

    return ref;
  },
  resetAllRefs: () => {
    for (const [ref, original] of refs) {
      ref.resolve = original;
    }

    refs.length = 0;
  },
};
