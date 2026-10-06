import type { PrismaClient } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import type { z } from 'zod';
import type { AuthConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import { requireAuthenticated, authenticatedPrincipal } from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import { createRequireCsrf } from '../auth/csrf.middleware.js';
import type { OperationContext } from '../academic/academic.types.js';
import { createStudent, createEnrollment, patchStudent, patchActivation, listQuery, pageQuery, historyQuery, detailQuery, uuid } from './students.schemas.js';
import { StudentsService } from './students.service.js';

const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', 'Datos inválidos');
  return result.data;
};
const id = (request: Request, key: string) => parse(uuid, request.params[key]);
const context = (response: Response): OperationContext => {
  const principal = authenticatedPrincipal(response.locals);
  return { actorUserId: principal.userId, accountKind: principal.accountKind, requestId: String(response.locals.requestId) };
};
const query = (request: Request) => parse(listQuery, request.query);

export const createStudentsRouter = (db: PrismaClient, config: AuthConfig): Router => {
  const router = Router();
  const service = new StudentsService(db);
  const csrf = createRequireCsrf(config);
  router.use((_request, response, next) => { response.setHeader('cache-control', 'no-store'); next(); });
  router.use(requireAuthenticated(new AuthService(db, config), config.sessionCookieName));

  router.post('/institutions/:institutionId/courses/:courseId/students', csrf, async (request, response) => {
    response.status(201).json({ data: await service.createStudent(id(request, 'institutionId'), id(request, 'courseId'), parse(createStudent, request.body), context(response)) });
  });
  router.get('/institutions/:institutionId/students', async (request, response) => {
    response.json(await service.listStudents(id(request, 'institutionId'), query(request), context(response)));
  });
  router.get('/institutions/:institutionId/courses/:courseId/students', async (request, response) => {
    response.json(await service.listCourseStudents(id(request, 'institutionId'), id(request, 'courseId'), parse(pageQuery, request.query), context(response)));
  });
  router.get('/institutions/:institutionId/students/:studentId', async (request, response) => {
    const q = parse(detailQuery, request.query);
    response.json({ data: await service.studentDetail(id(request, 'institutionId'), id(request, 'studentId'), q.courseId, context(response)) });
  });
  router.patch('/institutions/:institutionId/students/:studentId', csrf, async (request, response) => {
    response.json({ data: await service.patchStudent(id(request, 'institutionId'), id(request, 'studentId'), parse(patchStudent, request.body), context(response)) });
  });
  router.patch('/institutions/:institutionId/students/:studentId/activation', csrf, async (request, response) => {
    response.json({ data: await service.patchActivation(id(request, 'institutionId'), id(request, 'studentId'), parse(patchActivation, request.body), context(response)) });
  });
  router.post('/institutions/:institutionId/courses/:courseId/enrollments', csrf, async (request, response) => {
    response.status(201).json({ data: { enrollment: await service.createEnrollment(id(request, 'institutionId'), id(request, 'courseId'), parse(createEnrollment, request.body), context(response)) } });
  });
  router.get('/institutions/:institutionId/enrollments/:enrollmentId', async (request, response) => {
    response.json({ data: await service.enrollmentDetail(id(request, 'institutionId'), id(request, 'enrollmentId'), context(response)) });
  });
  router.get('/institutions/:institutionId/students/:studentId/enrollments', async (request, response) => {
    response.json(await service.listEnrollments(id(request, 'institutionId'), id(request, 'studentId'), parse(historyQuery, request.query), context(response)));
  });
  return router;
};
