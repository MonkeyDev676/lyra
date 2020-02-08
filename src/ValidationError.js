class ValidationError extends Error {
  constructor(message, code, state) {
    super(message);

    this.name = 'ValidationError';
    this.code = code;
    this.path = state.path;
    this.depth = state.depth;
    this.ancestors = state.ancestors;
  }

  static isValid(value) {
    return value != null && !!value.__VALIDATION_ERROR__;
  }
}

Object.defineProperty(ValidationError.prototype, '__VALIDATION_ERROR__', { value: true });

module.exports = ValidationError;
