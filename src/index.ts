import AnySchema from './schemas/AnySchema';
import BooleanSchema from './schemas/BooleanSchema';
import StringSchema from './schemas/StringSchema';
import DateSchema from './schemas/DateSchema';
import NumberSchema from './schemas/NumberSchema';
import ArraySchema from './schemas/ArraySchema';
import FunctionSchema from './schemas/FunctionSchema';
import ObjectSchema from './schemas/ObjectSchema';
import Ref from './Ref';
import { SchemaMap, LooseObject } from './types';

export default class Lyra {
  public static any<T = any>() {
    return new AnySchema<T>();
  }

  public static boolean() {
    return new BooleanSchema();
  }

  public static string() {
    return new StringSchema();
  }

  public static date() {
    return new DateSchema();
  }

  public static number() {
    return new NumberSchema();
  }

  public static array<T>(schema?: AnySchema<T>) {
    return new ArraySchema(schema);
  }

  public static function<T extends Function>() {
    return new FunctionSchema<T>();
  }

  public static object<T extends LooseObject>(schemaMap?: SchemaMap<T>) {
    return new ObjectSchema(schemaMap);
  }

  public static ref(path: string) {
    return new Ref(path);
  }
}
