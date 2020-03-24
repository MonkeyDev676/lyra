// Utility types
interface LooseObject<T = unknown> {
  [K: string]: T;
}

type Referenceable<T> = T | _Ref;

// Refs
declare namespace ref {
  interface Options {
    readonly separator?: string;
  }

  interface Description {
    readonly root: string;
    readonly path: string;
    readonly separator: string;
  }
}

declare class _Ref {
  resolve(value: unknown, ancestors: readonly unknown[], context: object): unknown;
  describe(): ref.Description;
}

declare function ref(path: string, opts?: ref.Options): _Ref;

declare function isRef(value: unknown): value is _Ref;

export { ref, isRef };

// Symbols
declare namespace symbols {
  const next: symbol;

  const deepDefault: symbol;

  const removeFlag: symbol;
}

export { symbols };

// Base
declare namespace base {
  interface SetFlagOptions {
    readonly clone?: boolean;
  }

  interface AddRuleOptions {
    readonly name: string;
    readonly method?: string;
    readonly clone?: boolean;
    readonly args?: object;
  }

  interface ValidationOptions {
    readonly strict?: boolean;
    readonly abortEarly?: boolean;
    readonly recursive?: boolean;
    readonly allowUnknown?: boolean;
    readonly stripUnknown?: boolean;
    readonly context?: object;
  }

  type Presence = 'optional' | 'required' | 'forbidden';

  interface Helpers {
    readonly schema: _Base;
    readonly state: _State;
    readonly opts: ValidationOptions;
    readonly original: unknown;
    readonly error: (code: string, terms?: object, divedState?: _State) => _ValidationError;
  }

  type IndexExtendOptions<I> = {
    [K in keyof I]: {
      readonly value?: I[K];
      readonly merge?:
        | boolean
        | ((target: I[K], src: I[K], targetSchema: _Base, srcSchema: _Base) => I[K]);
      readonly describe?: (term: I[K] extends [infer U][] ? U : never) => unknown;
    };
  };

  type ArgumentExtendOptions<A> = {
    [K in keyof A]: {
      readonly ref?: boolean;
      readonly assert?: (arg: unknown) => arg is A[K];
      readonly reason?: string;
    };
  };

  type RuleExtendOptions<R> = {
    [K in keyof R]: {
      readonly alias?: string[];
      readonly priority?: boolean;
      readonly single?: boolean;
      // Identity function needed due to Typescript's design limitation
      // https://stackoverflow.com/questions/60800110/typescript-failed-to-infer-generic-type/60807317#60807317
      readonly args?: ArgumentExtendOptions<R[K]>;
      readonly method?: false | ((this: _Base, ...args: any[]) => _Base);
      readonly validate?: (
        value: unknown,
        helpers: Helpers & {
          name: string;
          args: R[K];
        },
      ) => unknown;
    };
  };

  interface ExtendOptions<I, R> {
    readonly type: string;
    readonly flags?: object;
    readonly index?: IndexExtendOptions<I>;
    readonly messages?: LooseObject<string>;
    readonly prepare?: (value: unknown, helpers: Helpers) => unknown;
    readonly coerce?: (value: unknown, helpers: Helpers) => unknown;
    readonly validate?: (value: unknown, helpers: Helpers) => unknown;
    readonly rebuild?: (schema?: _Base) => void;
    readonly rules?: RuleExtendOptions<R>;
  }

  interface RuleDescription {
    readonly name: string;
    readonly args: LooseObject;
  }

  interface Description extends LooseObject {
    readonly type: string;
    readonly flags?: LooseObject;
    readonly rules?: readonly RuleDescription[];
    readonly opts?: Readonly<base.ValidationOptions>;
    readonly valids?: readonly unknown[];
    readonly invalids?: readonly unknown[];
  }

  interface DefaultOptions {
    readonly literal?: boolean;
  }

  type ErrorCustomizer =
    | string
    | Error
    | ((code: string, state: _State, context: LooseObject, terms: LooseObject) => string | Error);

