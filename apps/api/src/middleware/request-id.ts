import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const requestId: RequestHandler = (request, response, next) => {
  const candidate = request.header('x-request-id');
  const id = candidate !== undefined && UUID_PATTERN.test(candidate) ? candidate : randomUUID();
  response.locals.requestId = id;
  response.setHeader('x-request-id', id);
  next();
};
