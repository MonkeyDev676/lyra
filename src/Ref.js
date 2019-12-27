const get = require('lodash/get');
const Utils = require('./Utils');

class Ref {
  constructor(path) {
    Utils.assert(typeof path === 'string', 'The parameter path for Ref must be a string');

    path = path.trim();

    Utils.assert(path !== '', 'The parameter path for Ref must be a non-empty string');

    let slice = 1;

    if (path[0] === '$') {
      // Context
      this._ancestor = 'context';
    } else if (path[0] !== '.') {
      // a.b => root
      this._ancestor = 1;
      slice = 0;
    } else if (path[1] !== '.') {
      // .a.b => current parent
      this._ancestor = 0;
    } else {
      // We now scan for the separator starting from the third character
      let i = 2;

      while (path[i] === '.') {
        i++;
      }

      this._ancestor = i - 1;
      slice = i;
    }

    this._enhancedPath = path.slice(slice);
    this._path = path;
    this._root = this._enhancedPath.split('.')[0];
    this._display = `ref:${this._path}`;
  }

  resolve(value, ancestors, context) {
    if (this._ancestor === 'context') return get(context, this._enhancedPath);

    if (this._ancestor === 0) return get(value, this._enhancedPath);

    Utils.assert(
      this._ancestor <= ancestors.length,
      `Reference to ${this._path} exceeds the schema root`,
    );

    return get(ancestors[this._ancestor - 1], this._enhancedPath);
  }
}

Ref.prototype.__LYRA_REF__ = true;

module.exports = Ref;
