const equal = require('@botbind/dust/src/equal');

function _toHaveBeenCalled(mock) {
  return mock.mock.calls.length >= 1;
}

function _toHaveBeenCalledWith(mock, { args, equalOpts }) {
  return mock.mock.calls.some(callArgs => equal(callArgs, args, equalOpts));
}

function _spy(fn, { proto, method, args = [], equalOpts, impl }) {
  const spy = jest.spyOn(proto, method);

  if (typeof impl === 'function') spy.mockImplementation(impl);

  fn(spy);

  if (args.length === 0) expect(_toHaveBeenCalled(spy)).toBe(true);
  else expect(_toHaveBeenCalledWith(spy, { args, equalOpts }));

  spy.mockRestore();
}

module.exports = {
  toHaveBeenCalled: _toHaveBeenCalled,
  toHaveBeenCalledWith: _toHaveBeenCalledWith,
  isPass: result => result.errors === null,
  spy: _spy,
};
