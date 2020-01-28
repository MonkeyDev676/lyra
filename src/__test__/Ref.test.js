const Ref = require('../Ref');

describe('Ref', () => {
  it('should throw when incorrect parameters are passed', () => {
    expect(() => new Ref(1)).toThrow();
    expect(() => new Ref('x', 'x')).toThrow();
    expect(() => new Ref('x', { separator: 1 })).toThrow();
  });

  it('should not override ownProperties to false', () => {
    const test = Object.create({ a: 'x' });

    expect(
      new Ref('a', {
        ownProperties: false,
      })._get(test), // Access the getter and use it
    ).toBe(undefined);
  });

  it('should have correct display', () => {
    expect(new Ref('a')._display).toBe('ref:a');
  });
});
