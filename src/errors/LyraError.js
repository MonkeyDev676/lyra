class LyraError extends Error {
  constructor(message) {
    super(message);

    this.name = 'LyraError';
  }
}

export default LyraError;
