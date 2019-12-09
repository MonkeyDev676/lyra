class LyraValidationError extends Error {
  constructor(message, meta) {
    const { type, path, depth } = meta;

    super(message);

    this.name = 'LyraValidationError';
    this.type = type;
    this.path = path == null ? null : path;
    this.depth = depth == null ? null : depth;
  }
}

export default LyraValidationError;
