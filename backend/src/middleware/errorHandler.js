const { error } = require('../utils/response');

function errorHandler(err, req, res, _next) {
  console.error('Unhandled error:', err);

  if (err.type === 'entity.parse.failed') {
    return error(res, 'Invalid JSON in request body', 400);
  }

  // Deliberate HTTP errors may carry a machine-readable code (e.g.
  // TARGET_DATE_CHANGED) so a client can react without parsing the message.
  const details = err.statusCode && typeof err.code === 'string'
    ? { code: err.code, ...(err.details || {}) }
    : null;

  return error(res, err.message || 'Internal Server Error', err.statusCode || 500, details);
}

module.exports = errorHandler;
