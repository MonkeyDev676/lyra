import isEqual from 'lodash/isEqual';
import Utils from './Utils';

class Values {
  constructor() {
    this._values = new Set();
    this._refs = new Set();
  }

  get size() {
    return this._values.size + this._refs.size;
  }

  merge(source, remove) {
    source.values().forEach(value => this.add(value));
    remove.values().forEach(value => this.delete(value));

    return this;
  }

  add(...values) {
    values.forEach(value => {
      if (Utils.isRef(value)) this._refs.add(value);
      else this._values.add(value);
    });

    return this;
  }

  delete(...values) {
    values.forEach(value => {
      if (Utils.isRef(value)) this._refs.delete(value);
      else this._values.delete(value);
    });

    return this;
  }

  has(value, ancestors, context) {
    if (this._values.has(value)) return true;

    for (const v of this._values) {
      if (isEqual(v, value)) return true;
    }

    for (const ref of this._refs) {
      const resolved = ref.resolve(ancestors, context);

      if (isEqual(resolved, value)) return true;
    }

    return false;
  }

  values() {
    return [...this._values, ...this._refs];
  }
}

Values.prototype.__LYRA_VALUES__ = true;

export default Values;
