import AnySchema from '../schemas/AnySchema';
import LyraValidationError from '../errors/LyraValidationError';

export interface SchemaRuleArguments<T> {
  value: T;
  raw: unknown;
  context: object;
}

export interface SchemaRule<T> {
  type: string;
  message?: string;
  validate: (arg: SchemaRuleArguments<T>) => boolean;
}

export type SchemaMap<T> = {
  [K in keyof T]: AnySchema<T[K]>;
};

export interface LooseObject {
  [key: string]: any;
}

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
