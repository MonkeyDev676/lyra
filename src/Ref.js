import { getter } from 'property-expr';
import Utils from './Utils';
import LyraError from './errors/LyraError';

class Ref {
  constructor(path, separator = '.') {
    if (!Utils.isString(path))
      throw new LyraError('The parameter path for Lyra.Ref must be a string');

    if (!Utils.isString(separator))
      throw new LyraError('The parameter separator for Lyra.Ref must be a string');

    const enhancedPath = path.trim();

    if (enhancedPath === '')
      throw new LyraError('The parameter path for Lyra.Ref must be a non-empty string');

    let slice = 0;

    if (enhancedPath[0] === '/') {
      this._type = 'root';
    } else if (enhancedPath[0] === '$') {
      // Context
      this._type = 'context';
    } else {
      this._type = 'value';

      if (enhancedPath[0] !== separator) {
        // a.b => root
        this._ancestor = 1;
      } else if (enhancedPath[1] !== separator) {
        // .a.b => current parent
        this._ancestor = 0;
        slice = 1;
      } else {
        // We now scan for the separator starting from the third character
        let i = 2;

        while (enhancedPath[i] === separator) {
          i += 1;
        }

        this._ancestor = i - 1;
        slice = i;
      }
    }

    const slicedPath = enhancedPath.slice(slice);

    this._path = enhancedPath;
    this._getter = getter(slicedPath);
    this._root = slicedPath.split(separator)[0];
  }

  _resolve(context, ancestors) {
    let target;

    if ((this._type === 'root' || this._type === 'value') && ancestors == null)
      throw new LyraError(
        `Cannot resolve ${this._path} due to it being used outside Lyra.ObjectSchema`,
      );

    if (this._type === 'root') target = ancestors[ancestors.length - 1];

    if (this._type === 'context') target = context;

    if (this._ancestor > ancestors.length)
      throw new LyraError(`Reference to ${this._path} exceeds the schema root`);

    if (this._type === 'value') target = ancestors[this._ancestor - 1];

    try {
      return this._getter(target);
    } catch (err) {
      return undefined;
    }
  }
}

Ref.prototype.__LYRA_REF__ = true;

export default Ref;
