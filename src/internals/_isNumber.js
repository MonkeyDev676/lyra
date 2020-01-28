module.exports = function _isNumber(value) {
  return typeof value === 'number' && !Number.isNaN(value);
};
