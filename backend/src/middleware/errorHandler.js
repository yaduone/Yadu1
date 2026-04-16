const { error } = require('../utils/response');

function errorHandler(err, req, res, _next) {
  console.error('Unhandled error:', err);

  if (err.type === 'entity.parse.failed') {
    return error(res, 'Invalid JSON in request body', 400);
  }

  return error(res, err.message || 'Internal Server Error', err.statusCode || 500);
}

module.exports = errorHandler;
