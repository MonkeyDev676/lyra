import Ref from '../Ref';
import AnySchema from '../schemas/AnySchema';
import LyraValidationError from '../errors/LyraValidationError';

export interface LooseObject {
  [key: string]: any;
}

export interface Constructor<T> {
  new (...args: any[]): T;
}

export interface SchemaRuleArguments<T, P> {
  value: T;
  deps: P;
  raw: unknown;
  context: object;
}

export type DepMap<T> = {
  [K in keyof T]: T[K] | Ref<T[K]>;
};

export interface SchemaRule<T, P = any> {
  deps?: DepMap<P>;
  type: string;
  message?: string;
  validate: (arg: SchemaRuleArguments<T, P>) => boolean;
}

export type SchemaMap<T> = {
  [K in keyof T]: AnySchema<T[K]>;
};

export interface ValidationResultPassed<T> {
  value: T | null;
  pass: true;
  errors: null;
}

export interface ValidationResultFailed {
  value: null;
  pass: false;
  errors: LyraValidationError[];
}

export type ValidationResult<T> = ValidationResultPassed<T> | ValidationResultFailed;

export interface ValidatorOptions {
  strict?: boolean;
  abortEarly?: boolean;
  stripUnknown?: boolean;
  recursive?: boolean;
  context?: object;
  path?: string;
  parent?: unknown;
}
