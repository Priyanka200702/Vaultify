const { env } = require('../config/env');

/**
 * Global error handler — catches all unhandled errors in routes.
 * Returns structured JSON. Never leaks stack traces in production.
 */
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_ERROR';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION';
  }

  if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY';
  }

  console.error(`[ERROR] ${err.message}`, env.NODE_ENV === 'development' ? err.stack : '');

  res.status(statusCode).json({
    error: errorCode,
    message: env.NODE_ENV === 'production'
      ? 'An internal error occurred'
      : err.message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Creates an operational error with status code.
 */
function createError(message, statusCode = 400, code = 'BAD_REQUEST') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

module.exports = { errorHandler, createError };
