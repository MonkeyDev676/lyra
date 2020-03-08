const Dust = require('@botbind/dust');
const { isRef } = require('./ref');

const _listSymbol = Symbol('__LIST');

class _List {
  constructor(values, refs) {
    this._values = new Set(values);
    this._refs = new Set(refs);
  }

  get size() {
    return this._values.size + this._refs.size;
  }

  clone() {
    return new _List(this._values, this._refs);
  }

  merge(src, remove) {
    Dust.assert(isList(src), 'The parameter src for List.merge must be a valid list');

    Dust.assert(
      remove === undefined || isList(remove),
      'The parameter remove for List.merge must be an instance of a valid list',
    );

    for (const value of src.values()) this.add(value);

    if (remove !== undefined) for (const value of remove.values()) this.delete(value);

    return this;
  }

  add(item, register) {
    if (isRef(item)) {
      this._refs.add(item);

      if (register !== undefined) register(item);
    } else this._values.add(item);

    return this;
  }

  delete(item) {
    if (isRef(item)) this._refs.delete(item);
    else this._values.delete(item);

    return this;
  }

  has(value, ancestors, context) {
    if (this._values.has(value)) return true;

    for (const v of this._values) {
      if (Dust.equal(v, value)) return true;
    }

    for (const ref of this._refs) {
      const resolved = ref.resolve(value, ancestors, context);

      if (Dust.equal(resolved, value)) return true;
    }

    return false;
  }

  describe() {
    const desc = [];

    for (const value of this._values) {
      desc.push(value);
    }

    for (const ref of this._refs) {
      desc.push(ref.describe());
    }

    return desc;
  }

  values() {
    return [...this._values, ...this._refs];
  }
}

Object.defineProperty(_List.prototype, _listSymbol, { value: true });

function list(values, refs) {
  return new _List(values, refs);
}

function isList(value) {
  return value != null && !!value[_listSymbol];
}

module.exports = {
  list,
  isList,
};
