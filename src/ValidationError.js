module.exports = class ValidationError extends Error {
  constructor(message, code, state) {
    super(message);

    this.name = 'ValidationError';
    this.code = code;
    this.path = state.path;
    this.depth = state.depth;
    this.ancestors = state.ancestors;
  }
};
