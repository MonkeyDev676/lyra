const assert = require('@botbind/dust/dist/assert');
const equal = require('@botbind/dust/dist/equal');
const Ref = require('./Ref');

class Values {
  constructor(values, refs) {
    this._values = new Set(values);
    this._refs = new Set(refs);
  }

  static isValid(value) {
    return value != null && !!value.__VALUES__;
  }

  get size() {
    return this._values.size + this._refs.size;
  }

  clone() {
    return new Values(this._values, this._refs);
  }

  merge(src, remove) {
    assert(Values.isValid(src), 'The parameter src for Values.merge must be an instance of Values');
    assert(
      Values.isValid(remove),
      'The parameter remove for Values.merge must be an instance of Values',
    );

    for (const value of src.values()) this.add(value);

    for (const value of remove.values()) this.delete(value);

    return this;
  }

  add(...items) {
    for (const item of items) {
      if (Ref.isValid(item)) this._refs.add(item);
      else this._values.add(item);
    }

    return this;
  }

  delete(...items) {
    for (const item of items) {
      if (Ref.isValid(item)) this._refs.delete(item);
      else this._values.delete(item);
    }

    return this;
  }

  has(value, ancestors, context) {
    if (this._values.has(value)) return true;

    for (const v of this._values) {
      if (equal(v, value)) return true;
    }

    for (const ref of this._refs) {
      const resolved = ref.resolve(value, ancestors, context);

      if (equal(resolved, value)) return true;
    }

    return false;
  }

  values() {
    return [...this._values, ...this._refs];
  }
}

Object.defineProperty(Values.prototype, '__VALUES__', { value: true });

module.exports = Values;
