declare module '@botbind/lyra' {
  /**
   * The error that is thrown when
   */
  export class LyraError extends Error {}

  /**
   *
   */
  export interface State {
    /**
     *
     */
    type: string;

    /**
     *
     */
    path?: string;

    /**
     *
     */
    depth?: number;
  }

  /**
   *
   */
  export class LyraValidationError extends Error {
    /**
     *
     */
    public type: string;

    /**
     *
     */
    public path: string | null;

    /**
     *
     */
    public depth: number | null;
    constructor(message: string, meta: State);
  }

  export class Utils {
    /**
     *
     * @param value
     */
    public static isSchema(value: unknown): value is AnySchema;

    /**
     *
     * @param value
     */
    public static isRef(value: unknown): value is Ref;

    /**
     *
     * @param value
     */
    public static serialize(value: unknown): string;

    /**
     *
     * @param value
     * @param atRoot
     */
    public static cloneDeep<T>(value: T, atRoot?: boolean): T;
  }

  export type Getter = (value: object) => unknown;

  /**
   *
   */
  export class Ref {
    private _type: string;
    private _path: string;
    private _ancestor: number | null;
    private _getter: Getter;
    private _root: string;
    private constructor(path: string);

    /**
     *
     * @param values
     * @param context
     * @param ancestors
     */
    public static all(values: unknown[], context: object, ancestors: object[]): unknown[];

    /**
     *
     * @param context
     * @param ancestors
     */
    public resolve(context: object, ancestors: object[]): unknown;
  }

  export interface SchemaRuleArguments<T, P> {
    value: T;
    params: P;
    context: object;
  }

  export interface SchemaRule<T> {}

  export type Transformation<T> = (value: T) => T;

  export interface ValidatorOptions {}

  export interface ValidationResultFailed {
    value: null;
    errors: LyraValidationError[];
    pass: false;
  }

  export interface ValidationResultPass<T> {
    value: T;
    errors: null;
    pass: true;
  }

  export type ValidationResult<T> = ValidationResultFailed | ValidationResultPass<T>;

  export abstract class AnySchema<T> {
    private _type: string;
    private _flags: { required: boolean; strip: boolean };
    private _messages: { required: string | null; valid: string | null; invalid: string | null };
    private _label: string | null;
    private _default: unknown | undefined;
    private _valids: Set<unknown>;
    private _invalids: Set<unknown>;
    private _refs: [number, string, string | undefined][];
    private _rules: SchemaRule<T>[];
    private _transformations: Transformation<T>[];
    constructor(type?: string);
    public static isSchema(value: unknown): value is AnySchema;
    protected abstract check(value: unknown): value is T;
    protected coerce?(value: unknown): unknown;
    public clone(): this;
    protected addRule(rule: SchemaRule<T>): this;
    protected addTransformation(transformation: Transformation<T>): this;
    private _applyCoercion(value: unknown, strict: boolean): unknown;
    public strip(): this;
    public required(message?: string): this;
    public default(value: unknown): this;
    public label(label: string): this;
    public valid(values: (unknown | Ref)[], message?: string): this;
    public valid(...values: (unknown | Ref)[]): this;
    public invalid(values: (unknown | Ref)[], message?: string): this;
    public invalid(...values: (unknown | Ref)[]): this;
    protected coreValidate(
      value: unknown,
      opts: ValidatorOptions,
      state: State,
    ): ValidationResult<T>;
    public validate(value: unknown, opts: ValidationResultPass): ValidationResult<T>;
  }

  export class ArraySchema<T> extends AnySchema<T[]> {
    private _schema: AnySchema<T>;
    protected check(value: unknown): value is T[];
    protected coerce(value: unknown): unknown;
    public length(length: number | Ref, message?: string): this;
    public min(length: number | Ref, message?: string): this;
    public max(length: number | Ref, message?: string): this;
    public reverse(): this;
  }

  export class BooleanSchema extends AnySchema<boolean> {
    protected check(value: unknown): value is boolean;
    protected coerce(value: unknown): unknown;
    public truthy(message?: string): this;
    public falsy(message?: string): this;
  }

  export class DateSchema extends AnySchema<Date> {
    protected check(value: unknown): value is Date;
    protected coerce(value: unknown): unknown;
    public older(date: 'now' | Date | Ref, message?: string): this;
    public newer(date: 'now' | Date | Ref, message?: string): this;
  }

  export class FunctionSchema<T extends Function> extends AnySchema<T> {
    protected check(value: unknown): value is T;
    public inherit(ctor: Function | Ref, message?: string): this;
  }

  export class NumberSchema extends AnySchema<number> {
    protected check(value: unknown): value is number;
    protected coerce(value: unknown): unknown;
    public integer(message?: string): this;
    public min(num: number | Ref, message?: string): this;
    public max(num: number | Ref, message?: string): this;
    public multiple(num: number | Ref, message?: string): this;
    public divide(num: number | Ref, message?: string): this;
    public greater(num: number | Ref, message?: string): this;
    public smaller(num: number | Ref, message?: string): this;
    public expression(exp: Transformation<number>): this;
  }

  export class ObjectSchema<T extends object> extends AnySchema<T> {
    protected check(value: unknown): value is object;
    protected coerce(value: unknown): unknown;
    public length(length: number | Ref, message?: string): this;
    public min(num: number | Ref, message?: string): this;
    public max(num: number | Ref, message?: string): this;
    public instance(ctor: Function | Ref, message?: string): this;
  }

  export class StringSchema extends AnySchema<string> {}
}
