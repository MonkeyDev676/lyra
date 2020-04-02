const assert = require('@botbind/dust/src/assert');
const get = require('@botbind/dust/src/get');
const isObject = require('@botbind/dust/src/isObject');

const _symbols = {
  ref: Symbol('__REF__'),
};

class _Ref {
  constructor(path, opts) {
    const separator = opts.separator === undefined ? '.' : opts.separator;

    if (Array.isArray(path)) {
      this._path = path;
      this._ancestor = opts.ancestor === undefined ? 1 : opts.ancestor;
      this._originalPath =
        new Array(this._ancestor + 1).fill(separator).join('') + path.join(separator);
    } else {
      assert(
        opts.ancestor === undefined || path[0] !== separator,
        'Cannot use both the separator notion and the ancestor option',
      );

      if (opts.ancestor !== undefined) {
        this._path = path;
        this._ancestor = opts.ancestor === undefined ? 1 : opts.ancestor;
      } else {
        let slice = 1;

        if (path[0] === '$') {
          // Context
          this._ancestor = 'context';
        } else if (path[0] !== separator) {
          // a.b => sibling
          this._ancestor = 1;
          slice = 0;
        } else if (path[1] !== separator) {
          // .a.b => self
          this._ancestor = 0;
        } else {
          // We now scan for the separator starting from the third character
          let i = 2;

          while (path[i] === separator) {
            i++;
          }

          this._ancestor = i - 1;
          slice = i;
        }

        this._path = path.slice(slice);
      }

      this._path = this._path.split(separator);
      this._originalPath = path;
    }

    this._root = this._path[0];
    this.display = `ref(${this._originalPath})`;
  }

  resolve(value, ancestors, context = {}) {
    if (this._ancestor === 'context') return get(context, this._path);

    if (this._ancestor === 0) return get(value, this._path);

    assert(
      this._ancestor <= ancestors.length,
      'Reference to',
      this._path,
      'exceeds the schema root',
    );

    return get(ancestors[this._ancestor - 1], this._path);
  }

  describe() {
    return {
      path: this._originalPath,
    };
  }
}

Object.defineProperty(_Ref.prototype, _symbols.ref, { value: true });

function ref(path, opts = {}) {
  assert(
    typeof path === 'string' || Array.isArray(path),
    'The parameter path for ref must be an array or a string',
  );

  if (typeof path === 'string') {
    path = path.trim();

    assert(path !== '', 'The parameter path for ref must be a non-empty string');
  }

  assert(isObject(opts), 'The parameter opts for ref must be an object');

  assert(
    opts.separator === undefined || typeof opts.separator === 'string',
    'The option separator for ref must be a string',
  );

  assert(
    opts.ancestor === undefined || opts.ancestor === 'context' || typeof opts.ancestor === 'number',
    'The option ancestor for ref must be a number',
  );

  return new _Ref(path, opts);
}

function isRef(value) {
  return value != null && !!value[_symbols.ref];
}

module.exports = {
  ref,
  isRef,
};
