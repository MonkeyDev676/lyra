const string = require('../../schemas/string');
const utils = require('../utils');

describe('string', () => {
  describe('Validate', () => {
    it('should validate correctly', () => {
      utils.validate(string, 'x', { result: 'x' });
      utils.validate(string, 1, { pass: false, result: { code: 'string.base' } });
    });
  });

  describe('Coerce', () => {
    it('should coerce any js values to strings', () => {
      utils.validate(string, 1, { opts: { strict: false }, result: '1' });
      utils.validate(string, true, { opts: { strict: false }, result: 'true' });
    });

    it.each(['upper', 'lower'])('should coerce string to %scase if specified', dir => {
      const name = `${dir}case`;
      const schema = string.$clone();

      schema._singleRules = new Set(['case']);
      schema._rules = [{ name, identifier: 'case', params: { dir } }];

      utils.validate(schema, 'xYz', {
        opts: { strict: false },
        result: dir === 'upper' ? 'XYZ' : 'xyz',
      });
    });

    it('should trim string if specified', () => {
      const schema = string.$clone();

      schema._singleRules = new Set(['trim']);
      schema._rules = [{ name: 'trim', identifier: 'trim', params: { enabled: true } }];

      utils.validate(schema, ' x ', { opts: { strict: false }, result: 'x' });

      schema._rules = [{ name: 'trim', identifier: 'trim', params: { enabled: false } }];

      utils.validate(schema, ' x ', { opts: { strict: false }, result: ' x ' });
    });

    it('should replace string if specified', () => {
      const schema = string.$clone();

      schema.$flags.replace = ['x', 'a'];

      utils.validate(schema, 'xyx', { opts: { strict: false }, result: 'ayx' });

      schema.$flags.replace = [/x/g, 'a'];

      utils.validate(schema, 'xyx', { opts: { strict: false }, result: 'aya' });
    });
  });

  describe.each(['max', 'min', 'length'])('string.%s()', method => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => string[method]('x')).toThrow();
      expect(() => string[method](NaN)).toThrow();
    });

    let valid;
    let invalid;
    const isMax = method === 'max';
    const isMin = method === 'min';

    if (isMax) {
      valid = 'x';
      invalid = 'xyz';
    }

    if (isMin) {
      valid = 'xyz';
      invalid = 'x';
    }

    if (method === 'length') {
      valid = 'xy';
      invalid = 'x';
    }

    it('should compare against the specified length', () => {
      const schema = string[method](2);

      utils.validate(schema, valid, { result: valid });

      if (isMax || isMin) utils.validate(schema, 'xy', { result: 'xy' });

      utils.validate(schema, invalid, {
        pass: false,
        result: { code: `string.${method}`, lookup: { length: 2 } },
      });
    });
  });

  describe('string.creditCard()', () => {
    it('should validate credit card numbers', () => {
      const schema = string.creditCard();

      // Test data copied from @hapi/joi tests
      [
        '378734493671000', // american express
        '371449635398431', // american express
        '378282246310005', // american express
        '341111111111111', // american express
        '5610591081018250', // australian bank
        '5019717010103742', // dankort pbs
        '38520000023237', // diners club
        '30569309025904', // diners club
        '6011000990139424', // discover
        '6011111111111117', // discover
        '6011601160116611', // discover
        '3566002020360505', // jbc
        '3530111333300000', // jbc
        '5105105105105100', // mastercard
        '5555555555554444', // mastercard
        '5431111111111111', // mastercard
        '6331101999990016', // switch/solo paymentech
        '4222222222222', // visa
        '4012888888881881', // visa
        '4111111111111111', // visa
      ].forEach(input => utils.validate(schema, input, { result: input }));

      ['4111111111111112', '411111111111111X'].forEach(input =>
        utils.validate(schema, input, { pass: false, result: { code: 'string.creditCard' } }),
      );
    });
  });

  describe('string.pattern()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => string.pattern('x')).toThrow();
    });

    it('should validate string patterns', () => {
      const regexp = /^[a-z]+$/g;
      const schema = string.pattern(regexp);

      utils.validate(schema, 'abcxyz', { result: 'abcxyz' });
      utils.validate(schema, 'abc123', {
        pass: false,
        result: { code: 'string.pattern', lookup: { regexp } },
      });
    });

    it('should validate multiple string patterns', () => {
      const regexp1 = /^[a-zX-Z]+$/g;
      const regexp2 = /^[A-Za-c]+$/g;
      const schema = string.pattern(regexp1).pattern(regexp2);

      utils.validate(schema, 'abcXYZ', { result: 'abcXYZ' });
      utils.validate(schema, 'ABCXYZ', {
        pass: false,
        result: { code: 'string.pattern', lookup: { regexp: regexp1 } },
      });
      utils.validate(schema, 'abcxyz', {
        pass: false,
        result: { code: 'string.pattern', lookup: { regexp: regexp2 } },
      });
    });
  });

  describe('string.email()', () => {
    it('should validate email addresses', () => {
      const schema = string.email();

      [
        'email@example.com', // Normal email
        'abcê@example.com', // With accents
        'firstname.lastname@example.com', // Dot in address field
        'email@subdomain.example.com', // Subdomain
        'firstname+lastname@example.com', // Plus sign
        'email@192.0.2.123', // Domain field is a valid IP address
        'email@[192.0.2.123]', // IP address with square brackets
        '“email”@example.com', // Double quotes
        '1234567890@example.com', // Digits
        'email@domain-one.example', // Dashes in domain name
        '_______@example.com', // Underscores in address field
        'email@example.name', // .name is a valid top domain name
        'email@example.co.jp', // Dot in top domain name
        'firstname-lastname@example.com', // Dashes in address field
      ].forEach(input => utils.validate(schema, input, { result: input }));

      ['@example.com', '@example', ''].forEach(input =>
        utils.validate(schema, input, { pass: false, result: { code: 'string.email' } }),
      );
    });
  });

  describe('string.url()', () => {
    it('should validate urls', () => {
      const schema = string.url();

      // Test cases copied from https://mathiasbynens.be/demo/url-regex
      [
        'http://foo.com/blah_blah',
        'http://foo.com/blah_blah/',
        'http://foo.com/blah_blah_(wikipedia)',
        'http://foo.com/blah_blah_(wikipedia)_(again)',
        'http://www.example.com/wpstyle/?p=364',
        'https://www.example.com/foo/?bar=baz&inga=42&quux',
        'http://✪df.ws/123',
        'http://userid:password@example.com:8080',
        'http://userid:password@example.com:8080/',
        'http://userid@example.com',
        'http://userid@example.com/',
        'http://userid@example.com:8080',
        'http://userid@example.com:8080/',
        'http://userid:password@example.com',
        'http://userid:password@example.com/',
        'http://142.42.1.1/',
        'http://142.42.1.1:8080/',
        'http://➡.ws/䨹',
        'http://⌘.ws',
        'http://⌘.ws/',
        'http://foo.com/blah_(wikipedia)#cite-1',
        'http://foo.com/blah_(wikipedia)_blah#cite-1',
        'http://foo.com/unicode_(✪)_in_parens',
        'http://foo.com/(something)?after=parens',
        'http://☺.damowmow.com/',
        'http://code.google.com/events/#&product=browser',
        'http://j.mp',
        'ftp://foo.bar/baz',
        'http://foo.bar/?q=Test%20URL-encoded%20stuff',
        'http://مثال.إختبار',
        'http://例子.测试',
        'http://उदाहरण.परीक्षा',
        "http://-.~_!$&'()*+,;=:%40:80%2f::::::@example.com",
        'http://1337.net',
        'http://a.b-c.de',
        'http://223.255.255.254',
      ].forEach(input => utils.validate(schema, input, { result: input }));

      [
        'http://',
        'http://.',
        'http://..',
        'http://../',
        'http://?',
        'http://??',
        'http://??/',
        'http://#',
        'http://##',
        'http://##/',
        'http://foo.bar?q=Spaces should be encoded',
        '//',
        '//a',
        '///a',
        '///',
        'http:///a',
        'foo.com',
        'rdar://1234',
        'h://test',
        'http:// shouldfail.com',
        ':// should fail',
        'http://foo.bar/foo(bar)baz quux',
        'ftps://foo.bar/',
        'http://.www.foo.bar/',
        'http://.www.foo.bar./',
      ].forEach(input =>
        utils.validate(schema, input, { pass: false, result: { code: 'string.url' } }),
      );
    });
  });

  describe('string.alphanum()', () => {
    it('should validate alpha-numeric strings', () => {
      const schema = string.alphanum();

      utils.validate(schema, 'abCXYz123', { result: 'abCXYz123' });
      utils.validate(schema, 'abC XYz 123', { pass: false, result: { code: 'string.alphanum' } });
      utils.validate(schema, 'abC!XYz', { pass: false, result: { code: 'string.alphanum' } });
    });
  });

  describe('string.numeric()', () => {
    it('should validate numeric strings', () => {
      const schema = string.numeric();

      utils.validate(schema, '123', { result: '123' });
      utils.validate(schema, 'a123', { pass: false, result: { code: 'string.numeric' } });
      utils.validate(schema, '$!123', { pass: false, result: { code: 'string.numeric' } });
    });
  });

  describe.each(['uppercase', 'lowercase'])('string.%s()', method => {
    const invalid = 'aBcxYZ';
    const valid = method === 'uppercase' ? 'ABCXYZ' : 'abcxyz';

    it(`should validate ${method} strings`, () => {
      const schema = string[method]();

      utils.validate(schema, valid, { result: valid });
      utils.validate(schema, invalid, { pass: false, result: { code: `string.${method}` } });
    });
  });

  describe('string.trim()', () => {
    it('should validate trimmed strings', () => {
      const schema = string.trim();

      utils.validate(schema, 'x', { result: 'x' });
      utils.validate(schema, ' x ', { pass: false, result: { code: 'string.trim' } });
    });
  });

  describe('string.replace()', () => {
    it('should throw when incorrect parameters are passed', () => {
      expect(() => string.replace()).toThrow();
      expect(() => string.replace(1)).toThrow();
      expect(() => string.replace('x', 1)).toThrow();
    });

    it('should set the replace flag', () => {
      const spy = jest.spyOn(Object.getPrototypeOf(string), '$setFlag');

      string.replace('x', 'y');

      expect(utils.callWith(spy, { args: ['replace', ['x', 'y']] })).toBe(true);

      spy.mockRestore();
    });
  });
});
