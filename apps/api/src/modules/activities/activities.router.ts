import type { PrismaClient } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import type { z } from 'zod';
import type { AuthConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import type { OperationContext } from '../academic/academic.types.js';
import { authenticatedPrincipal, requireAuthenticated } from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import { createRequireCsrf } from '../auth/csrf.middleware.js';
import * as S from './activities.schemas.js';
import { ActivitiesService } from './activities.service.js';

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', 'Datos inválidos');
  return result.data;
};
const id = (request: Request, key: string) => parse(S.uuid, request.params[key]);
const ctx = (response: Response): OperationContext => {
  const principal = authenticatedPrincipal(response.locals);
  return { actorUserId: principal.userId, accountKind: principal.accountKind, requestId: String(response.locals.requestId) };
};
export const createActivitiesRouter = (db: PrismaClient, config: AuthConfig): Router => {
  const router = Router(); const service = new ActivitiesService(db); const csrf = createRequireCsrf(config);
  router.use((_request, response, next) => { response.setHeader('cache-control', 'no-store'); next(); });
  router.use(requireAuthenticated(new AuthService(db, config), config.sessionCookieName));

  const bank = '/institutions/:institutionId/me/activity-bank/items';
  router.get(bank, async (req, res) => res.json(await service.listBank(id(req, 'institutionId'), parse(S.bankPage, req.query), ctx(res))));
  router.get(`${bank}/:itemId`, async (req, res) => res.json({ data: await service.getBank(id(req, 'institutionId'), id(req, 'itemId'), ctx(res)) }));
  router.post(bank, csrf, async (req, res) => res.status(201).json({ data: await service.createBank(id(req, 'institutionId'), parse(S.bankCreate, req.body), ctx(res)) }));
  router.patch(`${bank}/:itemId`, csrf, async (req, res) => res.json({ data: await service.patchBank(id(req, 'institutionId'), id(req, 'itemId'), parse(S.bankPatch, req.body), ctx(res)) }));

  const base = '/teaching-assignments/:assignmentId';
  router.get(`${base}/tasks`, async (req, res) => res.json(await service.listTasks(id(req, 'assignmentId'), parse(S.page, req.query), ctx(res))));
  router.get(`${base}/tasks/:taskId`, async (req, res) => res.json({ data: await service.getTask(id(req, 'assignmentId'), id(req, 'taskId'), ctx(res)) }));
  router.post(`${base}/tasks`, csrf, async (req, res) => res.status(201).json({ data: await service.createTask(id(req, 'assignmentId'), parse(S.taskCreate, req.body), ctx(res)) }));
  router.post(`${base}/tasks/:taskId/reuse`, csrf, async (req, res) => res.status(201).json({ data: await service.reuseTask(id(req, 'assignmentId'), id(req, 'taskId'), parse(S.taskReuse, req.body), ctx(res)) }));
  router.patch(`${base}/tasks/:taskId`, csrf, async (req, res) => res.json({ data: await service.patchTask(id(req, 'assignmentId'), id(req, 'taskId'), parse(S.taskPatch, req.body), ctx(res)) }));

  router.get(`${base}/assessments`, async (req, res) => res.json(await service.listAssessments(id(req, 'assignmentId'), parse(S.assessmentPage, req.query), ctx(res))));
  router.get(`${base}/assessments/:assessmentId`, async (req, res) => res.json({ data: await service.getAssessment(id(req, 'assignmentId'), id(req, 'assessmentId'), ctx(res)) }));
  router.post(`${base}/assessments`, csrf, async (req, res) => res.status(201).json({ data: await service.createAssessment(id(req, 'assignmentId'), parse(S.assessmentCreate, req.body), ctx(res)) }));
  router.post(`${base}/assessments/:assessmentId/reuse`, csrf, async (req, res) => res.status(201).json({ data: await service.reuseAssessment(id(req, 'assignmentId'), id(req, 'assessmentId'), parse(S.assessmentReuse, req.body), ctx(res)) }));
  router.patch(`${base}/assessments/:assessmentId`, csrf, async (req, res) => res.json({ data: await service.patchAssessment(id(req, 'assignmentId'), id(req, 'assessmentId'), parse(S.assessmentPatch, req.body), ctx(res)) }));
  router.post(`${base}/assessments/:assessmentId/link-task`, csrf, async (req, res) => res.json({ data: await service.linkTask(id(req, 'assignmentId'), id(req, 'assessmentId'), parse(S.linkTask, req.body), ctx(res)) }));
  router.get(`${base}/assessments/:assessmentId/results`, async (req, res) => res.json(await service.listResults(id(req, 'assignmentId'), id(req, 'assessmentId'), parse(S.page, req.query), ctx(res))));
  router.put(`${base}/assessments/:assessmentId/results/:enrollmentId`, csrf, async (req, res) => { const result = await service.putAssessmentResult(id(req, 'assignmentId'), id(req, 'assessmentId'), id(req, 'enrollmentId'), parse(S.resultPut, req.body), ctx(res)); res.status(result.created ? 201 : 200).json({ data: result.data }); });
  router.put(`${base}/tasks/:taskId/results/:enrollmentId`, csrf, async (req, res) => { const input = parse(S.resultPut, req.body); if (input.expectedTaskVersion === undefined) throw new AppError(400, 'VALIDATION_ERROR', 'Versión de tarea obligatoria'); const result = await service.putTaskResult(id(req, 'assignmentId'), id(req, 'taskId'), id(req, 'enrollmentId'), input, ctx(res)); res.status(result.created ? 201 : 200).json({ data: result.data }); });
  router.get(`${base}/process`, async (req, res) => res.json(await service.process(id(req, 'assignmentId'), parse(S.page, req.query), ctx(res))));
  return router;
};
