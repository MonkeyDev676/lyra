import AnySchema from './schemas/AnySchema';
import BooleanSchema from './schemas/BooleanSchema';
import StringSchema from './schemas/StringSchema';
import DateSchema from './schemas/DateSchema';
import NumberSchema from './schemas/NumberSchema';
import ArraySchema from './schemas/ArraySchema';
import FunctionSchema from './schemas/FunctionSchema';
import ObjectSchema from './schemas/ObjectSchema';
import Ref from './Ref';

class Lyra {
  static any() {
    return new AnySchema();
  }

  static boolean() {
    return new BooleanSchema();
  }

  static string() {
    return new StringSchema();
  }

  static date() {
    return new DateSchema();
  }

  static number() {
    return new NumberSchema();
  }

  static array(inner) {
    return new ArraySchema(inner);
  }

  static function() {
    return new FunctionSchema();
  }

  static object(inner) {
    return new ObjectSchema(inner);
  }

  static ref(path) {
    return new Ref(path);
  }
}

export default Lyra;
