class LyraValidationError extends Error {
  constructor(message, type, state) {
    const { ancestors, path, depth } = state;

    super(message);

    this.name = 'LyraValidationError';
    this.type = type;
    this.path = path;
    this.depth = depth;
    this.ancestors = ancestors;
  }
}

module.exports = LyraValidationError;
