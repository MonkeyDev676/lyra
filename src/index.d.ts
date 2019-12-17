export interface State {
  path?: string;
  depth?: number;
  ancestors: object[];
}

export class LyraError extends Error {}

export class LyraValidationError extends Error {
  type: string;
  path: string | null;
  depth: number | null;
  ancestors: object[];
  constructor(message: string, type: string, meta: State);
}

export class Values {
  _values: Set<unknown>;
  _refs: Set<unknown>;
  constructor();
  merge(source: Values, remove: Values): this;
  add(...values: unknown[]): this;
  delete(...values: unknown[]): this;
  has(value: unknown): boolean;
  values(): unknown[];
}

export class Utils {
  static isSchema(value: unknown): value is AnySchema;
  static isRef(value: unknown): value is Ref;
  static isValues(value: unknown): value is Values;
  static assert(condition: boolean, message: string): void;
  static getDeterminer(word: string): 'an' | 'a';
  static customizerToMessage(customizer: string | Error): string;
  static serialize(value: unknown): string;
}

export class Ref {
  _type: 'value' | 'root' | 'context';
  _path: string;
  _ancestor: number | null;
  _root: string;
  constructor(path: string);
  resolve(context: Record<string, any>, ancestors: object[]): unknown;
}

export type ExtractedRef = [number, string, string | undefined];

export interface RuleArgs<T, P> {
  value: T;
  params: P;
  context: object;
}

export type ParamAssert = (resolved: unknown) => [boolean, string];

export type RuleParams<T> = {
  [K in keyof T]: {
    value: T[K];
    assert: string | ParamAssert;
  };
};

export interface Rule<T, P = undefined> {
  params: RuleParams<P>;
  type: string;
  validate: (args: RuleArgs<T, P>) => boolean;
}

export type Transformation<T> = (value: T) => T;

export interface ValidatorOptions {
  strict: boolean;
  transform: boolean;
  abortEarly: boolean;
  recursive: boolean;
  allowUnknown: boolean;
  stripUnknown: boolean;
  context: Record<string, any>;
}

export interface ConditionOptionsWithThen {
  is: AnySchema;
  then: AnySchema;
  else?: AnySchema;
}

export interface ConditionOptionsWithElse {
  is: AnySchema;
  then?: AnySchema;
  else: AnySchema;
}

export type ConditionOptions = ConditionOptionsWithThen | ConditionOptionsWithElse;

export type Condition = (ancestors: object[], context: Record<string, any>) => AnySchema;

export type ErrorCustomizerFunction = (
  type: string,
  state: State,
  context: Record<string, any>,
  data: Record<string, any>,
) => string | Error;

export interface DefautOptions {
  literal?: boolean;
}

export interface ResultFailed {
  value: null;
  errors: LyraValidationError[];
}

export interface ResultPass<T> {
  value: T;
  errors: null;
}

export type Result<T> = ResultFailed | ResultPass<T>;

export type SchemaMap<T> = {
  [K in keyof T]: AnySchema<T[K]>;
};

export abstract class AnySchema<T = any> {
  _type: string;
  _flags: Record<string, any>;
  _messages: Record<string, string>;
  _label: string | null;
  _default: unknown | undefined;
  _valids: Set<unknown>;
  _invalids: Set<unknown>;
  _conditions: Condition[];
  _refs: ExtractedRef[];
  _rules: Rule<T>[];
  _transformations: Transformation<T>[];
  constructor(type?: string);
  abstract check(value: unknown): value is T;
  coerce?(value: unknown): Result<T>;
  clone(): this;
  merge(schema?: AnySchema): this;
  _generate(state: State, opts: ValidatorOptions, schema?: AnySchema): AnySchema;
  error(
    type: string,
    state: State,
    context: Record<string, any>,
    data: Record<string, any>,
  ): LyraValidationError;
  test(rule: Rule<T>): this;
  transform(transformation: Transformation<T>): this;
  strip(): this;
  required(): this;
  forbidden(): this;
  default(value: unknown, opts?: DefautOptions): this;
  label(label: string): this;
  valid(...values: unknown[]): this;
  invalid(...values: unknown[]): this;
  when(ref: Ref, opts: ConditionOptions): this;
  errors(customizer: string | Error | ErrorCustomizerFunction): this;
  _validate(value: unknown, opts: ValidatorOptions, state: State): Result<T>;
  validate(value: unknown, opts?: ValidatorOptions): Result<T>;
}

export class ArraySchema<T> extends AnySchema<T[]> {
  _inner: AnySchema<T> | null;
  constructor(inner: AnySchema<T>);
  check(value: unknown): value is T[];
  coerce(value: unknown): Result<T[]>;
  length(length: number | Ref): this;
  min(length: number | Ref): this;
  max(length: number | Ref): this;
  reverse(): this;
}

export class BooleanSchema extends AnySchema<boolean> {
  check(value: unknown): value is boolean;
  coerce(value: unknown): Result<boolean>;
  truthy(): this;
  falsy(): this;
}

export class DateSchema extends AnySchema<Date> {
  check(value: unknown): value is Date;
  coerce(value: unknown): Result<Date>;
  older(date: 'now' | Date | Ref): this;
  newer(date: 'now' | Date | Ref): this;
}

export class FunctionSchema<T extends Function> extends AnySchema<T> {
  check(value: unknown): value is T;
  inherit(ctor: Function | Ref): this;
}

export class NumberSchema extends AnySchema<number> {
  check(value: unknown): value is number;
  coerce(value: unknown): Result<number>;
  integer(): this;
  min(num: number | Ref): this;
  max(num: number | Ref): this;
  multiple(num: number | Ref): this;
  divide(num: number | Ref): this;
  greater(num: number | Ref): this;
  smaller(num: number | Ref): this;
}

export class ObjectSchema<T extends object> extends AnySchema<T> {
  _inner: SchemaMap<T> | null;
  constructor(inner: SchemaMap<T>);
  check(value: unknown): value is T;
  coerce(value: unknown): Result<T>;
  length(length: number | Ref): this;
  min(length: number | Ref): this;
  max(length: number | Ref): this;
  instance(ctor: Function | Ref): this;
  and(...peers: Ref[]): this;
  nand(...peers: Ref[]): this;
  or(...peers: Ref[]): this;
  xor(...peers: Ref[]): this;
  oxor(...peers: Ref[]): this;
}

export class StringSchema extends AnySchema<string> {
  check(value: unknown): value is string;
  coerce(value: unknown): Result<string>;
  length(length: number | Ref): this;
  min(length: number | Ref): this;
  max(length: number | Ref): this;
  creditCard(): this;
  pattern(regex: RegExp | Ref): this;
  email(): this;
  url(): this;
  alphanum(): this;
  numeric(): this;
  _pattern(regex: RegExp | Ref, type: string): this;
  uppercase(): this;
  lowercase(): this;
  trim(): this;
  reverse(): this;
  replace(pattern: string | RegExp, replacement: string): this;
}

export default class Lyra {
  static any(): AnySchema;
  static boolean(): BooleanSchema;
  static string(): StringSchema;
  static date(): DateSchema;
  static number(): NumberSchema;
  static array<T>(inner: AnySchema<T>): ArraySchema<T>;
  static function<T extends Function>(): FunctionSchema<T>;
  static object<T extends object>(inner: SchemaMap<T>): ObjectSchema<T>;
  static ref(path: string): Ref;
}
