declare class _ValidationError<M> extends Error {
  name: 'ValidationError';
  code: keyof M;
  path: string;
  depth: number;
  ancestors: unknown[];
}

declare class _State {
  dive(ancestor: unknown, path: string): _State;
}

interface ValidationOptions {
  readonly strict?: boolean;
  readonly abortEarly?: boolean;
  readonly recursive?: boolean;
  readonly allowUnknown?: boolean;
  readonly stripUnknown?: boolean;
  readonly context?: {
    [K: string]: unknown;
  };
}

type Messages<M> = {
  [K in
    | 'any.required'
    | 'any.forbidden'
    | 'any.default'
    | 'any.ref'
    | 'any.only'
    | 'any.invalid']?: string;
} &
  M;

interface FlagOptions {
  readonly clone?: boolean;
}

interface RuleOptions {
  readonly name: string;
  readonly method?: string;
  readonly clone?: boolean;
  readonly args?: {
    [K: string]: unknown;
  };
}

type IndexExtensionOptions<T, F, I, M> = {
  [K in keyof I]: {
    readonly value?: I[K][];
    readonly merge?:
      | boolean
      | ((
          target: I[K][],
          src: I[K][],
          targetSchema: _Base<T, F, I, M>,
          srcSchema: _Base<T, F, I, M>,
        ) => I[K][]);
    readonly describe?: (term: I[K]) => unknown;
  };
};

type DefinitionMethod<T, F, I, M> = (
  value: unknown,
  helpers: {
    schema: _Base<T, F, I, M>;
    state: _State;
    opts: ValidationOptions;
    original: unknown;
    error: (code: keyof Messages<M>) => _ValidationError<Messages<M>>;
  },
) => unknown;

interface RuleExtensionOptions<T, F, I, M> {
  [K: string]: {
    method?: ((this: _Base<T, F, I, M>, ...args: any[]) => _Base<T, F, I, M>) | false;
    validate?: DefinitionMethod<T, F, I, M>;
  };
}

interface ExtensionOptions<T, F, I, M> {
  readonly type: T;
  readonly flags?: F;
  readonly index?: IndexExtensionOptions<T, F, I, M>;
  readonly messages?: Messages<M>;
  readonly prepare?: DefinitionMethod<T, F, I, M>;
  readonly coerce?: DefinitionMethod<T, F, I, M>;
  readonly validate?: DefinitionMethod<T, F, I, M>;
  readonly rebuild?: (schema: _Base<T, F, I, M>) => void;
  readonly rules?: RuleExtensionOptions<T, F, I, M>;
}

// T = type, F = flags, I = index, M = messages
declare class _Base<T, F = unknown, I = unknown, M = unknown> {
  type: T;
  $index: {
    [K in keyof I]: I[K][];
  };

  // Extensions
  $clone(): this;
  $merge(src: this): this;
  $getFlag<K extends keyof F>(name: F): F[K];
  $setFlag<K extends keyof F>(name: F, value: unknown, opts?: FlagOptions): this;
  $rebuild(): this;
  $references(): [0, string];
  $addRule(opts: RuleOptions): this;

  extend<T, F, I, M>(opts: ExtensionOptions<T, F, I, M>): _Base<T, F, I, M>;
}

declare function base<T, F, I, M>(): _Base<T, F, I, M>;
declare function isSchema<T, F, I, M>(value: unknown): value is _Base<T, F, I, M>;

export { base, isSchema };
