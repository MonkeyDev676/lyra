class State {
  constructor() {
    this.ancestors = [];
    this.depth = 1;
    this.path = null;
  }

  static isValid(value) {
    return value != null && !!value.__STATE__;
  }

  dive(ancestor) {
    this.ancestors.push(ancestor);
    this.depth++;

    return this;
  }

  updatePath(path) {
    this.path = path;

    return this;
  }
}

Object.defineProperty(State.prototype, '__STATE__', { value: true });

module.exports = State;