  interface WhenOptions {
    readonly is: _Base;
    readonly then?: _Base;
    readonly otherwise?: _Base;
  }

  interface PassValidationResult {
    readonly result: unknown;
    readonly errors: null;
  }

  interface ErrorValidationResult {
    readonly result: null;
    readonly error: readonly _ValidationError[];
  }

  type ValidationResult = PassValidationResult & ErrorValidationResult;
}

declare class _ValidationError extends Error {
  name: 'ValidationError';
  code: string;
  path: string | null;
  depth: number;
  ancestors: readonly unknown[];
}

declare class _State {
  dive(ancestor: unknown, path: string): _State;
}

declare class _Base {
  type: string;
  $index: LooseObject<unknown[]>;

  // Extensions
  $clone(): this;
  $merge(src: this): this;
  $getFlag(name: string): unknown;
  $setFlag(name: string, value: unknown, opts?: base.SetFlagOptions): this;
  $rebuild(): this;
  $references(): readonly string[];
  $addRule(opts: base.AddRuleOptions): this;
  $validate(
    value: unknown,
    opts: base.ValidationOptions,
    state: _State,
    overrides?: object,
  ): base.ValidationResult;

  extend<I extends LooseObject<unknown[]>, R extends LooseObject<LooseObject>>(
    opts: base.ExtendOptions<I, R>,
  ): this;
  describe(): base.Description;
  opts(opts: base.ValidationOptions): this;
  presence(presence: base.Presence): this;
  optional(): this;
  required(): this;
  forbidden(): this;
  default(value: unknown, opts?: base.DefaultOptions): this;
  label(label: string): this;
  only(enabled?: boolean): this;
  valid(...values: unknown[]): this;
  invalid(...values: unknown[]): this;
  error(customizer: base.ErrorCustomizer): this;
  exists(): Any;
  present(): Any;
  allow(...values: unknown[]): Any;
  equal(...values: unknown[]): Any;
  is(...values: unknown[]): Any;
  deny(...values: unknown[]): Any;
  disallow(...values: unknown[]): Any;
  not(...values: unknown[]): Any;
  options(opts: base.ValidationOptions): Any;
  prefs(opts: base.ValidationOptions): Any;
  preferences(opts: base.ValidationOptions): Any;
  validate(value: unknown, opts?: base.ValidationOptions): base.ValidationResult;
  attempt(value: unknown, opts?: base.ValidationOptions): base.PassValidationResult | never;
  when(ref: string | _Ref, opts: base.WhenOptions): this;
}

declare function base(): _Base;
declare function isSchema(value: unknown): value is _Base;

export { base, isSchema };

// Identities
declare function args<A>(args: base.ArgumentExtendOptions<A>): base.ArgumentExtendOptions<A>;

export { args };

// Schemas
// any
declare const any: _Base & {
  annotate(...notes: string[]): _Base;
  strip(enabled?: boolean): _Base;
  custom(method: (value: unknown, helpers: base.Helpers) => unknown, name: string): _Base;
};

export { any };

type Any = typeof any;

// alternatives
declare namespace alternative {
  type Mode = 'one' | 'all' | 'any';
}

declare const alternative: Any & {
  try(...items: Any[]): Any;
  match(mode: alternative.Mode): Any;
};

export { alternative, alternative as alt };

// array
declare const array: Any & {
  items(...items: Any[]): Any;
  of(...items: Any[]): Any;
  ordered(...items: Any[]): Any;
  tuple(...items: Any[]): Any;
  sparse(enabled?: boolean): Any;
  length(length: Referenceable<number>): Any;
  min(length: Referenceable<number>): Any;
  max(length: Referenceable<number>): Any;
};

export { array, array as arr };

// boolean
declare const boolean: Any & {
  sensitive(enabled?: boolean): Any;
  truthy(): Any;
  falsy(): Any;
};

export { boolean, boolean as bool };

// date
declare namespace date {
  type DateArgument = Referenceable<'now' | Date>;
}

