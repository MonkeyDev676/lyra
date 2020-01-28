const assert = require('@botbind/dust/src/assert');
const isPlainObject = require('@botbind/dust/src/isPlainObject');
const get = require('@botbind/dust/src/get');

class Ref {
  constructor(path, opts = {}) {
    assert(typeof path === 'string', 'The parameter path for Ref must be a string');

    path = path.trim();

    assert(path !== '', 'The parameter path for Ref must be a non-empty string');
    assert(isPlainObject(opts), 'The parameter opts for Ref must be a plain object');

    opts = {
      separator: '.',
      default: undefined,
      ...opts,
      ownProperties: true, // Prevent overriding ownProperties
    };

    assert(typeof opts.separator === 'string', 'The option separator for Ref must be a string');

    let slice = 1;

    if (path[0] === '$') {
      // Context
      this._ancestor = 'context';
    } else if (path[0] !== opts.separator) {
      // a.b => root
      this._ancestor = 1;
      slice = 0;
    } else if (path[1] !== opts.separator) {
      // .a.b => current parent
      this._ancestor = 0;
    } else {
      // We now scan for the separator starting from the third character
      let i = 2;

      while (path[i] === opts.separator) {
        i++;
      }

      this._ancestor = i - 1;
      slice = i;
    }

    const slicedPath = path.slice(slice);

    this._get = value => get(value, slicedPath, opts);
    this._path = path;
    this._root = slicedPath.split(opts.separator)[0];
    this._display = `ref:${this._path}`;
  }

  static isValid(value) {
    return value != null && !!value.__REF__;
  }

  resolve(value, ancestors, context) {
    if (this._ancestor === 'context') return this._get(context);

    if (this._ancestor === 0) return this._get(value);

    assert(
      this._ancestor <= ancestors.length,
      'Reference to',
      this._path,
      'exceeds the schema root',
    );

    return this._get(ancestors[this._ancestor - 1]);
  }
}

Object.defineProperty(Ref.prototype, '__REF__', { value: true });

module.exports = Ref;
