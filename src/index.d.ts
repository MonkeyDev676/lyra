interface LooseObject {
  [key: string]: unknown;
}

type LooseArray = unknown[];

interface State {
  path?: string;
  depth?: number;
  ancestors: object[];
}

type ExtractedRef = [number, string, string | undefined];

interface RuleArgs<T, P> {
  value: T;
  params: P;
  context: object;
}

type RuleAssert = (resolved: unknown) => [boolean, string];

type RuleParams<T> = {
  [K in keyof T]: {
    value: T[K] | Ref<T[K]>;
    assert: string | RuleAssert;
  };
};

interface Rule<T, P = {}> {
  params?: RuleParams<P>;
  type: string;
  validate: (args: RuleArgs<T, P>) => boolean;
}

type Transformation<T> = (value: T) => T;

type ConditionOptions =
  | {
      is: AnySchema;
      then: AnySchema;
      else?: AnySchema;
    }
  | {
      is: AnySchema;
      then?: AnySchema;
      else: AnySchema;
    };

type Condition = (
  value: LooseObject | LooseArray,
  ancestors: object[],
  context: LooseObject,
) => AnySchema;

type ErrorCustomizer = (
  type: string,
  state: State,
  context: LooseObject,
  data: LooseObject,
) => string | Error;

interface DefautOptions {
  literal?: boolean;
}

type Result<T> =
  | {
      value: null;
      errors: LyraValidationError[];
    }
  | {
      value: T;
      errors: null;
    };

type SchemaMap<T> = {
  [K in keyof T]: AnySchema<T[K]>;
};

interface ValidatorOptions {
  /**
   * Whether to coerce a value before validating.
   */
  strict?: boolean;

  /**
   * Whether to apply transformations on a value.
   */
  transform?: boolean;

  /**
   * Whether to stop validating on the first error.
   */
  abortEarly?: boolean;

  /**
   * Whether to validate inner (nested) schemas.
   */
  recursive?: boolean;

  /**
   * Whether to allow a value to have keys that are not specified inside an object schema.
   */
  allowUnknown?: boolean;

  /**
   * Whether to strip keys that are not specified inside an object schema.
   */
  stripUnknown?: boolean;

  /**
   * Validation context.
   */
  context?: LooseObject;
}

export class LyraError extends Error {
  name: 'LyraError';

  /**
   * The error that is thrown when assertion fails
   */
  constructor();
}

export class LyraValidationError extends Error {
  name: 'LyraValidationError';

  /**
   * The type of the rule that fails.
   */
  type: string;

  /**
   * The path to the schema that fails.
   */
  path: string | null;

  /**
   * The depth of the schema that fails.
   */
  depth: number | null;

  /**
   * The ancestors of the schema that fails.
   */
  ancestors: object[];

  /**
   * The error that is returned when validation fails. Used internally.
   * @param message The message of the error.
   * @param type The type of the schema that fails.
   * @param state The validation state.
   */
  constructor(message: string, type: string, state: State);
}

export class Values {
  /**
   * The values of the collection.
   */
  _values: Set<unknown>;

  /**
   * The references of the collection.
   */
  _refs: Set<unknown>;

  /**
   * The utility collection that manages values and references. Used internally.
   */
  constructor();

  /**
   * The size of the collection.
   */
  get size(): number;

  /**
   * Merges a source collection to the current collection and remove all the specified items.
   * @param source The collection of items to merge.
   * @param remove The collection of items to remove.
   */
  merge(source: Values, remove: Values): this;

  /**
   * Adds items to the collection.
   * @param values The values to add.
   */
  add(...items: LooseArray): this;

  /**
   * Deletes items from the collection.
   * @param values The values to delete.
   */
  delete(...items: LooseArray): this;

  /**
   * Checks if the collection has a value. Resolve references if needed.
   * @param value The value to check.
   */
  has(value: unknown): boolean;

  /**
   * Returns an array of items of the collection.
   */
  values(): LooseArray;
}

export class Ref<T = unknown> {
  /**
   * The type of the reference.
   *
   * - "Value" indicates that the reference points to a value inside the schema. For example: `a.b`, `.a.b`, `..a.b`.
   * - "Context" indicates that the reference points to a value inside the context. For example: '$a.b'.
   */
  _type: 'value' | 'context';

  /**
   * The processed path.
   */
  _enhancedPath: string;

  /**
   * The full path of the reference.
   */
  _path: string;

  /**
   * The index of the ancestor to look up.
   */
  _ancestor: number | null;

  /**
   * The root of the reference.
   */
  _root: string;

  /**
   * The display string of the reference.
   */
  _display: string;

