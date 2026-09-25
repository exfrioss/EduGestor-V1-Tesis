import type { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import type { AuthConfig } from '../../config.js';
import { requireAuthenticated } from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import { createRequireCsrf } from '../auth/csrf.middleware.js';
import { CurriculumController } from './curriculum.controller.js';
import { CurriculumService } from './curriculum.service.js';

export const createCurriculumRouter = (client: PrismaClient, config: AuthConfig): Router => {
  const router = Router();
  const controller = new CurriculumController(new CurriculumService(client));
  const requireCsrf = createRequireCsrf(config);
  router.use(requireAuthenticated(new AuthService(client, config), config.sessionCookieName));
  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  router.get('/curriculum/plan-types', controller.listPlanTypes);
  router.get('/curriculum/plan-types/:planTypeId/academic-areas', controller.listAcademicAreas);
  router.get('/curriculum/disciplines', controller.listDisciplines);
  router.post('/curriculum/plan-types', requireCsrf, controller.createPlanType);
  router.patch('/curriculum/plan-types/:id', requireCsrf, controller.updatePlanType);
  router.post('/curriculum/academic-areas', requireCsrf, controller.createAcademicArea);
  router.patch('/curriculum/academic-areas/:id', requireCsrf, controller.updateAcademicArea);
  router.post('/curriculum/disciplines', requireCsrf, controller.createDiscipline);
  router.patch('/curriculum/disciplines/:id', requireCsrf, controller.updateDiscipline);

  const mappings = '/institutions/:institutionId/subjects/:subjectId/curriculum-mappings';
  router.get(mappings, controller.listMappings);
  router.post(mappings, requireCsrf, controller.createMapping);
  router.post(`${mappings}/:mappingId/retire`, requireCsrf, controller.retireMapping);
  router.post(`${mappings}/:mappingId/replace`, requireCsrf, controller.replaceMapping);
  return router;
};
