const assert = require('@botbind/dust/dist/assert');
const isPlainObject = require('@botbind/dust/dist/isPlainObject');
const get = require('@botbind/dust/dist/get');
const symbols = require('./symbols');

class Ref {
  constructor(path, opts = {}) {
    assert(typeof path === 'string', 'The parameter path for Ref must be a string');

    path = path.trim();

    assert(path !== '', 'The parameter path for Ref must be a non-empty string');
    assert(isPlainObject(opts), 'The parameter opts for Ref must be a plain object');

    opts = {
      separator: '.',
      ...opts,
    };

    assert(typeof opts.separator === 'string', 'The option separator for Ref must be a string');

    let slice = 1;

    if (path[0] === '$') {
      // Context
      this._ancestor = 'context';
    } else if (path[0] !== opts.separator) {
      // a.b => sibling
      this._ancestor = 1;
      slice = 0;
    } else if (path[1] !== opts.separator) {
      // .a.b => self
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

    this._originalPath = path;
    this._separator = opts.separator;
    this._path = this._originalPath.slice(slice);
    this._root = this._path[0];
    this._display = `ref(${path})`;
  }

  static isValid(value) {
    return value != null && !!value.__REF__;
  }

  resolve(value, ancestors, context) {
    const opts = { separator: this._separator };

    if (this._ancestor === 'context') return get(context, this._path, opts);

    if (this._ancestor === 0) return get(value, this._path, opts);

    assert(
      this._ancestor <= ancestors.length,
      'Reference to',
      this._path,
      'exceeds the schema root',
    );

    return get(ancestors[this._ancestor - 1], this._path, opts);
  }

  [symbols.describe]() {
    return {
      originalPath: this._originalPath,
      separator: this._separator,
    };
  }
}

Object.defineProperty(Ref.prototype, '__REF__', { value: true });

module.exports = Ref;