  /**
   * Creates a reference that points to a value. Used internally.
   * @param path The path to the value.
   */
  constructor(path: string);

  /**
   * Resolves the reference.
   * @param value The value to look up.
   * @param context The context to look up.
   * @param ancestors The ancestors to look up.
   */
  resolve(value: LooseObject | LooseArray, context: LooseObject, ancestors: object[]): T;
}

export abstract class AnySchema<T = any> {
  /**
   * The type of the schema.
   */
  _type: string;

  /**
   * The flags of the schema.
   */
  _flags: LooseObject;

  /**
   * The error messages of the schema.
   */
  _messages: Record<string, string>;

  /**
   * The label of the schema.
   */
  _label: string | null;

  /**
   * The default value of the schema.
   */
  _default: unknown | undefined;

  /**
   * The valid (allowed) values of the schema.
   */
  _valids: Values;

  /**
   * The invalid (denied) values of the schema.
   */
  _invalids: Values;

  /**
   * The conditions of the schema.
   */
  _conditions: Condition[];

  /**
   * The extracted references of the schema.
   */
  _refs: ExtractedRef[];

  /**
   * The validation rules of the schema.
   */
  _rules: Rule<T>[];

  /**
   * The transformations of the schema.
   */
  _transformations: Transformation<T>[];

  /**
   * The schema that represents any data type.
   * @param type The type of the schema.
   */
  constructor(type?: string);

  /**
   * Checks if the value is the base type.
   * @param value The value to check.
   */
  abstract check(value: unknown): value is T;

  /**
   * Coerces the value to the base type, if possible.
   * @param value The value to coerce.
   */
  coerce?(value: unknown): Result<T>;

  /**
   * Clones the schema.
   */
  clone(): this;

  /**
   * Merges another schema to the current schema.
   * @param schema The schema to merge.
   */
  merge(schema?: AnySchema): this;

  /**
   * Creates a validation error.
   * @param type The type of the error.
   * @param state The validation state.
   * @param context The context of validation.
   * @param data The optional data to populate the message with.
   */
  error(type: string, state: State, context: LooseObject, data: LooseArray): LyraValidationError;

  /**
   * Adds a rule to the schema.
   * @param rule The rule to add.
   */
  test<P = {}>(rule: Rule<T, P>): this;

  /**
   * Adds a transformation to schema.
   * @param transformation The transformation to add.
   */
  transform(transformation: Transformation<T>): this;

  /**
   * Marks the schema so that it can be strip off after validation.
   */
  strip(): this;

  /**
   * Marks the schema as required.
   */
  required(): this;

  /**
   * Marks the schema as forbidden.
   */
  forbidden(): this;

  /**
   * Specifies a default value for the schema.
   * @param value The default value.
   * @param opts The options for assigning default.
   */
  default(value: unknown, opts?: DefautOptions): this;

  /**
   * Specifies a label for the schema.
   * @param label The label of the schema.
   */
  label(label: string): this;

  /**
   * Internal method for specifying valid and invalid values.
   * @param type The type of values.
   * @param values The specified values.
   */
  _values(type: 'valid' | 'invalid', values: LooseArray): this;

  /**
   * Specifies a set of valid (allowed) values.
   * @param values The valid (allowed) values.
   */
  valid(...values: LooseArray): this;

  /**
   * Specifies a set of invalid (denied) values.
   * @param values The invalid (denied) values.
   */
  invalid(...values: LooseArray): this;

  /**
   * Specifies a schema to merge with if a condition is met.
   * @param ref The reference to a value to perform the condition on.
   * @param opts The condition builder options.
   */
  when(ref: Ref, opts: ConditionOptions): this;

  /**
   * Overrides the default validation error with a customizer.
   * @param customizer The error customizer.
   */
  errors(customizer: string | Error | ErrorCustomizer): this;

  /**
   * Validates inner (nested) schemas.
   * @param value The value to validate.
   * @param opts The validator options.
   * @param state The validation state.
   * @param schema The schema to validate against
   */
  _validateInner?(
    value: unknown,
    opts: ValidatorOptions,
    state: State,
    schema: AnySchema,
  ): Result<T>;

  /**
   * Validates a value based against a constructed schema.
   * @param value The value to validate.
   * @param opts The validator options.
   * @param state The validation state.
   */
  _validate(value: unknown, opts: ValidatorOptions, state: State): Result<T>;

  /**
   * Validates a value based against a constructed schema.
   * @param value The value to validate.
   * @param opts The validator options.
   */
  validate(value: unknown, opts?: ValidatorOptions): Result<T>;
}

