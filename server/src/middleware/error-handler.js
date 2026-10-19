import { ZodError } from 'zod';
import { AppError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import { config } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  const requestId = req.id || 'unknown';

  // Handle Zod validation errors directly if not caught earlier
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message
    }));
    logger.warn('Request validation error', { requestId, path: req.path, details });
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details,
        requestId
      }
    });
  }

  // Handle JSON parsing syntax error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.warn('Malformed JSON payload', { requestId, path: req.path });
    return res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload',
        requestId
      }
    });
  }

  // Handle known operational AppError
  if (err instanceof AppError) {
    logger.warn(`Operational error: ${err.message}`, {
      requestId,
      code: err.errorCode,
      statusCode: err.statusCode,
      details: err.details
    });
    return res.status(err.statusCode).json({
      error: {
        code: err.errorCode,
        message: err.message,
        details: err.details || undefined,
        requestId
      }
    });
  }

  // Handle unexpected internal errors
  logger.error('Unhandled internal server error', {
    requestId,
    message: err.message,
    stack: config.NODE_ENV !== 'production' ? err.stack : undefined
  });

  const message = config.NODE_ENV === 'production'
    ? 'An unexpected error occurred. Please try again later.'
    : err.message;

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message,
      requestId
    }
  });
}
