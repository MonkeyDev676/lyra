const assert = require('@botbind/dust/src/assert');
const get = require('@botbind/dust/src/get');
const isObject = require('@botbind/dust/src/isObject');

const _symbols = {
  ref: Symbol('__REF__'),
};

class _Ref {
  constructor(path, opts) {
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
    this._root = this._path.split(opts.separator)[0];
    this._display = `ref(${path})`;
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

  describe() {
    return {
      root: this._root,
      originalPath: this._originalPath,
      separator: this._separator,
    };
  }
}

Object.defineProperty(_Ref.prototype, _symbols.ref, { value: true });

function ref(path, opts = {}) {
  assert(typeof path === 'string', 'The parameter path for ref must be a string');

  path = path.trim();

  assert(path !== '', 'The parameter path for ref must be a non-empty string');

  assert(isObject(opts), 'The parameter opts for ref must be an object');

  opts = {
    separator: '.',
    ...opts,
  };

  assert(typeof opts.separator === 'string', 'The option separator for ref must be a string');

  return new _Ref(path, opts);
}

function isRef(value) {
  return value != null && !!value[_symbols.ref];
}

module.exports = {
  ref,
  isRef,
};
