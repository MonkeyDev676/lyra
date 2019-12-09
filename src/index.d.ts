declare module '@botbind/lyra' {
  export class LyraError extends Error {}

  export interface ErrorMeta {
    type: string;
    path?: string;
    depth?: number;
  }

  export class LyraValidationError extends Error {
    public type: string;
    public path: string | null;
    public depth: number | null;
    constructor(message: string, meta: ErrorMeta);
  }

  export class Utils {
    public static isString(value): value is string;
    public static isBoolean(value): value is boolean;
    public static isNumber(value): value is number;
    public static isFunction(value): value is Function;
    public static isArray(value): value is any[];
    public static isPlainObject(value): value is object;
  }

  export type Getter = (value: object) => any;

  export class Ref {
    private _type: string;
    private _path: string;
    private _ancestor: number | null;
    private _getter: Getter;
    private _root: string;
    private constructor(path: string, separator?: string);
    private _resolve(context: object, ancestors: object[]): any;
  }

  export interface SchemaFlags {
    required: boolean;
    strip: boolean;
  }

  export interface SchemaMessages {
    required: string | null;
    valid: string | null;
    invalid: string | null;
  }

  export interface SchemaRule<T> {}

  export interface Transformation<T> {}

  export interface ErrorOptions {}

  export class AnySchema<T> {
    private _type: string;
    private _flags: SchemaFlags;
    private _messages: SchemaMessages;
    private _label: string | null;
    private _default: string | undefined;
    private _valids: Set;
    private _invalids: Set;
    private _refs: [number, string, string | undefined][];
    private _rules: SchemaRule<T>[];
    private _transformations: Transformation<T>[];
    constructor(type?: string);
    public clone(): AnySchema;
    protected addRule(rule: SchemaRule<T>): AnySchema;
    protected addTransformation(transformation: Transformation<T>): AnySchema;
    protected createError(opts: ErrorOptions): LyraValidationError;
  }

  export class ArraySchema<T> extends AnySchema<T[]> {}

  export class BooleanSchema extends AnySchema<boolean> {}

  export class DateSchema extends AnySchema<Date> {}

  export class FunctionSchema<T extends Function> extends AnySchema<T> {}

  export class NumberSchema extends AnySchema<number> {}

  export class ObjectSchema<T> extends AnySchema<T> {}

  export class StringSchema extends AnySchema<string> {}
}
