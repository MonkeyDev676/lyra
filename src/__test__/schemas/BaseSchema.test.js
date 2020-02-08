const equal = require('@botbind/dust/src/equal');
const BaseSchema = require('../../schemas/BaseSchema');
const Ref = require('../../Ref');
const Values = require('../../Values');
const State = require('../../State');
const utils = require('../utils');

const validateOpts = {
  strict: true,
  abortEarly: true,
  recursive: true,
  allowUnknown: false,
  stripUnknown: false,
  context: {},
};
const state = new State();
const ref = new Ref('..a');
const contextRef = new Ref('$a');
const selfRef = new Ref('.a');
const methods = {
  required: ['exists', 'present'],
  valid: ['allow', 'equal'],
  invalid: ['deny', 'disallow', 'not'],
  opts: ['options', 'prefs', 'preferences'],
};

describe('BaseSchema', () => {
  let schema;

  // We will be doing a lot of mutations, so beforeEach is needed
  beforeEach(() => {
    schema = new BaseSchema();
  });

  describe('BaseSchema.isValid()', () => {
    it('should return true for BaseSchema instances', () => {
      expect(BaseSchema.isValid(schema)).toBe(true);
    });

    it('should return false for non schemas', () => {
      expect(BaseSchema.isValid({})).toBe(false);
      expect(BaseSchema.isValid(null)).toBe(false);
      expect(BaseSchema.isValid(undefined)).toBe(false);
    });
  });

  describe('BaseSchema.$clone()', () => {
    it('should not clone nested schemas', () => {
      const test2 = new BaseSchema();

      schema.$flags.inner = test2;

      expect(schema.$clone().$flags.inner).toBe(test2);
    });

    it('should call Values.clone()', () => {
      utils.spy(() => schema.$clone(), { proto: Values.prototype, method: 'clone' });
    });

    it('should clone the schema', () => {
      const cloned = schema.$clone();

      expect(cloned).not.toBe(schema);
      expect(equal(schema, cloned, { compareDescriptors: true })).toBe(true);
    });
  });

  describe('BaseSchema.$merge()', () => {
    it('should return the current schema if undefined is passed', () => {
      expect(schema.$merge()).toBe(schema);
    });

    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.$merge('x')).toThrow();
    });

    it('should throw when 2 schemas have different types', () => {
      schema.type = 'number';

      const schema2 = new BaseSchema();

      schema2.type = 'string';

      expect(() => schema.$merge(schema2)).toThrow();
    });

    it('should use the target type if the source type is any', () => {
      schema.type = 'number';

      expect(schema.$merge(new BaseSchema()).type).toBe('number');
    });

    it('should properly merge Values', () => {
      schema.$flags.valids.add(1, 2, 3);
      schema.$flags.invalids.add(4, 5);

      const schema2 = new BaseSchema();

      schema2.$flags.valids.add(4, 5);
      schema2.$flags.invalids.add(2, 3, 6);

      const merged = schema.$merge(schema2);

      expect(equal(merged.$flags.valids, new Values([1, 4, 5]))).toBe(true);
      expect(equal(merged.$flags.invalids, new Values([2, 3, 6]))).toBe(true);
    });

    it('should reset registered refs', () => {
      expect(schema.$merge(new BaseSchema())._refs.length).toBe(0);
    });

    it('should recurse when encounter nested schemas', () => {
      const schema2 = new BaseSchema();

      schema.$flags.inner = schema2;

      const schema3 = new BaseSchema();

      schema3.$flags.inner = schema2;

      // test2.$merge(test2)
      utils.spy(() => schema.$merge(schema3), {
        proto: BaseSchema.prototype,
        method: '$merge',
        args: [schema2],
      });
    });

    it('should merge 2 schemas', () => {
      schema.$flags.default = 5;

      const schema2 = new BaseSchema();

      schema2.type = 'number';
      schema2.$flags.default = 7;

      const result = new BaseSchema();

      result.type = 'number';
      result.$flags.default = 7;

      const merged = schema.$merge(schema2);

      expect(merged).not.toBe(schema);
      expect(equal(schema.$merge(schema2), result, { compareDescriptors: true })).toBe(true);
    });
  });

  describe('BaseSchema.$setFlag()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.$setFlag(1)).toThrow();
      expect(() => schema.$setFlag('x', 'x', 'x')).toThrow();
      expect(() => schema.$setFlag('x', 'x', { literal: 'x' })).toThrow();
      expect(() => schema.$setFlag('x', 'x', { literal: true })).toThrow();
    });

    it('should call BaseSchema.$clone()', () => {
      utils.spy(() => schema.$setFlag('x', 'x'), {
        proto: BaseSchema.prototype,
        method: '$clone',
      });
    });

    it('should run the function if passed as value and literal is false', () => {
      const mock = jest.fn(() => 'x');

      schema = schema.$setFlag('x', mock);

      // Deep equality check is performed
      // This works because the initial instance is cloned
      // Then x is attached to its (the cloned one) flags
      // The reference is still the same, so test would be called with x attached
      expect(
        utils.toHaveBeenCalledWith(mock, {
          args: [schema],
          equalOpts: { compareDescriptors: true },
        }),
      ).toBe(true);
    });

    it('should set the function is passed as value and literal is true', () => {
      const fn = () => {};

      expect(schema.$setFlag('x', fn, { literal: true }).$flags.x).toBe(fn);
    });

    it('should set the flag', () => {
      expect(schema.$setFlag('x', 'x').$flags.x).toBe('x');
    });
  });

  describe('BaseSchema.$createError()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.$createError(1)).toThrow();
      expect(() => schema.$createError('x', 'x')).toThrow();
      expect(() => schema.$createError('x', state, 'x')).toThrow();
      expect(() => schema.$createError('x', state, {}, 'x')).toThrow();
    });

    it('should throw when the message template is not found', () => {
      expect(() => schema.$createError('x', state, {})).toThrow();
    });

    it('should run the error customizer if available', () => {
      const mock = jest.fn();

      schema.$setFlag('error', mock, { literal: true }).$createError('x', state, {}, {});

      expect(utils.toHaveBeenCalledWith(mock, { args: ['x', state, {}, {}] })).toBe(true);
    });

    const next = new BaseSchema();

    next._definition.messages.x = 'x';
    next._definition.messages.y = '{label} x';
    next._definition.messages.z = '{x} {y.z}';
    next._definition.messages.t = '{values}';

    it('should return the correct error message', () => {
      expect(next.$createError('x', state, {}).message).toBe('x');
    });

    it('should interpolate label', () => {
      expect(next.$setFlag('label', 'x').$createError('y', state, {}).message).toBe('x x');
    });

    it('should interpolate lookup values', () => {
      expect(
        next.$createError(
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
      expect(next.$createError('t', state, {}, { values: new Values([1], [ref]) }).message).toBe(
        '(2) [ 1, ref:..a ]',
      );
    });

    it('should throw when a lookup value is not found', () => {
      expect(() => next.$createError('z', state, {})).toThrow();
    });

    it("should not confuse literal undefined with 'not found' lookup values", () => {
      expect(next.$createError('z', state, {}, { x: 1, y: { z: undefined } }).message).toBe(
        '1 undefined',
      );
    });
  });

  describe('BaseSchema.$mutateRef()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.$mutateRef('x')).toThrow();
    });

    it('should ignore context refs and self refs', () => {
      schema.$mutateRef(contextRef);
      schema.$mutateRef(selfRef);

      expect(schema._refs.length).toBe(0);
    });

    it('should register value refs', () => {
      schema.$mutateRef(ref);

      expect(equal(schema._refs, [[0, 'a']])).toBe(true);
    });
  });

  describe('BaseSchema.$values()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.$values('x')).toThrow();
      expect(() => schema.$values([])).toThrow();
      expect(() => schema.$values([1], 'x')).toThrow();
    });

    it('should correctly register values', () => {
      schema = schema.$values([1, 2], 'valid').$values([2, 3], 'invalid');

      expect(equal(schema.$flags.valids, new Values([1]))).toBe(true);
      expect(equal(schema.$flags.invalids, new Values([2, 3]))).toBe(true);
    });
  });

  describe('BaseSchema.$addRule()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.$addRule('x')).toThrow();
      expect(() => schema.$addRule({ name: 1 })).toThrow();
      expect(() => schema.$addRule({ name: 'x', method: 1 })).toThrow();
      expect(() => schema.$addRule({ name: 'x', params: 'x' })).toThrow();
    });

    it('should throw when the rule definition is not found', () => {
      expect(() => schema.$addRule({ name: 'x' })).toThrow();
    });

    const next = new BaseSchema();

    const paramDef = {
      assert: resolved => resolved === undefined || typeof resolved === 'string',
      reason: 'must be a string',
      ref: true,
    };

    next._definition.rules = {
      x: {
        params: {
          x: paramDef,
          y: {
            ...paramDef,
            ref: false,
          },
        },
      },
    };

    it('should call BaseSchema.$clone()', () => {
      utils.spy(() => next.$addRule({ name: 'x' }), {
        proto: BaseSchema.prototype,
        method: '$clone',
      });
    });

    it('should add to the rule queue', () => {
      expect(
        equal(next.$addRule({ name: 'x' })._rules, [{ name: 'x', identifier: 'x', params: {} }]),
      ).toBe(true);
    });

    it('should correctly infer the rule identifier', () => {
      expect(
        equal(next.$addRule({ name: 'a', method: 'x' })._rules, [
          { name: 'a', identifier: 'x', params: {} },
        ]),
      ).toBe(true);
    });

    it('should assert if the parameters are not references', () => {
      expect(() => next.$addRule({ name: 'x', params: { x: 2 } })).toThrow(
        'The parameter x of any.x must be a string',
      );
    });

    it('should call BaseSchema.$mutateRef()', () => {
      utils.spy(() => next.$addRule({ name: 'x', params: { x: ref } }), {
        proto: BaseSchema.prototype,
        method: '$mutateRef',
        args: [ref],
      });
    });

    it('should treat references as normal values if ref is set to false', () => {
      expect(() => next.$addRule({ name: 'x', params: { y: ref } })).toThrow(
        'The parameter y of any.x must be a string',
      );
    });
  });

  describe('BaseSchema.define()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.define('x')).toThrow();
      expect(() => schema.define({ type: 1 })).toThrow();
      expect(() => schema.define({ flags: 'x' })).toThrow();
      expect(() => schema.define({ messages: 'x' })).toThrow();
      expect(() => schema.define({ validate: 'x' })).toThrow();
      expect(() => schema.define({ coerce: 'x' })).toThrow();
      expect(() => schema.define({ rules: 'x' })).toThrow();
    });

    it('should clone the prototype', () => {
      const proto = Object.getPrototypeOf(schema.define({}));

      expect(proto).not.toBe(BaseSchema.prototype);
      expect(equal(proto, BaseSchema.prototype, { compareDescriptors: true })).toBe(true);
    });

    it('should define the type', () => {
      expect(schema.define({ type: 'number' }).type).toBe('number');
    });

    it('should throw if a flag has already been defined', () => {
      expect(() => schema.define({ flags: { invalids: 5 } })).toThrow();
    });

    it('should define a flag', () => {
      expect(schema.define({ flags: { x: 5 } }).$flags.x).toBe(5);
    });

    it('should define validate and coerce methods', () => {
      ['validate', 'coerce'].forEach(method => {
        const fn = () => {};

        expect(schema.define({ [method]: fn })._definition[method]).toBe(fn);
      });
    });

    it('should throw if a message has already been defined', () => {
      expect(() => schema.define({ messages: { 'any.ref': 'x' } })).toThrow();
    });

    it('should define a message', () => {
      expect(schema.define({ messages: { x: 'x' } })._definition.messages.x).toBe('x');
    });

    it('should throw when incorrect options are passed for rules', () => {
      expect(() => schema.define({ rules: { x: {} } })).toThrow();
      expect(() => schema.define({ rules: { x: { params: 'x' } } })).toThrow();
      expect(() => schema.define({ rules: { x: { params: [{ name: 1 }] } } })).toThrow();
      expect(() => schema.define({ rules: { x: { params: [{ name: 'x', ref: 1 }] } } })).toThrow();
      expect(() =>
        schema.define({ rules: { x: { params: [{ name: 'x', assert: 'x' }] } } }),
      ).toThrow();
      expect(() =>
        schema.define({ rules: { x: { params: [{ name: 'x', reason: 1 }] } } }),
      ).toThrow();
      expect(() => schema.define({ rules: { x: { alias: 'x' } } })).toThrow();
      expect(() => schema.define({ rules: { x: { alias: ['x', 1] } } })).toThrow();
      expect(() => schema.define({ rules: { x: { validate: 'x' } } })).toThrow();
      expect(() => schema.define({ rules: { x: { method: 'x' } } })).toThrow();
      expect(() => schema.define({ rules: { x: { method: false, alias: ['x'] } } })).toThrow();
      expect(() => schema.define({ rules: { x: { method: false } } })).toThrow();
    });

    it('should throw if a rule has method property and has already been defined', () => {
      expect(() => schema.define({ rules: { allow: { method: () => {} } } })).toThrow();
    });

    it('should add the rule definition if it has the validate method', () => {
      const fn = () => {};

      expect(
        equal(schema.define({ rules: { x: { validate: fn } } })._definition.rules.x, {
          validate: fn,
          alias: [],
          params: {},
        }),
      ).toBe(true);
    });

    it('should create a param object by names', () => {
      const assert = () => {};

      expect(
        equal(
          schema.define({
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

      schema = schema.define({
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
      schema = schema.define({
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
  });

  describe('BaseSchema.opts()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.opts('x')).toThrow();
      expect(() => schema.opts({ strict: 'x' })).toThrow();
      expect(() => schema.opts({ abortEarly: 'x' })).toThrow();
      expect(() => schema.opts({ recursive: 'x' })).toThrow();
      expect(() => schema.opts({ allowUnknown: 'x' })).toThrow();
      expect(() => schema.opts({ stripUnknown: 'x' })).toThrow();
      expect(() => schema.opts({ context: 'x' })).toThrow();
    });

    it('should call BaseSchema.$setFlag()', () => {
      utils.spy(
        () => {
          schema = schema.opts({ strict: false });
        },
        { proto: BaseSchema.prototype, method: '$setFlag' },
      );

      expect(
        equal(schema.$flags.opts, {
          ...validateOpts,
          strict: false,
        }),
      ).toBe(true);
    });
  });

  describe('BaseSchema.strip()', () => {
    it('should call BaseSchema.$setFlag()', () => {
      utils.spy(() => schema.strip(), {
        proto: BaseSchema.prototype,
        method: '$setFlag',
        args: ['strip', true],
      });
    });
  });

  describe('BaseSchema.optional()', () => {
    it('should call BaseSchema.$setFlag()', () => {
      utils.spy(() => schema.optional(), {
        proto: BaseSchema.prototype,
        method: '$setFlag',
        args: ['presence', 'optional'],
      });
    });
  });

  describe('BaseSchema.required()', () => {
    it('should call BaseSchema.$setFlag()', () => {
      utils.spy(() => schema.required(), {
        proto: BaseSchema.prototype,
        method: '$setFlag',
        args: ['presence', 'required'],
      });
    });
  });

  describe('BaseSchema.forbidden()', () => {
    it('should call BaseSchema.$setFlag()', () => {
      utils.spy(() => schema.forbidden(), {
        proto: BaseSchema.prototype,
        method: '$setFlag',
        args: ['presence', 'forbidden'],
      });
    });
  });

  describe('BaseSchema.default()', () => {
    it('should call BaseSchema.$setFlag() and clone the value', () => {
      const obj = {};

      utils.spy(
        () => {
          schema = schema.default(obj);
        },
        { proto: BaseSchema.prototype, method: '$setFlag' },
      );

      expect(schema.$flags.default).not.toBe(obj);
      expect(equal(schema.$flags.default, obj)).toBe(true);
    });
  });

  describe('BaseSchema.label()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.label(1)).toThrow();
    });

    it('should call BaseSchema.$setFlag()', () => {
      utils.spy(() => schema.label('x'), {
        proto: BaseSchema.prototype,
        method: '$setFlag',
        args: ['label', 'x'],
      });
    });
  });

  describe('BaseSchema.only()', () => {
    it('should call BaseSchema.$setFlag()', () => {
      utils.spy(() => schema.only(), {
        proto: BaseSchema.prototype,
        method: '$setFlag',
        args: ['only', true],
      });
    });
  });

  describe('BaseSchema.valid()', () => {
    it('should calls BaseSchema.$value()', () => {
      utils.spy(() => schema.valid(1, 2, 3), {
        proto: BaseSchema.prototype,
        method: '$values',
        args: [[1, 2, 3], 'valid'],
      });
    });
  });

  describe('BaseSchema.invalid()', () => {
    it('should calls BaseSchema.$values()', () => {
      utils.spy(() => schema.invalid(1, 2, 3), {
        proto: BaseSchema.prototype,
        method: '$values',
        args: [[1, 2, 3], 'invalid'],
      });
    });
  });

  describe('BaseSchema.error()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.error(1)).toThrow();
    });

    it('should call BaseSchema.$setFlag()', () => {
      expect(typeof schema.error('x').$flags.error).toBe('function');
      expect(typeof schema.error(new Error('x')).$flags.error).toBe('function');
      expect(typeof schema.error(() => 'x').$flags.error).toBe('function');
    });

    it('should resolve to the message when BaseSchema.$createError() is called', () => {
      expect(schema.error('x').$createError('any.ref', state, {}).message).toBe('x');
      expect(schema.error(new Error('x')).$createError('any.ref', state, {}).message).toBe('x');
      expect(schema.error(() => 'x').$createError('any.ref', state, {}).message).toBe('x');
    });
  });

  describe('BaseSchema.$validate()', () => {
    // Valid value: even numbers
    const next = new BaseSchema().define({
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

    const nextProto = Object.getPrototypeOf(next);

    describe('Valids', () => {
      it('should call BaseSchema.$createError() when the flag only is on and value is not one of the valids', () => {
        utils.spy(
          () =>
            next
              .valid(1)
              .only()
              .$validate(0, validateOpts, state),
          {
            proto: nextProto,
            method: '$createError',
            args: [
              'any.only',
              state,
              validateOpts.context,
              { grammar: { s: '', verb: 'is' }, values: new Values([1]) },
            ],
          },
        );

        utils.spy(
          () =>
            next
              .valid(1, 3)
              .only()
              .$validate(0, validateOpts, state),
          {
            proto: nextProto,
            method: '$createError',
            args: [
              'any.only',
              state,
              validateOpts.context,
              { grammar: { s: 's', verb: 'are' }, values: new Values([1, 3]) },
            ],
          },
        );
      });

      it('should pass if the value is one of the valid values', () => {
        expect(utils.isPass(next.valid(1).$validate(1, validateOpts, state))).toBe(true);
      });
    });

    describe('Invalids', () => {
      it('should call BaseSchema.$createError() when value is one of the invalids', () => {
        utils.spy(() => next.invalid(2).$validate(2, validateOpts, state), {
          proto: nextProto,
          method: '$createError',
          args: [
            'any.invalid',
            state,
            validateOpts.context,
            { grammar: { s: '', verb: 'is' }, values: new Values([2]) },
          ],
        });

        utils.spy(() => next.invalid(2, 4).$validate(2, validateOpts, state), {
          proto: nextProto,
          method: '$createError',
          args: [
            'any.invalid',
            state,
            validateOpts.context,
            { grammar: { s: 's', verb: 'are' }, values: new Values([2, 4]) },
          ],
        });
      });

      it('should pass if the value is not one of the invalid values', () => {
        expect(utils.isPass(next.invalid(2).$validate(4, validateOpts, state))).toBe(true);
      });
    });

    describe('Required', () => {
      it('should call BaseSchema.$createError() when value is undefined', () => {
        utils.spy(() => next.required().$validate(undefined, validateOpts, state), {
          proto: nextProto,
          method: '$createError',
          args: ['any.required', state, validateOpts.context, undefined],
        });
      });

      it('should pass if the value is not undefined', () => {
        expect(utils.isPass(next.required().$validate(2, validateOpts, state))).toBe(true);
      });
    });

    describe('Optional', () => {
      it('should return the default value', () => {
        expect(next.default(0).$validate(undefined, validateOpts, state).value).toBe(0);

        utils.spy(
          () => expect(next.default(ref).$validate(undefined, validateOpts, state).value).toBe(0),
          {
            proto: Ref.prototype,
            method: 'resolve',
            impl: () => 0,
          },
        );
      });
    });

    describe('Forbidden', () => {
      it('should call BaseSchema.$createError() when value is not undefined', () => {
        utils.spy(() => next.forbidden().$validate(2, validateOpts, state), {
          proto: nextProto,
          method: '$createError',
          args: ['any.forbidden', state, validateOpts.context, undefined],
        });
      });

      it('should pass if the value is undefined', () => {
        expect(utils.isPass(next.forbidden().$validate(undefined, validateOpts, state))).toBe(true);
      });
    });

    describe('Validate', () => {
      it('should pass if value meets the criteria', () => {
        expect(utils.isPass(next.$validate(2, validateOpts, state))).toBe(true);
      });

      it('should call BaseSchema.$createError() when fails to validate', () => {
        utils.spy(() => next.$validate('x', validateOpts, state), {
          proto: nextProto,
          method: '$createError',
          args: ['y', state, validateOpts.context, undefined],
        });
      });
    });

    describe('Coerce', () => {
      it('should not coerce if strict is set to true', () => {
        // validation fails here, but we only need to check for value
        expect(next.$validate('2', validateOpts, state).value).toBe(null);
      });

      it('should coerce the value if possible', () => {
        expect(next.$validate('2', { ...validateOpts, strict: false }, state).value).toBe(2);
      });

      it('should call BaseSchema.$createError() when fails to coerce', () => {
        utils.spy(() => next.$validate('x', { ...validateOpts, strict: false }, state), {
          proto: nextProto,
          method: '$createError',
          args: ['x', state, validateOpts.context, undefined],
        });
      });
    });

    describe('Rules', () => {
      it('should call BaseSchema.$createError() if parameters fail assertion', () => {
        utils.spy(
          () =>
            utils.spy(() => next.min(ref).$validate(2, validateOpts, state), {
              proto: nextProto,
              method: '$createError',
              args: ['any.ref', state, validateOpts.context, { ref, reason: 'must be a number' }],
            }),
          { proto: Ref.prototype, method: 'resolve', impl: () => 'x' },
        );
      });

      it('should pass if the value meets the criteria', () => {
        utils.spy(
          () => expect(utils.isPass(next.min(ref).$validate(2, validateOpts, state))).toBe(true),
          { proto: Ref.prototype, method: 'resolve', impl: () => 2 },
        );
      });

      it('should call BaseSchema.$createError() if the value fails to meet the criteria', () => {
        utils.spy(
          () =>
            utils.spy(() => next.min(ref).$validate(2, validateOpts, state), {
              proto: nextProto,
              method: '$createError',
              args: ['z', state, validateOpts.context, undefined],
            }),
          { proto: Ref.prototype, method: 'resolve', impl: () => 4 },
        );
      });
    });

    describe('Errors', () => {
      it('should collect all errors if abortEarly is set to false', () => {
        expect(
          next
            .valid(6)
            .invalid(2)
            .min(4)
            .only()
            .$validate(2, { ...validateOpts, abortEarly: false }, state).errors.length,
        ).toBe(3);
      });
    });

    describe('Options', () => {
      it('should apply options from the opts flag', () => {
        // Coercion should happen
        expect(next.opts({ strict: false }).$validate('2').value).toBe(2);
      });
    });

    describe('Conditions', () => {
      it('should resolve conditions and merge the schemas', () => {
        utils.spy(
          () => {
            const nextNext = next.$clone();

            nextNext._conditions.push(() => {
              if (ref.resolve() === 'x') return next.forbidden();

              return undefined;
            });

            utils.spy(() => nextNext.$validate(2, validateOpts, state), {
              proto: nextProto,
              method: '$createError',
              args: ['any.forbidden', state, validateOpts.context, undefined],
            });
          },
          {
            proto: Ref.prototype,
            method: 'resolve',
            impl: () => 'x',
          },
        );
      });
    });
  });

  describe('BaseSchema.validate()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.validate('x', 'x')).toThrow();
      expect(() => schema.validate('x', { strict: 'x' })).toThrow();
      expect(() => schema.validate('x', { abortEarly: 'x' })).toThrow();
      expect(() => schema.validate('x', { recursive: 'x' })).toThrow();
      expect(() => schema.validate('x', { allowUnknown: 'x' })).toThrow();
      expect(() => schema.validate('x', { stripUnknown: 'x' })).toThrow();
      expect(() => schema.validate('x', { context: 'x' })).toThrow();
    });

    it('should call BaseSchema.$validate()', () => {
      const opts = { strict: false };

      utils.spy(() => schema.validate('x', opts), {
        proto: BaseSchema.prototype,
        method: '$validate',
        args: [
          'x',
          {
            ...validateOpts,
            strict: false,
          },
          state,
        ],
      });
    });
  });

  describe('BaseSchema.when()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => schema.when('x')).toThrow();
      expect(() => schema.when(ref, 'x')).toThrow();
      expect(() => schema.when(ref, {})).toThrow();
      expect(() => schema.when(ref, { is: 'x' })).toThrow();
      expect(() => schema.when(ref, { is: schema, then: 'x' })).toThrow();
      expect(() => schema.when(ref, { is: schema, else: 'x' })).toThrow();
    });

    it('should call BaseSchema.$clone()', () => {
      utils.spy(() => schema.when(ref, { is: schema, then: schema }), {
        proto: BaseSchema.prototype,
        method: '$clone',
      });
    });

    it('should call BaseSchema.$mutateRef()', () => {
      utils.spy(() => schema.when(ref, { is: schema, then: schema }), {
        proto: BaseSchema.prototype,
        method: '$mutateRef',
        args: [ref],
      });
    });

    it('should resolve to the correct schema', () => {
      schema = schema.when(ref, {
        is: schema.valid('x').only(),
        then: schema.forbidden(),
        else: schema.invalid('y'),
      });

      utils.spy(
        () =>
          utils.spy(() => schema.validate('x'), {
            proto: BaseSchema.prototype,
            method: '$createError',
            args: ['any.forbidden', state, validateOpts.context, undefined],
          }),
        {
          proto: Ref.prototype,
          method: 'resolve',
          impl: () => 'x',
        },
      );

      utils.spy(
        () =>
          utils.spy(() => schema.validate('y'), {
            proto: BaseSchema.prototype,
            method: '$createError',
            args: ['any.invalid', state, validateOpts.context, undefined],
          }),
        {
          proto: Ref.prototype,
          method: 'resolve',
          impl: () => 'y',
        },
      );
    });
  });

  describe('Aliases', () => {
    for (const [methodName, aliases] of Object.entries(methods)) {
      // eslint-disable-next-line no-loop-func
      it(`BaseSchema.${methodName}() aliases`, () => {
        aliases.forEach(alias => {
          expect(schema[alias]).toBe(schema[methodName]);
        });
      });
    }
  });
});
