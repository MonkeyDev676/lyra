const _stateSymbol = Symbol('__STATE__');

class _State {
  constructor(ancestors = [], path = [], depth = 0) {
    this._ancestors = ancestors;
    this._depth = depth;
    this._path = path;
  }

  dive(ancestor, path) {
    return new _State([ancestor, ...this._ancestors], [...this._path, path], this._depth++);
  }
}

Object.defineProperty(_State.prototype, _stateSymbol, { value: true });

function state() {
  return new _State();
}

function isState(value) {
  return value != null && !!value[_stateSymbol];
}

module.exports = {
  state,
  isState,
};