export class ArraySchema<T> extends AnySchema<T[]> {
  /**
   * The inner schema.
   */
  _inner: AnySchema<T> | null;

  /**
   * The schema that represents the array data type.
   * @param inner The inner schema.
   */
  constructor(inner?: AnySchema<T>);
  check(value: unknown): value is T[];
  coerce(value: unknown): Result<T[]>;

  /**
   * Specifies an exact number of items an array must have.
   * @param length The exact length.
   */
  length(length: number | Ref<number>): this;

  /**
   * Specifies a minimum number of items an array must have.
   * @param length The minimum length.
   */
  min(length: number | Ref<number>): this;

  /**
   * Specifies a maximum number of items an array must have.
   * @param length The maximum length.
   */
  max(length: number | Ref<number>): this;

  /**
   * Reverses an array.
   */
  reverse(): this;
}

export class BooleanSchema extends AnySchema<boolean> {
  /**
   * The schema that represents the boolean data type.
   */
  constructor();
  check(value: unknown): value is boolean;
  coerce(value: unknown): Result<boolean>;

  /**
   * Specifies that a boolean must be truthy.
   */
  truthy(): this;

  /**
   * Specifies that a boolean must be falsy.
   */
  falsy(): this;
}

export class DateSchema extends AnySchema<Date> {
  /**
   * The schema that repesents the JS Date object.
   */
  constructor();
  check(value: unknown): value is Date;
  coerce(value: unknown): Result<Date>;

  /**
   * Specifies that a date must be older than another.
   * @param date The date to compare to.
   */
  older(date: 'now' | Date | Ref<'now' | Date>): this;

  /**
   * Specifies that a date must be newer than another.
   * @param date The date to compare to.
   */
  newer(date: 'now' | Date | Ref<'now' | Date>): this;
}

export class FunctionSchema extends AnySchema<Function> {
  /**
   * The schema that represents the function data type.
   */
  constructor();
  check(value: unknown): value is T;

  /**
   * Specifies that a function must inherit another constructor function.
   * @param ctor The constructor to check.
   */
  inherit(ctor: Function | Ref<Function>): this;
}

export class NumberSchema extends AnySchema<number> {
  /**
   * The schema that represents the number data type.
   */
  constructor();
  check(value: unknown): value is number;
  coerce(value: unknown): Result<number>;

  /**
   * Specifies that a number must be an integer.
   */
  integer(): this;

  /**
   * Specifies a minimum value for a number.
   * @param num The minimum value.
   */
  min(num: number | Ref<number>): this;

  /**
   * Specifies a maximum value for a number.
   * @param num The maximum value.
   */
  max(num: number | Ref<number>): this;

  /**
   * Specifies that a number must be a multiple of another.
   * @param num The number to check.
   */
  multiple(num: number | Ref<number>): this;

  /**
   * Specifies that a number must divide another.
   * @param num The number to check.
   */
  divide(num: number | Ref<number>): this;

  /**
   * Specifies that a number must be greater than another
   * @param num The number to compare to.
   */
  greater(num: number | Ref<number>): this;

  /**
   * Specifies that a number must be smaller than another
   * @param num The number to compare to.
   */
  smaller(num: number | Ref<number>): this;
}

export class ObjectSchema<T extends object> extends AnySchema<T> {
  /**
   * The inner schemas.
   */
  _inner: SchemaMap<T> | null;

  /**
   * The schema that repesents the object data type
   * @param inner The inner schemas.
   */
  constructor(inner?: SchemaMap<T>);
  check(value: unknown): value is T;
  coerce(value: unknown): Result<T>;

  /**
   * Specifies an exact number of entries an object must have.
   * @param length The exact number of entries.
   */
  length(length: number | Ref<number>): this;

  /**
   * Specifies a minimum number of entries an object must have.
   * @param length The minimum number of entries.
   */
  min(length: number | Ref<number>): this;

  /**
   * Specifies a maximum number of entries an object must have.
   * @param length The maximum number of entries.
   */
  max(length: number | Ref<number>): this;

  /**
   * Specifies that an object must be an instance of a constructor function.
   * @param ctor The constructor to check.
   */
  instance(ctor: Function | Ref<Function>): this;

  /**
   * Adds a dependency validation rule.
   * @param type The dependency type.
   * @param peers The peers to validate.
   * @param validate The validation rule.
   */
  _addDependency(
    type: string,
    peers: Ref[],
    validate: (
      value: LooseObject | LooseArray,
      ancestors: object[],
      context: LooseObject,
    ) => undefined | { peers: Ref[] },
  ): this;

  /**
   * Specifies an "and" dependency where all the peers are required.
   * @param peers The peers to validate.
   */
  and(...peers: Ref[]): this;

