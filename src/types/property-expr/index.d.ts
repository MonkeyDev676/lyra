// https://www.npmjs.com/package/property-expr
declare module 'property-expr' {
  type ForEachCallback = (
    pathSegment: string,
    isBracket: boolean,
    isArray: boolean,
    idx: number,
    segments: string[],
  ) => void;

  type Getter = (obj: object) => any;

  type Setter = (obj: object, value: any) => void;

  export class Cache {
    /**
     * An utility class, returns an instance of cache. When the max size is exceeded, cache clears its storage.
     * @param maxSize Max size of the cache
     */
    constructor(maxSize: number);

    /**
     * Clears the cache
     */
    clear(): void;

    /**
     * Returns a cache entry
     * @param key The key of the entry
     */
    get(key: string): any;

    /**
     * Sets a cache entry
     * @param key The key of the entry
     * @param value The value of the entry
     */
    set(key: string, value: any): any;
  }

  /**
   * Returns a normalized expression string pointing to a property on root object `paramName`.
   * ```js
   * expr.expr("foo['bar'][0].baz", true, 'obj') // => "(((obj.foo || {})['bar'] || {})[0])"
   * ```
   * @param expression
   * @param safeAccess
   * @param paramName
   */
  export function expr(expression: string, safeAccess?: boolean, paramName?: string): string;

  /**
   * Iterate through a path but segment, with some additional helpful metadata about the segment. The iterator function is called with: `pathSegment`, `isBracket`, `isArray`, `idx`, `segments`
   * ```js
   * expr.forEach('foo["bar"][1]', function(pathSegment, isBracket, isArray, idx, segments) {
   *   // 'foo'   -> isBracket = false, isArray = false, idx = 0
   *   // '"bar"' -> isBracket = true,  isArray = false, idx = 1
   *   // '0'     -> isBracket = false, isArray = true,  idx = 2
   * })
   * ```
   * @param path The path to iterate through
   * @param cb The callback invoked on each iteration
   * @param thisArg The value used as `this`
   */
  export function forEach(path: string, cb: ForEachCallback, thisArg: any): void;

  /**
   * Returns a function that accepts an obj and returns the value at the supplied expression. You can create a "safe" getter, which won't error out when accessing properties that don't exist, reducing existance checks befroe property access:
   *```js
   * expr.getter('foo.bar.baz', true)({ foo: {} }) // => undefined
   * //instead of val = foo.bar && foo.bar.baz
   *```
   * @param expression The expression for the getter
   * @param safeAccess Whether the getter should access a property safely
   */
  export function getter(expression: string, safeAccess?: boolean): Getter;

  /**
   * Returns a path by joining the path segments
   * @param segments The path segments to join
   */
  export function join(segments: string[]): string;

  /**
   * Returns an array of path segments without quotes and spaces.
   * ```js
   * expr.normalizePath('foo["bar"][ "1" ][2][ " sss " ]')
   * // ['foo', 'bar', '1', '2', ' sss ']
   * ```
   * @param path The path to normalize
   */
  export function normalizePath(path: any): any;

  /**
   * Returns a function that accepts an obj and a value and sets the property pointed to by the expression to the supplied value.
   * @param expression The expression for the setter
   */
  export function setter(expression: string): Setter;

  /**
   * Returns an array of each path segment.
   * ```js
   * expr.split("foo['bar'][0].baz") // [ "foo", "'bar'", "0", "baz"]
   * ```
   * @param path The path to split into segments
   */
  export function split(path: string): string[];
}
