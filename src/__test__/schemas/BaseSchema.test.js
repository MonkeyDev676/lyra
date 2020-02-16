const equal = require('@botbind/dust/dist/equal');
const BaseSchema = require('../../schemas/BaseSchema');
const Ref = require('../../Ref');
const Values = require('../../Values');
const State = require('../../State');
const utils = require('../utils');
const _const = require('../../internals/_constants');

describe('BaseSchema', () => {
  afterEach(() => {
    utils.resetAllRefs();
  });

  describe('BaseSchema.isValid()', () => {
    it('should return true for valid schemas', () => {
      expect(BaseSchema.isValid(new BaseSchema())).toBe(true);
    });

    it('should return false for non schemas', () => {
      expect(BaseSchema.isValid({})).toBe(false);
      expect(BaseSchema.isValid(null)).toBe(false);
      expect(BaseSchema.isValid(undefined)).toBe(false);
    });
  });

  describe('BaseSchema.$clone()', () => {
    it('should not clone terms', () => {
      const schema = new BaseSchema();
      const obj = {};

      schema.$terms = new Map([['x', [obj]]]);

      expect(schema.$clone().$terms.get('x')[0]).toBe(obj);
    });

    it('should clone Values', () => {
      const spy = jest.spyOn(Values.prototype, 'clone');

      new BaseSchema().$clone();

      expect(utils.callWith(spy, { times: 2 })).toBe(true);
      spy.mockRestore();
    });

    it('should clone the schema', () => {
      const schema = new BaseSchema();
      const cloned = schema.$clone();

      expect(cloned).not.toBe(schema);
      expect(equal(schema, cloned, { compareDescriptors: true })).toBe(true);
    });
  });

  describe('BaseSchema.$merge()', () => {
    it('should return the target schema if undefined is passed', () => {
      const schema = new BaseSchema();

      expect(schema.$merge()).toBe(schema);
    });

    it('should return the target schema if the source schema is the same as the target one', () => {
      const schema = new BaseSchema();

      expect(schema.$merge(schema)).toBe(schema);
    });

    it('should throw when incorrect parameters are passed', () => {
      expect(() => new BaseSchema().$merge('x')).toThrow();
    });

    it('should throw when 2 schemas have different types', () => {
      const schema = new BaseSchema();
      const schema2 = new BaseSchema();

      schema.type = 'number';
      schema2.type = 'string';

      expect(() => schema.$merge(schema2)).toThrow();
    });

    it('should clone the target schema', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$clone');

      new BaseSchema().$merge(new BaseSchema());

      expect(utils.callWith(spy)).toBe(true);
      spy.mockRestore();
    });

    it('should use the target type if the source type is any', () => {
      const schema = new BaseSchema();

      schema.type = 'number';

      expect(schema.$merge(new BaseSchema()).type).toBe('number');
    });

    it('should properly merge Values', () => {
      const schema = new BaseSchema();
      const schema2 = new BaseSchema();

      schema._valids.add(1, 2);
      schema._invalids.add(3);
      schema2._valids.add(3);
      schema2._invalids.add(2);

      const merged = schema.$merge(schema2);

      expect(equal(merged._valids, new Values([1, 3]))).toBe(true);
      expect(equal(merged._invalids, new Values([2]))).toBe(true);
    });

    it('should properly merge rules', () => {
      const schema = new BaseSchema();
      const schema2 = new BaseSchema();

      schema._definition.rules = {
        x: { single: true },
        y: { single: true },
        i: { single: true },
        t: { single: false },
        z: { single: false },
      };
      schema._singleRules = new Set(['x', 'y', 'i']);

      schema._rules.push(
        // Single -> single
        { name: 'a', identifier: 'x' },
        // multiple -> multiple
        { name: 'u', identifier: 't' },
        // single -> multiple
        { name: 'y', identifier: 'y' },
        // mutiple -> single
        { name: 'b', identifier: 'z' },
        { name: 'c', identifier: 'z' },
        // undefined -> single
        { name: 'i', identifier: 'i' },
      );

      schema2._definition.rules = {
        x: { single: true },
        y: { single: false },
        z: { single: true },
        r: { single: true },
        t: { single: false },
      };
      schema2._singleRules = new Set(['x', 'z', 'r']);

      schema2._rules.push(
        { name: 'b', identifier: 'x' },
        { name: 'v', identifier: 't' },
        { name: 'z', identifier: 'z' },
        { name: 'a', identifier: 'y' },
        { name: 'c', identifier: 'y' },
        // undefined -> single
        { name: 'r', identifier: 'r' },
      );

      const merged = schema.$merge(schema2);

      expect(equal(merged._singleRules, new Set(['x', 'i', 'z', 'r']))).toBe(true);
      expect(
        equal(merged._rules, [
          { name: 'u', identifier: 't' },
          { name: 'i', identifier: 'i' },
          { name: 'b', identifier: 'x' },
          { name: 'v', identifier: 't' },
          { name: 'z', identifier: 'z' },
          { name: 'a', identifier: 'y' },
          { name: 'c', identifier: 'y' },
          { name: 'r', identifier: 'r' },
        ]),
      ).toBe(true);
    });

    it('should reset registered refs', () => {
      const schema = new BaseSchema();

      schema._refs.push([0, 'a']);

      expect(schema.$merge(new BaseSchema())._refs.length).toBe(0);
    });

    it('should shallowly concat terms', () => {
      const schema = new BaseSchema();
      const schema2 = new BaseSchema();
      const obj = {};

      schema.$terms = new Map([
        ['x', [1]],
        ['z', [obj]],
      ]);
      schema2.$terms = new Map([
        ['x', null],
        ['y', [1]],
        ['z', [1]],
      ]);

      const merged = schema.$merge(schema2);

      expect(
        equal(
          merged.$terms,
          new Map([
            ['x', [1]],
            ['z', [obj, 1]],
            ['y', [1]],
          ]),
        ),
      ).toBe(true);
      expect(merged.$terms.get('z')[0]).toBe(obj);
    });

    it('should merge 2 schemas', () => {
      const schema = new BaseSchema();
      const schema2 = new BaseSchema();
      const merged = new BaseSchema();

      schema.$flags.default = 5;
      schema2.type = 'number';
      schema2.$flags.default = 7;
      merged.type = 'number';
      merged.$flags.default = 7;

      expect(equal(schema.$merge(schema2), merged, { compareDescriptors: true })).toBe(true);
    });
  });

  describe('BaseSchema.$setFlag()', () => {
    it('should throw when incorrect parameters are passed', () => {
      const schema = new BaseSchema();

      expect(() => schema.$setFlag(1)).toThrow();
    });

    it('should return the same schema if nothing has changed', () => {
      const schema = new BaseSchema();

      schema.$flags.x = { a: 1 };

      expect(schema.$setFlag('x', { a: 1 })).toBe(schema);
    });

    it('should clone the schema if the flag has not been defined', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$clone');

      new BaseSchema().$setFlag('x', 'x');

      expect(utils.callWith(spy)).toBe(true);
      spy.mockRestore();
    });

    it('should clone the schema if something has changed', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$clone');
      const schema = new BaseSchema();

      schema.$flags.x = { a: 1 };
      schema.$setFlag('x', { a: 2 });

      expect(utils.callWith(spy)).toBe(true);
      spy.mockRestore();
    });

    it('should set the flag', () => {
      expect(new BaseSchema().$setFlag('x', 'x').$flags.x).toBe('x');
    });
  });

  describe('BaseSchema.$createError()', () => {
    const schema = new BaseSchema();
    const state = new State();

    schema._definition.messages.x = 'x';
    schema._definition.messages.y = '{label} x';
    schema._definition.messages.z = '{x} {y.z}';
    schema._definition.messages.t = '{values}';

    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.$createError(1)).toThrow();
      expect(() => schema.$createError('x', 'x')).toThrow();
      expect(() => schema.$createError('x', state, 'x')).toThrow();
      expect(() => schema.$createError('x', state, {}, 'x')).toThrow();
    });

    it('should throw when the message template is not found', () => {
      expect(() => schema.$createError('a', state, {})).toThrow();
    });

    it('should return the error customizer message if it is an instance of Error or a string', () => {
      expect(schema.$setFlag('error', 'x').$createError('x', state, {}, {}).message).toBe('x');
      expect(
        schema.$setFlag('error', new Error('x')).$createError('x', state, {}, {}).message,
      ).toBe('x');
    });

    it('should throw if the error customizer is a function that does not return a string or an instance of Error', () => {
      const mock = jest.fn();

      expect(() => schema.$setFlag('error', mock).$createError('x', state, {}, {})).toThrow();
    });

    it('should call the error customizer if it is a function', () => {
      const mock = jest.fn(() => 'x');

      schema.$setFlag('error', mock).$createError('x', state, {}, {});

      expect(utils.callWith(mock, { args: ['x', state, {}, {}] })).toBe(true);
    });

    it('should return the correct error message', () => {
      expect(schema.$createError('x', state, {}).message).toBe('x');
    });

    it('should interpolate label', () => {
      expect(schema.$setFlag('label', 'x').$createError('y', state, {}).message).toBe('x x');
    });

    it('should interpolate lookup values', () => {
      expect(
        schema.$createError(
          'z',
          state,
          {},
          {
            x: 1,
            y: {
              z: 2,
            },
          },
        ).message,
      ).toBe('1 2');
    });

    it('should correctly interpolate Values', () => {
      const ref = new Ref('..a');

      expect(schema.$createError('t', state, {}, { values: new Values([1], [ref]) }).message).toBe(
        `(2) [ 1, ${ref._display} ]`,
      );
    });

    it('should throw when a lookup value is not found', () => {
      expect(() => schema.$createError('z', state, {})).toThrow();
    });

    it("should not confuse literal undefined with 'not found' lookup values", () => {
      expect(schema.$createError('z', new State(), {}, { x: 1, y: { z: undefined } }).message).toBe(
        '1 undefined',
      );
    });
  });

  describe('BaseSchema.$register()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => new BaseSchema().$register('x')).toThrow();
    });

    it('should ignore context refs and self refs', () => {
      const schema = new BaseSchema();

      schema.$register(new Ref('$a'));
      schema.$register(new Ref('.a'));

      expect(schema._refs.length).toBe(0);
    });

    it('should register value refs', () => {
      const schema = new BaseSchema();

      schema.$register(new Ref('..a'));

      expect(equal(schema._refs, [[0, 'a']])).toBe(true);
    });

    it('should register refs if passed a schema', () => {
      const schema = new BaseSchema();
      const schema2 = new BaseSchema();

      schema2._refs.push([1, 'a']);
      schema2._refs.push([0, 'b']);

      schema.$register(schema2);

      expect(equal(schema._refs, [[0, 'a']])).toBe(true);
    });
  });

  describe('BaseSchema.$values()', () => {
    it('should throw when incorrect parameters are passed', () => {
      const schema = new BaseSchema();

      expect(() => schema.$values('x')).toThrow();
      expect(() => schema.$values([])).toThrow();
      expect(() => schema.$values([1], 'x')).toThrow();
    });

    it('should correctly register values', () => {
      const schema = new BaseSchema().$values([1, 2], 'valids').$values([2, 3], 'invalids');

      expect(equal(schema._valids, new Values([1]))).toBe(true);
      expect(equal(schema._invalids, new Values([2, 3]))).toBe(true);
    });
  });

  describe('BaseSchema.$getRule()', () => {
    const schema = new BaseSchema();

    schema._singleRules = new Set(['x']);
    schema._rules = [
      { name: 'x', identifier: 'x' },
      { name: 'y', identifier: 'y' },
      { name: 'z', identifier: 'y' },
      { name: 'z', identifier: 'z' },
    ];

    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.$getRule('x')).toThrow();
      expect(() => schema.$getRule({})).toThrow();
      expect(() => schema.$getRule({ name: 1 })).toThrow();
      expect(() => schema.$getRule({ identifier: 1 })).toThrow();
      expect(() => schema.$getRule({ name: 'x', identifier: 'x' })).toThrow();
    });

    it('should return false when no rule is found', () => {
      expect(schema.$getRule({ name: 'a' })).toBe(false);
      expect(schema.$getRule({ identifier: 'a' })).toBe(false);
    });

    it('should return a single rule', () => {
      expect(equal(schema.$getRule({ name: 'x' }), { name: 'x', identifier: 'x' })).toBe(true);
      expect(equal(schema.$getRule({ identifier: 'x' }), { name: 'x', identifier: 'x' })).toBe(
        true,
      );
    });

    it('should return an array of a multiple rule if only one is found', () => {
      expect(equal(schema.$getRule({ name: 'y' }), [{ name: 'y', identifier: 'y' }])).toBe(true);
      expect(equal(schema.$getRule({ identifier: 'z' }), [{ name: 'z', identifier: 'z' }])).toBe(
        true,
      );
    });

    it('should return an array of multiple rules', () => {
      expect(
        equal(schema.$getRule({ name: 'z' }), [
          { name: 'z', identifier: 'y' },
          { name: 'z', identifier: 'z' },
        ]),
      ).toBe(true);
      expect(
        equal(schema.$getRule({ identifier: 'y' }), [
          { name: 'y', identifier: 'y' },
          { name: 'z', identifier: 'y' },
        ]),
      ).toBe(true);
    });
  });

  describe('BaseSchema.$addRule()', () => {
    const paramDef = {
      assert: resolved => resolved === undefined || typeof resolved === 'string',
      reason: 'must be a string',
      ref: true,
    };
    const schema = new BaseSchema();

    schema._definition.rules = {
      x: {
        single: true,
        priority: false,
        params: {
          x: paramDef,
          y: {
            ...paramDef,
            ref: false,
          },
        },
      },
      y: {
        single: true,
        priority: true,
        params: {},
      },
      z: {
        single: false,
        priority: false,
        params: {},
      },
    };

    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.$addRule('x')).toThrow();
      expect(() => schema.$addRule({ name: 1 })).toThrow();
      expect(() => schema.$addRule({ name: 'x', method: 1 })).toThrow();
      expect(() => schema.$addRule({ name: 'x', params: 'x' })).toThrow();
    });

    it('should throw when the rule definition is not found', () => {
      expect(() => schema.$addRule({ name: 'a' })).toThrow();
    });

    it('should clone the schema', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$clone');

      schema.$addRule({ name: 'x' });

      expect(utils.callWith(spy)).toBe(true);
      spy.mockRestore();
    });

    it('should add to the rule queue', () => {
      expect(
        equal(schema.$addRule({ name: 'x' })._rules, [{ name: 'x', identifier: 'x', params: {} }]),
      ).toBe(true);
    });

    it('should correctly infer the rule identifier', () => {
      expect(
        equal(schema.$addRule({ name: 'a', method: 'x' })._rules, [
          { name: 'a', identifier: 'x', params: {} },
        ]),
      ).toBe(true);
    });

    it('should assert if the parameters are not references', () => {
      expect(() => schema.$addRule({ name: 'x', params: { x: 2 } })).toThrow(
        'The parameter x of any.x must be a string',
      );
    });

    it('should register the refs', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$register');
      const ref = new Ref('..a');

      schema.$addRule({ name: 'x', params: { x: ref } });

      expect(utils.callWith(spy, { args: [ref] })).toBe(true);
      spy.mockRestore();
    });

    it('should treat references as normal values if ref is set to false', () => {
      expect(() => schema.$addRule({ name: 'x', params: { y: new Ref('..a') } })).toThrow(
        'The parameter y of any.x must be a string',
      );
    });

    it('should override single rule', () => {
      const ruleOpts = { name: 'x', params: { x: 'b' } };

      expect(
        equal(schema.$addRule({ name: 'x', params: { x: 'a' } }).$addRule(ruleOpts)._rules, [
          { ...ruleOpts, identifier: 'x' },
        ]),
      ).toBe(true);
    });

    it('should unshift the rules array if priority is set to true', () => {
      expect(
        equal(schema.$addRule({ name: 'x' }).$addRule({ name: 'y' })._rules, [
          { name: 'y', identifier: 'y', params: {} },
          { name: 'x', identifier: 'x', params: {} },
        ]),
      ).toBe(true);
    });

    it('should concat multiple rules if not single', () => {
      const ruleOpts = { name: 'z', params: { x: 'a' } };
      const ruleOpts2 = { name: 'z', params: { x: 'b' } };

      expect(
        equal(schema.$addRule(ruleOpts).$addRule(ruleOpts2)._rules, [
          { ...ruleOpts, identifier: 'z' },
          { ...ruleOpts2, identifier: 'z' },
        ]),
      ).toBe(true);
    });
  });

  describe('BaseSchema.define()', () => {
    it('should throw when incorrect parameters are passed', () => {
      const schema = new BaseSchema();

      expect(() => schema.define('x')).toThrow();
      expect(() => schema.define({ type: 1 })).toThrow();
      expect(() => schema.define({ flags: 'x' })).toThrow();
      expect(() => schema.define({ terms: 'x' })).toThrow();
      expect(() => schema.define({ messages: 'x' })).toThrow();
      expect(() => schema.define({ validate: 'x' })).toThrow();
      expect(() => schema.define({ coerce: 'x' })).toThrow();
      expect(() => schema.define({ rules: 'x' })).toThrow();
    });

    it('should clone the prototype', () => {
      const proto = Object.getPrototypeOf(new BaseSchema().define({}));

      expect(proto).not.toBe(BaseSchema.prototype);
      expect(equal(proto, BaseSchema.prototype, { compareDescriptors: true })).toBe(true);
    });

    it('should define the type', () => {
      expect(new BaseSchema().define({ type: 'number' }).type).toBe('number');
    });

    it('should define a flag', () => {
      expect(new BaseSchema().define({ flags: { x: 5 } }).$flags.x).toBe(5);
    });

    it('should override a flag', () => {
      expect(new BaseSchema().define({ flags: { label: 'x' } }).$flags.label).toBe('x');
    });

    it('should define validate and coerce methods', () => {
      ['validate', 'coerce'].forEach(method => {
        const fn = () => {};

        expect(new BaseSchema().define({ [method]: fn })._definition[method]).toBe(fn);
      });
    });

    it('should define a message', () => {
      expect(new BaseSchema().define({ messages: { x: 'x' } })._definition.messages.x).toBe('x');
    });

    it('should override a message', () => {
      expect(
        new BaseSchema().define({ messages: { 'any.ref': 'x' } })._definition.messages['any.ref'],
      ).toBe('x');
    });

    it('should throw when incorrect options are passed for rules', () => {
      const schema = new BaseSchema();
      const validate = () => {};

      // Either method or validate must be defined
      expect(() => schema.define({ rules: { x: {} } })).toThrow();
      expect(() => schema.define({ rules: { x: { validate: 'x' } } })).toThrow();
      expect(() => schema.define({ rules: { x: { method: 'x' } } })).toThrow();
      // Method false cannot have aliases
      expect(() => schema.define({ rules: { x: { method: false, alias: ['x'] } } })).toThrow();
      // Validate must be defined
      expect(() => schema.define({ rules: { x: { method: false } } })).toThrow();

      // We need to provide the rest with a validate method, otherwise it's just gonna be the
      // first expect
      expect(() => schema.define({ rules: { x: { validate, params: 'x' } } })).toThrow();
      expect(() => schema.define({ rules: { x: { validate, params: [{ name: 1 }] } } })).toThrow();
      expect(() =>
        schema.define({ rules: { x: { validate, params: [{ name: 'x', ref: 1 }] } } }),
      ).toThrow();
      expect(() =>
        schema.define({ rules: { x: { validate, params: [{ name: 'x', assert: 'x' }] } } }),
      ).toThrow();
      expect(() =>
        schema.define({ rules: { x: { validate, params: [{ name: 'x', reason: 1 }] } } }),
      ).toThrow();
      // Assert must be with reason
      expect(() =>
        schema.define({ rules: { x: { validate, params: [{ name: 'x', assert: () => {} }] } } }),
      ).toThrow();
      // Reason must be with assert
      expect(() =>
        schema.define({ rules: { x: { validate, params: [{ name: 'x', reason: 'x' }] } } }),
      ).toThrow();
      expect(() => schema.define({ rules: { x: { validate, single: 'x' } } })).toThrow();
      expect(() => schema.define({ rules: { x: { validate, priority: 'x' } } })).toThrow();
      expect(() => schema.define({ rules: { x: { validate, alias: 'x' } } })).toThrow();
      expect(() => schema.define({ rules: { x: { validate, alias: ['x', 1] } } })).toThrow();
    });

    it('should throw if a rule has method property and has already been defined', () => {
      expect(() => new BaseSchema().define({ rules: { allow: { method: () => {} } } })).toThrow();
    });

    it('should add the rule definition if it has the validate method', () => {
      const fn = () => {};

      expect(
        equal(new BaseSchema().define({ rules: { x: { validate: fn } } })._definition.rules.x, {
          validate: fn,
          alias: [],
          params: {},
          priority: false,
          single: true,
        }),
      ).toBe(true);
    });

    it('should create a param object by names', () => {
      const assert = () => {};

      expect(
        equal(
          new BaseSchema().define({
            rules: {
              x: {
                validate: () => {},
                params: [
                  {
                    name: 'a',
                    assert,
                    reason: 'must be a number',
                  },
                ],
              },
            },
          })._definition.rules.x.params,
          {
            a: { assert, reason: 'must be a number', ref: true },
          },
        ),
      ).toBe(true);
    });

    it('should attach a custom method and its aliases', () => {
      const method = () => {};
      const schema = new BaseSchema().define({
        rules: {
          x: {
            method,
            alias: ['y'],
          },
        },
      });

      expect(schema.x).toBe(method);
      expect(schema.y).toBe(method);
    });

    it('should attach a method automatically if validate is defined and its aliases', () => {
      const schema = new BaseSchema().define({
        rules: {
          x: {
            validate: () => {},
            alias: ['y'],
          },
        },
      });

      expect(typeof schema.x).toBe('function');
      expect(typeof schema.y).toBe('function');
    });

    it('should not attach a method if method is set to false', () => {
      expect(
        new BaseSchema().define({
          rules: {
            x: {
              method: false,
              validate: () => {},
            },
          },
        }).x,
      ).toBe(undefined);
    });
  });

  describe('BaseSchema.describe()', () => {
    it('should describe schema with only type', () => {
      const schema = new BaseSchema();

      schema.type = 'number';

      expect(equal(schema.describe(), { type: 'number', flags: _const.DEFAULT_SCHEMA_FLAGS })).toBe(
        true,
      );
    });

    it('should describe schema with conditions', () => {
      const describeRefSpy = jest.spyOn(Ref.prototype, 'describe');
      const describeSchemaSpy = jest.spyOn(BaseSchema.prototype, 'describe');
      const schema = new BaseSchema();
      const schema2 = new BaseSchema();

      schema._conditions.push({ ref: new Ref('a'), is: schema2, then: schema2 });
      schema.describe();

      expect(utils.callWith(describeRefSpy)).toBe(true);
      // First call on the parent schema, second call on is schema, third call on then schema
      expect(utils.callWith(describeSchemaSpy, { times: 3 })).toBe(true);

      describeRefSpy.mockRestore();
      describeSchemaSpy.mockRestore();
    });

    it('should describe schema with rules', () => {
      const schema = new BaseSchema();

      schema._rules = [{ name: 'x', identifier: 'x', params: { x: 5 } }];

      expect(
        equal(schema.describe(), {
          type: 'any',
          rules: [{ name: 'x', params: { x: 5 } }],
          flags: _const.DEFAULT_SCHEMA_FLAGS,
        }),
      ).toBe(true);

      const spy = jest.spyOn(Ref.prototype, 'describe');

      schema._rules = [{ name: 'x', identifier: 'x', params: { x: new Ref('a') } }];

      schema.describe();

      expect(utils.callWith(spy)).toBe(true);

      spy.mockRestore();
    });

    it('should describe schema with opts', () => {
      const schema = new BaseSchema();

      schema._opts = { strict: false };

      const desc = schema.describe();

      expect(desc.opts).not.toBe(schema._opts);
      expect(
        equal(desc, { type: 'any', opts: { strict: false }, flags: _const.DEFAULT_SCHEMA_FLAGS }),
      ).toBe(true);
    });

    it('should describe schema with valids/invalids', () => {
      const spy = jest.spyOn(Values.prototype, 'describe');
      const schema = new BaseSchema();

      schema._valids.add(1);
      schema._invalids.add(2);
      schema.describe();

      expect(utils.callWith(spy, { times: 2 })).toBe(true);
    });

    it('should describe schema with flags', () => {
      const schema = new BaseSchema();

      schema.$flags.label = 'x';

      const desc = schema.describe();

      expect(
        equal(desc, { type: 'any', flags: { ..._const.DEFAULT_SCHEMA_FLAGS, label: 'x' } }),
      ).toBe(true);
    });

    it('should describe schema with nested schemas', () => {});
  });

  describe('BaseSchema.opts()', () => {
    it('should throw when incorrect parameters are passed', () => {
      const schema = new BaseSchema();

      expect(() => schema.opts('x')).toThrow();
      expect(() => schema.opts({ strict: 'x' })).toThrow();
      expect(() => schema.opts({ abortEarly: 'x' })).toThrow();
      expect(() => schema.opts({ recursive: 'x' })).toThrow();
      expect(() => schema.opts({ allowUnknown: 'x' })).toThrow();
      expect(() => schema.opts({ stripUnknown: 'x' })).toThrow();
      expect(() => schema.opts({ context: 'x' })).toThrow();
    });

    it('should correctly set the options', () => {
      expect(equal(new BaseSchema().opts({ strict: false })._opts, { strict: false })).toBe(true);
    });
  });

  describe.each(['strip', 'only'])('BaseSchema.%s()', method => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => new BaseSchema()[method]('x')).toThrow();
    });

    it(`should correctly set the ${method} flag`, () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$setFlag');
      const schema = new BaseSchema();

      schema[method]();

      expect(utils.callWith(spy, { args: [method, true] })).toBe(true);

      spy.mockClear();

      schema[method](false);

      expect(utils.callWith(spy, { args: [method, false] })).toBe(true);
      spy.mockRestore();
    });
  });

  describe('BaseSchema.presence()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => new BaseSchema().presence('x')).toThrow();
    });

    it('should correctly set the presence flag', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$setFlag');

      new BaseSchema().presence('optional');

      expect(utils.callWith(spy, { args: ['presence', 'optional'] })).toBe(true);
      spy.mockRestore();
    });
  });

  describe('BaseSchema.optional()', () => {
    it('should correctly set the presence flag to optional', () => {
      const spy = jest.spyOn(BaseSchema.prototype, 'presence');

      new BaseSchema().optional();

      expect(utils.callWith(spy, { args: ['optional'] })).toBe(true);
      spy.mockRestore();
    });
  });

  describe('BaseSchema.required()', () => {
    it('should correctly set the presence flag to required', () => {
      const spy = jest.spyOn(BaseSchema.prototype, 'presence');

      new BaseSchema().required();

      expect(utils.callWith(spy, { args: ['required'] })).toBe(true);
      spy.mockRestore();
    });
  });

  describe('BaseSchema.forbidden()', () => {
    it('should correctly set the presence flag to forbidden', () => {
      const spy = jest.spyOn(BaseSchema.prototype, 'presence');

      new BaseSchema().forbidden();

      expect(utils.callWith(spy, { args: ['forbidden'] })).toBe(true);
      spy.mockRestore();
    });
  });

  describe('BaseSchema.default()', () => {
    it('should correctly set the default flag with a cloned value', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$setFlag');
      const obj = { x: 1 };
      const schema = new BaseSchema().default(obj);

      // Check if the obj is cloned
      expect(schema.$flags.default).not.toBe(obj);
      expect(utils.callWith(spy, { args: ['default', obj] })).toBe(true);
      spy.mockRestore();
    });
  });

  describe('BaseSchema.label()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => new BaseSchema().label(1)).toThrow();
    });

    it('should correctly set the label flag', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$setFlag');

      new BaseSchema().label('x');

      expect(utils.callWith(spy, { args: ['label', 'x'] })).toBe(true);
      spy.mockRestore();
    });
  });

  describe('BaseSchema.valid()', () => {
    it('should correctly set valids', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$values');

      new BaseSchema().valid(1, 2, 3);

      expect(utils.callWith(spy, { args: [[1, 2, 3], 'valids'] })).toBe(true);
      spy.mockRestore();
    });
  });

  describe('BaseSchema.invalid()', () => {
    it('should correctly set invalids', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$values');

      new BaseSchema().invalid(1, 2, 3);

      expect(utils.callWith(spy, { args: [[1, 2, 3], 'invalids'] })).toBe(true);
      spy.mockRestore();
    });
  });

  describe('BaseSchema.error()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => new BaseSchema().error(1)).toThrow();
    });

    it('should correctly set the error flag', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$setFlag');
      const schema = new BaseSchema();

      ['x', new Error('x'), () => 'x'].forEach(arg => {
        spy.mockClear();
        schema.error(arg);

        expect(utils.callWith(spy, { args: ['error', arg] })).toBe(true);
      });
    });
  });

  describe('BaseSchema.$validate()', () => {
    const schema = new BaseSchema().define({
      type: 'test',
      messages: {
        x: 'x',
        y: 'y',
        z: 'z',
      },
      coerce: (value, helpers) => {
        const coerced = Number(value);

        if (!Number.isNaN(coerced)) return { value: coerced, errors: null };

        return { value: null, errors: [helpers.createError('x')] };
      },
      validate: (value, helpers) => {
        if (typeof value !== 'number') return { value: null, errors: [helpers.createError('y')] };

        if (value % 2 !== 0) return { value: null, errors: [helpers.createError('y')] };

        return { value, errors: null };
      },

      rules: {
        min: {
          method(min) {
            return this.$addRule({ name: 'min', params: { min } });
          },
          validate: (value, helpers) => {
            if (value >= helpers.params.min) return { value, errors: null };

            return { value: null, errors: [helpers.createError('z')] };
          },
          params: [
            {
              name: 'min',
              assert: resolved => typeof resolved === 'number',
              reason: 'must be a number',
            },
          ],
        },
      },
    });

    it('should validate valid values', () => {
      const schema2 = schema.valid(1);

      utils.$validate(schema2, 1, { result: 1 });
      utils.$validate(schema2.only(), 0, {
        pass: false,
        result: {
          code: 'any.only',
          lookup: {
            values: new Values([1]),
            grammar: {
              s: '',
              verb: 'is',
            },
          },
        },
      });
      utils.$validate(schema2.valid(3).only(), 0, {
        pass: false,
        result: {
          code: 'any.only',
          lookup: {
            values: new Values([1, 3]),
            grammar: {
              s: 's',
              verb: 'are',
            },
          },
        },
      });
    });

    it('should validate invalid values', () => {
      const schema2 = schema.invalid(2);

      utils.$validate(schema2, 4, { result: 4 });
      utils.$validate(schema2, 2, {
        pass: false,
        result: {
          code: 'any.invalid',
          lookup: {
            values: new Values([2]),
            grammar: {
              s: '',
              verb: 'is',
            },
          },
        },
      });
      utils.$validate(schema2.invalid(4), 2, {
        pass: false,
        result: {
          code: 'any.invalid',
          lookup: {
            values: new Values([2, 4]),
            grammar: {
              s: 's',
              verb: 'are',
            },
          },
        },
      });
    });

    it('should validate required presence', () => {
      const schema2 = schema.required();

      utils.$validate(schema2, 2, { result: 2 });
      utils.$validate(schema2, undefined, {
        pass: false,
        result: { code: 'any.required' },
      });
    });

    it('should return the default value when the presence is optional', () => {
      utils.$validate(schema.default(0), undefined, { result: 0 });

      const ref = utils.createRef(0);

      utils.$validate(schema.default(ref), undefined, { result: 0 });
    });

    it('should validate forbidden presence', () => {
      const schema2 = schema.forbidden();

      utils.$validate(schema2, undefined, { result: undefined });
      utils.$validate(schema2, 2, {
        pass: false,
        result: { code: 'any.forbidden' },
      });
    });

    it('should run the validate method in definition', () => {
      utils.$validate(schema, 2, { result: 2 });
      utils.$validate(schema, 'x', { pass: false, result: { code: 'y' } });
    });

    it('should not run the coerce method in definition in strict mode', () => {
      utils.$validate(schema, '2', { pass: false, result: { code: 'y' } });
    });

    it('should run the coerce method in definition', () => {
      utils.$validate(schema, '2', {
        result: 2,
        opts: { strict: false },
      });
      utils.$validate(schema, 'x', {
        pass: false,
        result: { code: 'x' },
        opts: { strict: false },
      });
    });

    it("should validate rules' reference parameters", () => {
      const ref = utils.createRef('x');

      utils.$validate(schema.min(ref), 2, {
        pass: false,
        result: { code: 'any.ref', lookup: { ref, reason: 'must be a number' } },
      });
    });

    it("should run rules' validation method", () => {
      const ref = utils.createRef(2);

      utils.$validate(schema.min(ref), 2, { result: 2 });

      ref.update(4);

      utils.$validate(schema.min(ref), 2, {
        pass: false,
        result: { code: 'z' },
      });
    });

    it('should collect all errors if abortEarly is set to false', () => {
      expect(
        schema
          .valid(6)
          .invalid(2)
          .min(4)
          .only()
          .$validate(2, { ..._const.DEFAULT_VALIDATE_OPTS, abortEarly: false }, new State()).errors
          .length,
      ).toBe(3);
    });

    it('should apply options from the opts flag', () => {
      // Coercion should happen
      utils.$validate(schema.opts({ strict: false }), '2', { result: 2 });
    });

    it('should resolve conditions and merge the schemas', () => {
      const ref = utils.createRef('x');
      const next = schema.$clone();

      next._conditions.push({ ref, is: schema.valid('x'), then: schema.forbidden() });

      utils.$validate(next, 2, {
        pass: false,
        result: { code: 'any.forbidden' },
      });
    });
  });

  describe('BaseSchema.validate()', () => {
    it('should throw when incorrect parameters are passed', () => {
      const schema = new BaseSchema();

      expect(() => schema.validate('x', 'x')).toThrow();
      expect(() => schema.validate('x', { strict: 'x' })).toThrow();
      expect(() => schema.validate('x', { abortEarly: 'x' })).toThrow();
      expect(() => schema.validate('x', { recursive: 'x' })).toThrow();
      expect(() => schema.validate('x', { allowUnknown: 'x' })).toThrow();
      expect(() => schema.validate('x', { stripUnknown: 'x' })).toThrow();
      expect(() => schema.validate('x', { context: 'x' })).toThrow();
    });

    it('should call BaseSchema.$validate()', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$validate');
      const opts = { strict: false };

      new BaseSchema().validate('x', opts);

      expect(
        utils.callWith(spy, {
          args: ['x', { ..._const.DEFAULT_VALIDATE_OPTS, strict: false }, new State()],
        }),
      ).toBe(true);
      spy.mockRestore();
    });
  });

  describe('BaseSchema.when()', () => {
    it('should throw when incorrect parameters are passed', () => {
      const schema = new BaseSchema();
      const ref = new Ref('a');

      expect(() => schema.when('x')).toThrow();
      expect(() => schema.when(ref, 'x')).toThrow();
      expect(() => schema.when(ref, {})).toThrow();
      expect(() => schema.when(ref, { is: 'x' })).toThrow();
      expect(() => schema.when(ref, { is: schema, then: 'x' })).toThrow();
      expect(() => schema.when(ref, { is: schema, otherwise: 'x' })).toThrow();
    });

    it('should clone the schema', () => {
      const schema = new BaseSchema();

      schema.when(new Ref('a'), { is: schema, then: schema });
    });

    it('should register the refs', () => {
      const spy = jest.spyOn(BaseSchema.prototype, '$register');
      const schema = new BaseSchema();
      const ref = new Ref('..a');

      schema.when(ref, { is: schema, then: schema });

      expect(utils.callWith(spy, { args: [ref] })).toBe(true);
      spy.mockRestore();
    });

    it('should resolve to the correct schema', () => {
      const ref = utils.createRef('x');
      const schema = new BaseSchema();
      const schema2 = schema.when(ref, {
        is: schema.valid('x').only(),
        then: schema.forbidden(),
        otherwise: schema.invalid('x'),
      });

      utils.$validate(schema2, 'x', { pass: false, result: { code: 'any.forbidden' } });

      ref.update('y');

      utils.$validate(schema2, 'x', {
        pass: false,
        result: {
          code: 'any.invalid',
          lookup: { values: new Values(['x']), grammar: { s: '', verb: 'is' } },
        },
        // createError will be called twice
        callWithOpts: { times: 2 }
      });
    });
  });

  describe('Aliases', () => {
    const schema = new BaseSchema();

    it.each([
      ['required', 'exists', 'present'],
      ['valid', 'allow', 'equal'],
      ['invalid', 'deny', 'disallow', 'not'],
      ['opts', 'options', 'prefs', 'preferences'],
    ])('BaseSchema.%s() aliases', (methodName, ...aliases) => {
      aliases.forEach(alias => {
        expect(schema[alias]).toBe(schema[methodName]);
      });
    });
  });
});
