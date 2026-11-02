import type { PrismaClient } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import type { z } from 'zod';
import type { AuthConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import { authenticatedPrincipal, requireAuthenticated } from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import { createRequireCsrf } from '../auth/csrf.middleware.js';
import { GradingService, type GradingContext } from './grading.service.js';
import * as S from './grading.schemas.js';

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', 'Datos inválidos');
  return result.data;
};
const id = (request: Request, key: string) => parse(S.uuid, request.params[key]);
const ctx = (response: Response): GradingContext => {
  const principal = authenticatedPrincipal(response.locals);
  return { actorUserId: principal.userId, accountKind: principal.accountKind, authSessionId: principal.sessionId, requestId: String(response.locals.requestId) };
};

export const createGradingRouter = (db: PrismaClient, config: AuthConfig): Router => {
  const router = Router(), service = new GradingService(db, config), csrf = createRequireCsrf(config);
  router.use((_req, response, next) => { response.setHeader('cache-control', 'no-store'); next(); });
  router.use(requireAuthenticated(new AuthService(db, config), config.sessionCookieName));
  const scales = '/institutions/:institutionId/grading-scales';
  router.get(scales, async (req, res) => res.json(await service.list(id(req, 'institutionId'), parse(S.page, req.query), ctx(res))));
  router.get(`${scales}/:scaleId`, async (req, res) => res.json({ data: await service.get(id(req, 'institutionId'), id(req, 'scaleId'), ctx(res)) }));
  router.post(scales, csrf, async (req, res) => res.status(201).json({ data: await service.create(id(req, 'institutionId'), parse(S.create, req.body), ctx(res)) }));
  router.post(`${scales}/:scaleId/versions`, csrf, async (req, res) => res.status(201).json({ data: await service.createVersion(id(req, 'institutionId'), id(req, 'scaleId'), parse(S.version, req.body), ctx(res)) }));
  const base = '/teaching-assignments/:assignmentId';
  router.get(`${base}/grading-scale`, async (req, res) => res.json({ data: await service.assignedScale(id(req, 'assignmentId'), ctx(res)) }));
  router.post(`${base}/grading-scale/change-preview`, csrf, async (req, res) => res.json({ data: await service.scalePreview(id(req, 'assignmentId'), parse(S.scaleChange, req.body), ctx(res)) }));
  router.put(`${base}/grading-scale`, csrf, async (req, res) => res.json({ data: await service.scaleConfirm(id(req, 'assignmentId'), parse(S.scaleConfirm, req.body), ctx(res)) }));
  router.post(`${base}/tasks/:taskId/max-points/preview`, csrf, async (req, res) => res.json({ data: await service.maxPreview(id(req, 'assignmentId'), id(req, 'taskId'), 'task', parse(S.maxChange, req.body), ctx(res)) }));
  router.patch(`${base}/tasks/:taskId/max-points`, csrf, async (req, res) => res.json({ data: await service.maxConfirm(id(req, 'assignmentId'), id(req, 'taskId'), 'task', parse(S.maxConfirm, req.body), ctx(res)) }));
  router.post(`${base}/assessments/:assessmentId/max-points/preview`, csrf, async (req, res) => res.json({ data: await service.maxPreview(id(req, 'assignmentId'), id(req, 'assessmentId'), 'assessment', parse(S.maxChange, req.body), ctx(res)) }));
  router.patch(`${base}/assessments/:assessmentId/max-points`, csrf, async (req, res) => res.json({ data: await service.maxConfirm(id(req, 'assignmentId'), id(req, 'assessmentId'), 'assessment', parse(S.maxConfirm, req.body), ctx(res)) }));
  return router;
};
