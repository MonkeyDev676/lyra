export default class LyraError extends Error {
  /**
   * Represents a general error that originates from Nebula
   * @param message The message of the error
   */
  constructor(message: string) {
    super(message);

    this.name = 'LyraError';
  }
}
