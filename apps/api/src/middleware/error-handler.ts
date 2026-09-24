import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = String(response.locals.requestId ?? 'unknown');

  if (error instanceof AppError) {
    request.log.warn({ error, requestId }, 'Solicitud rechazada');
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  request.log.error({ error, requestId }, 'Error no controlado');
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
      requestId,
    },
  });
};