  /**
   * Specifies an "nand" dependency where not all the peers (entries) are required.
   * @param peers The peers to validate.
   */
  nand(...peers: Ref[]): this;

  /**
   * Specifies an "or" dependency where at least one of the peers (entries) is required.
   * @param peers The peers to validate.
   */
  or(...peers: Ref[]): this;

  /**
   * Specifies an "xor" dependency where exactly one of the peers (entries) is required.
   * @param peers The peers to validate.
   */
  xor(...peers: Ref[]): this;

  /**
   * Specifies an "oxor" dependency where exactly one of the peers (entries) is allowed.
   * @param peers The peers to validate.
   */
  oxor(...peers: Ref[]): this;
}

export class StringSchema extends AnySchema<string> {
  /**
   * The schema that represents the string data type.
   */
  constructor();
  check(value: unknown): value is string;
  coerce(value: unknown): Result<string>;

  /**
   * Specifies an exact length a string must have.
   * @param length The exact length.
   */
  length(length: number | Ref): this;

  /**
   * Specifies a minimum length a string must have.
   * @param length The minimum length.
   */
  min(length: number | Ref): this;

  /**
   * Specifies a maximum length a string must have.
   * @param length The maximum length.
   */
  max(length: number | Ref): this;

  /**
   * Specfies that a string must be a credit card number.
   */
  creditCard(): this;

  /**
   * Specifies a regular expression pattern a string must match.
   * @param regex The regular expression pattern to match against.
   */
  pattern(regex: RegExp | Ref): this;

  /**
   * Specifies that a string must be an email.
   */
  email(): this;

  /**
   * Specifies that a string must be a URL.
   */
  url(): this;

  /**
   * Specifies that a string must only contain alpha-numeric characters.
   */
  alphanum(): this;

  /**
   * Specifies that a string must only contain numeric characters.
   */
  numeric(): this;

  /**
   * Internal method for matching regular expression patterns
   * @param regex The regular expression pattern to match against
   * @param type The type of the validation rule.
   */
  _pattern(regex: RegExp | Ref, type: string): this;

  /**
   * Transforms a string to uppercase.
   */
  uppercase(): this;

  /**
   * Transforms a string to lowercase.
   */
  lowercase(): this;

  /**
   * Trims a string.
   */
  trim(): this;

  /**
   * Reverses a string.
   */
  reverse(): this;

  /**
   * Replace characters of a string given a pattern.
   * @param pattern A string or a regular expression to match against.
   * @param replacement The replacement to the matches.
   */
  replace(pattern: string | RegExp, replacement: string): this;
}

export class Utils {
  /**
   * Checks if a value is an instance of `AnySchema`.
   * @param value The value to check.
   */
  static isSchema(value: unknown): value is AnySchema;

  /**
   * Checks if a value is an instance of `Ref`.
   * @param value The value to check.
   */
  static isRef(value: unknown): value is Ref;

  /**
   * Checks if a value is an instance of `Values`.
   * @param value The value to check.
   */
  static isValues(value: unknown): value is Values;

  /**
   * Throws an error if a condition is not met.
   * @param condition The condition to check.
   * @param message The message of the error.
   */
  static assert(condition: boolean, message: string): void;

  /**
   * Gets the determiner of a word.
   * @param word The word to get the determiner from.
   */
  static getDeterminer(word: string): 'an' | 'a';

  /**
   * Serializes a value.
   * @param value The value to serialize.
   */
  static serialize(value: unknown): string;
}

export default class Lyra {
  /**
   * Constructs a schema representing any data type.
   */
  static any<T = any>(): AnySchema<T>;

  /**
   * Constructs a schema representing the boolean data type.
   */
  static boolean(): BooleanSchema;

  /**
   * Constructs a schema representing the string data type.
   */
  static string(): StringSchema;

  /**
   * Constructs a schema representing the JS Date objects.
   */
  static date(): DateSchema;

  /**
   * Constructs a schema representing the number data type.
   */
  static number(): NumberSchema;

  /**
   * Constructs a schema representing the array data type.
   * @param inner The inner schema.
   */
  static array<T>(inner?: AnySchema<T>): ArraySchema<T>;

  /**
   * Constructs a schema representing the function data type.
   */
  static function(): FunctionSchema;

  /**
   * Constructs a schema representing the object data type.
   * @param inner The inner schemas.
   */
  static object<T extends object>(inner?: SchemaMap<T>): ObjectSchema<T>;

  /**
   * Creates a reference that points to a value.
   * @param path The path to the value.
   */
  static ref(path: string): Ref;
}
