const Dust = require('@botbind/dust');

const _refSymbol = Symbol('__REF__');

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

    if (this._ancestor === 'context') return Dust.get(context, this._path, opts);

    if (this._ancestor === 0) return Dust.get(value, this._path, opts);

    Dust.assert(
      this._ancestor <= ancestors.length,
      'Reference to',
      this._path,
      'exceeds the schema root',
    );

    return Dust.get(ancestors[this._ancestor - 1], this._path, opts);
  }

  describe() {
    return {
      originalPath: this._originalPath,
      separator: this._separator,
    };
  }
}

Object.defineProperty(_Ref.prototype, _refSymbol, { value: true });

function ref(path, opts = {}) {
  Dust.assert(typeof path === 'string', 'The parameter path for ref must be a string');

  path = path.trim();

  Dust.assert(path !== '', 'The parameter path for ref must be a non-empty string');

  Dust.assert(Dust.isObject(opts), 'The parameter opts for ref must be an object');

  opts = {
    separator: '.',
    ...opts,
  };

  Dust.assert(typeof opts.separator === 'string', 'The option separator for ref must be a string');

  return new _Ref(path, opts);
}

function isRef(value) {
  return value != null && !!value[_refSymbol];
}

module.exports = {
  ref,
  isRef,
};
