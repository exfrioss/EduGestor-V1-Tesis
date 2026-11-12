import type { PrismaClient } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import type { z } from 'zod';
import type { AuthConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import type { OperationContext } from '../academic/academic.types.js';
import { authenticatedPrincipal, requireAuthenticated } from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import { createRequireCsrf } from '../auth/csrf.middleware.js';
import * as S from './attendance.schemas.js';
import { AttendanceService } from './attendance.service.js';

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', 'Datos inválidos');
  return result.data;
};
const id = (request: Request, key: string) => parse(S.uuid, request.params[key]);
const context = (response: Response): OperationContext => {
  const principal = authenticatedPrincipal(response.locals);
  return { actorUserId: principal.userId, accountKind: principal.accountKind, requestId: String(response.locals.requestId) };
};

export const createAttendanceRouter = (db: PrismaClient, config: AuthConfig): Router => {
  const router = Router();
  const service = new AttendanceService(db);
  const csrf = createRequireCsrf(config);
  router.use((_request, response, next) => { response.setHeader('cache-control', 'no-store'); next(); });
  router.use(requireAuthenticated(new AuthService(db, config), config.sessionCookieName));

  const sessions = '/teaching-assignments/:assignmentId/attendance-sessions';
  router.post(sessions, csrf, async (req, res) => {
    res.status(201).json({ data: await service.createSession(id(req, 'assignmentId'), parse(S.sessionCreate, req.body), context(res)) });
  });
  router.get(sessions, async (req, res) => {
    res.json(await service.listSessions(id(req, 'assignmentId'), parse(S.sessionQuery, req.query), context(res)));
  });
  router.get(`${sessions}/:sessionId`, async (req, res) => {
    res.json({ data: await service.getSession(id(req, 'assignmentId'), id(req, 'sessionId'), context(res)) });
  });
  router.put(`${sessions}/:sessionId/records/batch`, csrf, async (req, res) => {
    res.json({ data: await service.putBatch(id(req, 'assignmentId'), id(req, 'sessionId'), parse(S.batchPut, req.body), context(res)) });
  });
  router.put(`${sessions}/:sessionId/records/:enrollmentId`, csrf, async (req, res) => {
    const result = await service.putRecord(id(req, 'assignmentId'), id(req, 'sessionId'), id(req, 'enrollmentId'), parse(S.recordPut, req.body), context(res));
    res.status(result.created ? 201 : 200).json({ data: result.data });
  });
  router.get('/institutions/:institutionId/courses/:courseId/attendance-sessions', async (req, res) => {
    res.json(await service.listCourseSessions(id(req, 'institutionId'), id(req, 'courseId'), parse(S.courseQuery, req.query), context(res)));
  });
  router.get('/institutions/:institutionId/enrollments/:enrollmentId/attendance', async (req, res) => {
    res.json(await service.listEnrollmentHistory(id(req, 'institutionId'), id(req, 'enrollmentId'), parse(S.historyQuery, req.query), context(res)));
  });
  return router;
};
