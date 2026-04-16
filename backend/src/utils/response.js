/**
 * Standardized API response helpers.
 */

function success(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
}

function created(res, data = null, message = 'Created') {
  return success(res, data, message, 201);
}

function error(res, message = 'Internal Server Error', statusCode = 500, details = null) {
  const body = {
    success: false,
    error: message,
  };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
}

function badRequest(res, message = 'Bad Request', details = null) {
  return error(res, message, 400, details);
}

function unauthorized(res, message = 'Unauthorized') {
  return error(res, message, 401);
}

function forbidden(res, message = 'Forbidden') {
  return error(res, message, 403);
}

function notFound(res, message = 'Not Found') {
  return error(res, message, 404);
}

module.exports = { success, created, error, badRequest, unauthorized, forbidden, notFound };
