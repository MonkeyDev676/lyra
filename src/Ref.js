import get from 'lodash/get';
import Utils from './Utils';

class Ref {
  constructor(path) {
    Utils.assert(typeof path === 'string', 'The parameter path for Lyra.Ref must be a string');

    path = path.trim();

    Utils.assert(path !== '', 'The parameter path for Lyra.Ref must be a non-empty string');

    let slice = 0;

    if (path[0] === '/') {
      this._type = 'root';
    } else if (path[0] === '$') {
      // Context
      this._type = 'context';
    } else {
      this._type = 'value';

      if (path[0] !== '.') {
        // a.b => root
        this._ancestor = 1;
      } else if (path[1] !== '.') {
        // .a.b => current parent
        this._ancestor = 0;
        slice = 1;
      } else {
        // We now scan for the separator starting from the third character
        let i = 2;

        while (path[i] === '.') {
          i++;
        }

        this._ancestor = i - 1;
        slice = i;
      }
    }

    this._enhancedPath = path.slice(slice);
    this._path = path;
    this._root = this._path.split('.')[0];
    this._display = `ref:${this._path}`;
  }

  resolve(ancestors, context) {
    let target;

    Utils.assert(
      this._type === 'context' || ancestors.length >= 0,
      `Cannot resolve ${this._path} due to it being used outside Lyra.ObjectSchema or Lyra.ArraySchema`,
    );

    if (this._type === 'root') target = ancestors[ancestors.length - 1];

    if (this._type === 'context') target = context;

    Utils.assert(
      this._ancestor <= ancestors.length,
      `Reference to ${this._path} exceeds the schema root`,
    );

    if (this._type === 'value') target = ancestors[this._ancestor - 1];

    return get(target, this._enhancedPath);
  }
}

Ref.prototype.__LYRA_REF__ = true;

export default Ref;