declare const date: Any & {
  max(date: date.DateArgument): Any;
  min(date: date.DateArgument): Any;
  greater(date: date.DateArgument): Any;
  smaller(date: date.DateArgument): Any;
  less(date: date.DateArgument): Any;
};

// function
declare const func: Any & {
  inherit(ctor: Referenceable<Function>): Any;
};

export { func as function, func };

// number
declare const number: Any & {
  unsafe(enabled?: boolean): Any;
  max(num: Referenceable<number>): Any;
  min(num: Referenceable<number>): Any;
  greater(num: Referenceable<number>): Any;
  smaller(num: Referenceable<number>): Any;
  less(num: Referenceable<number>): Any;
  multiple(num: Referenceable<number>): Any;
  divisible(num: Referenceable<number>): Any;
  factor(num: Referenceable<number>): Any;
  even(): Any;
  divide(num: Referenceable<number>): Any;
};

export { number, number as num };

// object
declare const object: Any & {
  keys(keys: object): Any;
  length(length: Referenceable<number>): Any;
  max(length: Referenceable<number>): Any;
  min(length: Referenceable<number>): Any;
  instance(ctor: Function): Any;
  and(...peers: (string | _Ref)[]): Any;
  nand(...peers: (string | _Ref)[]): Any;
  or(...peers: (string | _Ref)[]): Any;
  xor(...peers: (string | _Ref)[]): Any;
  oxor(...peers: (string | _Ref)[]): Any;
};

export { object, object as obj };

// string
declare const string: Any & {
  length(length: Referenceable<number>): Any;
  min(length: Referenceable<number>): Any;
  max(length: Referenceable<number>): Any;
  creditCard(): Any;
  pattern(pattern: Referenceable<RegExp>): Any;
  email(): Any;
  url(): Any;
  alphanum(): Any;
  numeric(): Any;
  case(dir: 'upper' | 'lower'): Any;
  uppercase(): Any;
  lowercase(): Any;
  trim(): Any;
  replace(pattern: string | RegExp, replacement: string): Any;
};

export { string, string as str };

declare function validate(
  schema: _Base,
  value: unknown,
  opts: base.ValidationOptions,
): base.ValidationResult;
declare function attempt(
  schema: _Base,
  value: unknown,
  opts: base.ValidationOptions,
): base.PassValidationResult | never;
declare function annotate(...notes: string[]): Any;
declare function custom(
  method: (value: unknown, helpers: base.Helpers) => unknown,
  name: string,
): Any;
declare function opts(opts: base.ValidationOptions): Any;
declare function strip(enabled?: boolean): Any;
declare function presence(presence: base.Presence): Any;
declare function optional(): Any;
declare function required(): Any;
declare function forbidden(): Any;
// Reserved word
/*declare function default(): Any;*/
declare function only(enabled?: boolean): Any;
declare function valid(...values: unknown[]): Any;
declare function invalid(...values: unknown[]): Any;
declare function exists(): Any;
declare function present(): Any;
declare function allow(...values: unknown[]): Any;
declare function equal(...values: unknown[]): Any;
declare function is(...values: unknown[]): Any;
declare function deny(...values: unknown[]): Any;
declare function disallow(...values: unknown[]): Any;
declare function not(...values: unknown[]): Any;
declare function options(opts: base.ValidationOptions): Any;
declare function prefs(opts: base.ValidationOptions): Any;
declare function preferences(opts: base.ValidationOptions): Any;
declare function when(ref: _Ref, opts: base.WhenOptions): Any;
declare function note(...notes: string[]): Any;
declare function description(...notes: string[]): Any;

export {
  validate,
  attempt,
  annotate,
  custom,
  opts,
  strip,
  presence,
  optional,
  required,
  forbidden,
  only,
  valid,
  invalid,
  exists,
  present,
  allow,
  equal,
  is,
  deny,
  disallow,
  not,
  options,
  prefs,
  preferences,
  when,
  note,
  description,
};
