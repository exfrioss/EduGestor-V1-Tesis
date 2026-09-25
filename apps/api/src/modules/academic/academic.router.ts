import type { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import type { AuthConfig } from '../../config.js';
import { requireAuthenticated } from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import { createRequireCsrf } from '../auth/csrf.middleware.js';
import { AcademicController } from './academic.controller.js';
import { AcademicService } from './academic.service.js';

export const createAcademicRouter = (client: PrismaClient, config: AuthConfig): Router => {
  const router = Router();
  const controller = new AcademicController(new AcademicService(client));
  const requireSession = requireAuthenticated(new AuthService(client, config), config.sessionCookieName);
  const requireCsrf = createRequireCsrf(config);

  router.use(requireSession);
  router.use((_request, response, next) => {
    response.setHeader('cache-control', 'no-store');
    next();
  });

  router.post('/institutions', requireCsrf, controller.createInstitution);
  router.get('/institutions', controller.listInstitutions);
  router.get('/institutions/:institutionId', controller.getInstitution);
  router.patch('/institutions/:institutionId', requireCsrf, controller.updateInstitution);
  router.post('/institutions/:institutionId/activate', requireCsrf, controller.activateInstitution);
  router.post('/institutions/:institutionId/reactivate', requireCsrf, controller.activateInstitution);
  router.post('/institutions/:institutionId/deactivate', requireCsrf, controller.deactivateInstitution);

  router.post('/institutions/:institutionId/teachers', requireCsrf, controller.createTeacher);
  router.get('/institutions/:institutionId/teachers', controller.listTeachers);
  router.get('/institutions/:institutionId/teachers/:teacherId', controller.getTeacher);
  router.patch('/institutions/:institutionId/teachers/:teacherId', requireCsrf, controller.updateTeacher);
  router.post('/institutions/:institutionId/teachers/:teacherId/activate', requireCsrf, controller.activateTeacher);
  router.post('/institutions/:institutionId/teachers/:teacherId/reactivate', requireCsrf, controller.activateTeacher);
  router.post('/institutions/:institutionId/teachers/:teacherId/deactivate', requireCsrf, controller.deactivateTeacher);
  router.post('/institutions/:institutionId/teachers/:teacherId/link', requireCsrf, controller.linkTeacher);
  router.post('/institutions/:institutionId/teachers/:teacherId/unlink', requireCsrf, controller.unlinkTeacher);

  router.post('/institutions/:institutionId/academic-years', requireCsrf, controller.createAcademicYear);
  router.get('/institutions/:institutionId/academic-years', controller.listAcademicYears);
  router.get('/institutions/:institutionId/academic-years/current', controller.getCurrentAcademicYear);
  router.get('/academic-years/:academicYearId', controller.getAcademicYear);
  router.patch('/academic-years/:academicYearId', requireCsrf, controller.updateAcademicYear);

  router.post('/courses', requireCsrf, controller.createCourse);
  router.get('/courses', controller.listCourses);
  router.get('/courses/:courseId', controller.getCourse);
  router.patch('/courses/:courseId', requireCsrf, controller.updateCourse);
  router.post('/courses/:courseId/activate', requireCsrf, controller.activateCourse);
  router.post('/courses/:courseId/reactivate', requireCsrf, controller.activateCourse);
  router.post('/courses/:courseId/deactivate', requireCsrf, controller.deactivateCourse);

  router.post('/subjects', requireCsrf, controller.createSubject);
  router.get('/subjects', controller.listSubjects);
  router.get('/subjects/:subjectId', controller.getSubject);
  router.patch('/subjects/:subjectId', requireCsrf, controller.updateSubject);
  router.post('/subjects/:subjectId/activate', requireCsrf, controller.activateSubject);
  router.post('/subjects/:subjectId/reactivate', requireCsrf, controller.activateSubject);
  router.post('/subjects/:subjectId/deactivate', requireCsrf, controller.deactivateSubject);

  router.post('/teaching-assignments', requireCsrf, controller.createTeachingAssignment);
  router.get('/teaching-assignments', controller.listTeachingAssignments);
  router.get('/teaching-assignments/:assignmentId', controller.getTeachingAssignment);
  router.post('/teaching-assignments/:assignmentId/retire', requireCsrf, controller.retireTeachingAssignment);
  router.post('/teaching-assignments/:assignmentId/reactivate', requireCsrf, controller.reactivateTeachingAssignment);
  router.get('/me/teaching-assignments', controller.listMyTeachingAssignments);

  return router;
};
