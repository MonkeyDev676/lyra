const equal = require('@botbind/dust/src/equal');

module.exports = {
  toHaveBeenCalledTimes: (mock, times) => mock.mock.calls.length === times,
  toHaveBeenCalled: mock => mock.mock.calls.length >= 1,
  toHaveBeenCalledWith: (mock, { args, equalOpts }) =>
    mock.mock.calls.some(callArgs => equal(callArgs, args, equalOpts)),
};
