export default class LyraValidationError extends Error {
  public path: string | null;

  /**
   * Represents a general error that originates from Nebula
   * @param message The message of the error
   */
  constructor(message: string, path?: string) {
    super(message);

    this.name = 'LyraValidationError';
    this.path = path == null ? null : path;
  }
}
