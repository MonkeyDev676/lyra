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

  add(...items) {
    items.forEach(item => {
      if (Utils.isRef(item)) this._refs.add(item);
      else this._values.add(item);
    });

    return this;
  }

  delete(...items) {
    items.forEach(item => {
      if (Utils.isRef(item)) this._refs.delete(item);
      else this._values.delete(item);
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
