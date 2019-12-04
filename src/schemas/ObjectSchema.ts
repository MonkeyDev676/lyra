import t from 'toposort';
import AnySchema from './AnySchema';
import Ref from '../Ref';
import Utils from '../Utils';
import LyraError from '../errors/LyraError';
import { ValidatorOptions, ValidationResult, SchemaMap, LooseObject } from '../types';

export default class ObjectSchema<T extends LooseObject> extends AnySchema<T> {
  private _schemaMap: SchemaMap<T> | null;

  constructor(schemaMap?: SchemaMap<T>) {
    if (schemaMap != null && !Utils.isPlainObject(schemaMap))
      throw new LyraError('The parameter schemaMap for Lyra.ObjectSchema must be a plain object');

    super('object');

    if (schemaMap == null || Object.keys(schemaMap).length === 0) this._schemaMap = null;
    else this._schemaMap = schemaMap;
  }

  protected check(value: unknown): value is T {
    return Utils.isPlainObject(value);
  }

  public length(length: number | Ref<number>, message?: string) {
    this.addRule({
      deps: { length },
      type: 'length',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isNumber(deps.length))
          throw new LyraError('The parameter length for object.length must be a number');

        return Object.keys(value).length === deps.length;
      },
    });

    return this;
  }

  public min(length: number | Ref<number>, message?: string) {
    this.addRule({
      deps: { length },
      type: 'min',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isNumber(deps.length))
          throw new LyraError('The parameter length for object.min must be a number');

        return Object.keys(value).length >= deps.length;
      },
    });

    return this;
  }

  public max(length: number | Ref<number>, message?: string) {
    this.addRule({
      deps: { length },
      type: 'max',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isNumber(deps.length))
          throw new LyraError('The parameter length for object.max must be a number');

        return Object.keys(value).length <= deps.length;
      },
    });

    return this;
  }

  public instance(ctor: Function | Ref<number>, message?: string) {
    this.addRule({
      deps: { ctor },
      type: 'instance',
      message,
      validate: ({ value, deps }) => {
        if (!Utils.isFunction(deps.ctor))
          throw new LyraError('The parameter ctor for object.instance must be a function');

        return Utils.instanceOf(value, deps.ctor);
      },
    });

    return this;
  }

  public validate(value: unknown, options: ValidatorOptions = {}): ValidationResult<T> {
    const { abortEarly = true, recursive = true, strict = true, context = {} } = options;
    const finalResult: LooseObject = {};
    const errors = [];
    const baseResult = super.validate(value, options);

    // Run this.check in case of optional without default value
    if (this._schemaMap == null || !baseResult.pass || !this.check(baseResult.value) || !recursive)
      return baseResult;

    const flattenedSchema: { [key: string]: AnySchema<any> } = {};
    const fields: LooseObject = {};
    const nodes: string[] = [];
    const edges: [string, string][] = [];

    const flattenSchemaAndFields = (
      schemaMap = this._schemaMap!,
      baseValue = baseResult.value!,
      result: LooseObject = finalResult,
      prevKey?: string,
    ) => {
      Object.entries(schemaMap).forEach(([key, schema]) => {
        const enhancedKey = prevKey == null ? key : `${prevKey}.${key}`;
        const subValue = baseValue[key];

        if ((schema as any)._schemaMap != null) {
          // eslint-disable-next-line no-param-reassign
          result[key] = {};

          flattenSchemaAndFields(
            (schema as any)._schemaMap,
            subValue == null ? {} : subValue,
            result[key],
            enhancedKey,
          );
        } else {
          flattenedSchema[enhancedKey] = schema;
          // eslint-disable-next-line no-param-reassign
          result[key] = schema.value(subValue, strict);
          fields[enhancedKey] = [subValue, result[key]];

          nodes.push(enhancedKey);

          schema.deps.forEach(dep => {
            edges.push([enhancedKey, dep]);
          });
        }
      });
    };

    flattenSchemaAndFields();

    let sortedKeys;

    try {
      sortedKeys = t.array(nodes, edges).reverse();
    } catch (err) {
      throw err;
    }

    for (const key of sortedKeys) {
      const subSchema = flattenedSchema[key];
      const subValue = fields[key];

      const result = subSchema.validate(subValue[0], {
        ...options,
        context: {
          ...context,
          __LYRA_INTERNAL_FIELDS__: fields,
        },
        path: key,
      });

      if (!result.pass) {
        errors.push(...result.errors);

        if (abortEarly) return { value: null, errors: result.errors, pass: false };
      }
    }

    if (errors.length > 0) return { value: null, errors, pass: false };

    return { value: finalResult as T, errors: null, pass: true };
  }
}
