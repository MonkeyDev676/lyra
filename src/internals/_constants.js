module.exports = {
  DEFAULT_VALIDATE_OPTS: {
    strict: true,
    abortEarly: true,
    recursive: true,
    allowUnknown: false,
    stripUnknown: false,
    context: {},
  },
  DEFAULT_SCHEMA_FLAGS: {
    strip: false,
    presence: 'optional',
    error: null,
    label: null,
    default: undefined,
    only: false,
  },
};
