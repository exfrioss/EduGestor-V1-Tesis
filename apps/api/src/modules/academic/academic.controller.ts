import type { Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../../errors/app-error.js';
import { authenticatedPrincipal } from '../auth/auth.middleware.js';
import {
  assignmentListSchema,
  createAcademicYearSchema,
  createCourseSchema,
  createInstitutionSchema,
  createSubjectSchema,
  createTeacherSchema,
  createTeachingAssignmentSchema,
  updateAcademicYearSchema,
  updateCourseSchema,
  updateInstitutionSchema,
  updateSubjectSchema,
  updateTeacherSchema,
  uuidSchema,
} from './academic.schemas.js';
import { AcademicService } from './academic.service.js';
import type { OperationContext } from './academic.types.js';

const parse = <T>(schema: ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', 'Datos inválidos');
  return result.data;
};

const param = (request: Request, name: string): string => {
  const value = request.params[name];
  return parse(uuidSchema, typeof value === 'string' ? value : undefined);
};

const context = (response: Response): OperationContext => {
  const principal = authenticatedPrincipal(response.locals);
  return {
    actorUserId: principal.userId,
    accountKind: principal.accountKind,
    requestId: String(response.locals.requestId),
  };
};

export class AcademicController {
  constructor(private readonly service: AcademicService) {}

  createInstitution = async (request: Request, response: Response) => {
    const created = await this.service.createInstitution(
      parse(createInstitutionSchema, request.body),
      context(response),
    );
    response.status(201).json({ institution: created });
  };

  listInstitutions = async (_request: Request, response: Response) => {
    response.status(200).json({ institutions: await this.service.listInstitutions(context(response)) });
  };

  getInstitution = async (request: Request, response: Response) => {
    response.status(200).json({
      institution: await this.service.getInstitution(param(request, 'institutionId'), context(response)),
    });
  };

  updateInstitution = async (request: Request, response: Response) => {
    response.status(200).json({
      institution: await this.service.updateInstitution(
        param(request, 'institutionId'),
        parse(updateInstitutionSchema, request.body),
        context(response),
      ),
    });
  };

  activateInstitution = (request: Request, response: Response) =>
    this.institutionState(request, response, true);
  deactivateInstitution = (request: Request, response: Response) =>
    this.institutionState(request, response, false);

  createTeacher = async (request: Request, response: Response) => {
    const institutionId = param(request, 'institutionId');
    const created = await this.service.createTeacher(
      { ...parse(createTeacherSchema, request.body), institutionId },
      context(response),
    );
    response.status(201).json({ teacher: created });
  };

  listTeachers = async (request: Request, response: Response) => {
    response.status(200).json({
      teachers: await this.service.listTeachers(
        param(request, 'institutionId'),
        context(response),
      ),
    });
  };

  getTeacher = async (request: Request, response: Response) => {
    response.status(200).json({
      teacher: await this.service.getTeacher(
        param(request, 'teacherId'),
        param(request, 'institutionId'),
        context(response),
      ),
    });
  };

  updateTeacher = async (request: Request, response: Response) => {
    response.status(200).json({
      teacher: await this.service.updateTeacher(
        param(request, 'teacherId'),
        param(request, 'institutionId'),
        parse(updateTeacherSchema, request.body),
        context(response),
      ),
    });
  };

  activateTeacher = (request: Request, response: Response) =>
    this.teacherState(request, response, true);
  deactivateTeacher = (request: Request, response: Response) =>
    this.teacherState(request, response, false);
  linkTeacher = (request: Request, response: Response) =>
    this.teacherInstitutionState(request, response, true);
  unlinkTeacher = (request: Request, response: Response) =>
    this.teacherInstitutionState(request, response, false);

  createAcademicYear = async (request: Request, response: Response) => {
    const created = await this.service.createAcademicYear(
      {
        ...parse(createAcademicYearSchema, request.body),
        institutionId: param(request, 'institutionId'),
      },
      context(response),
    );
    response.status(201).json({ academicYear: created });
  };

  listAcademicYears = async (request: Request, response: Response) => {
    response.status(200).json({
      academicYears: await this.service.listAcademicYears(
        param(request, 'institutionId'),
        context(response),
      ),
    });
  };

  getCurrentAcademicYear = async (request: Request, response: Response) => {
    response.status(200).json({
      academicYear: await this.service.getCurrentAcademicYear(
        param(request, 'institutionId'),
        context(response),
      ),
    });
  };

  getAcademicYear = async (request: Request, response: Response) => {
    response.status(200).json({
      academicYear: await this.service.getAcademicYear(
        param(request, 'academicYearId'),
        context(response),
      ),
    });
  };

  updateAcademicYear = async (request: Request, response: Response) => {
    response.status(200).json({
      academicYear: await this.service.updateAcademicYear(
        param(request, 'academicYearId'),
        parse(updateAcademicYearSchema, request.body),
        context(response),
      ),
    });
  };

  createCourse = async (request: Request, response: Response) => {
    const created = await this.service.createCourse(
      parse(createCourseSchema, request.body),
      context(response),
    );
    response.status(201).json({ course: created });
  };

  listCourses = async (request: Request, response: Response) => {
    const institutionId = parse(uuidSchema, request.query.institutionId);
    response.status(200).json({
      courses: await this.service.listCourses(institutionId, context(response)),
    });
  };

  getCourse = async (request: Request, response: Response) => {
    response.status(200).json({
      course: await this.service.getCourse(param(request, 'courseId'), context(response)),
    });
  };

  updateCourse = async (request: Request, response: Response) => {
    response.status(200).json({
      course: await this.service.updateCourse(
        param(request, 'courseId'),
        parse(updateCourseSchema, request.body),
        context(response),
      ),
    });
  };

  activateCourse = (request: Request, response: Response) => this.courseState(request, response, true);
  deactivateCourse = (request: Request, response: Response) =>
    this.courseState(request, response, false);

  createSubject = async (request: Request, response: Response) => {
    const created = await this.service.createSubject(
      parse(createSubjectSchema, request.body),
      context(response),
    );
    response.status(201).json({ subject: created });
  };

  listSubjects = async (request: Request, response: Response) => {
    const institutionId = parse(uuidSchema, request.query.institutionId);
    response.status(200).json({
      subjects: await this.service.listSubjects(institutionId, context(response)),
    });
  };

  getSubject = async (request: Request, response: Response) => {
    response.status(200).json({
      subject: await this.service.getSubject(param(request, 'subjectId'), context(response)),
    });
  };

  updateSubject = async (request: Request, response: Response) => {
    response.status(200).json({
      subject: await this.service.updateSubject(
        param(request, 'subjectId'),
        parse(updateSubjectSchema, request.body),
        context(response),
      ),
    });
  };

  activateSubject = (request: Request, response: Response) =>
    this.subjectState(request, response, true);
  deactivateSubject = (request: Request, response: Response) =>
    this.subjectState(request, response, false);

  createTeachingAssignment = async (request: Request, response: Response) => {
    const created = await this.service.createTeachingAssignment(
      parse(createTeachingAssignmentSchema, request.body),
      context(response),
    );
    response.status(201).json({ teachingAssignment: created });
  };

  listTeachingAssignments = async (request: Request, response: Response) => {
    response.status(200).json({
      teachingAssignments: await this.service.listTeachingAssignments(
        parse(assignmentListSchema, request.query),
        context(response),
      ),
    });
  };

  getTeachingAssignment = async (request: Request, response: Response) => {
    response.status(200).json({
      teachingAssignment: await this.service.getTeachingAssignment(
        param(request, 'assignmentId'),
        context(response),
      ),
    });
  };

  retireTeachingAssignment = (request: Request, response: Response) =>
    this.assignmentState(request, response, false);
  reactivateTeachingAssignment = (request: Request, response: Response) =>
    this.assignmentState(request, response, true);

  listMyTeachingAssignments = async (_request: Request, response: Response) => {
    response.status(200).json({
      teachingAssignments: await this.service.listMyTeachingAssignments(context(response)),
    });
  };

  private async institutionState(request: Request, response: Response, active: boolean) {
    response.status(200).json({
      institution: await this.service.setInstitutionActive(
        param(request, 'institutionId'),
        active,
        context(response),
      ),
    });
  }

  private async teacherState(request: Request, response: Response, active: boolean) {
    response.status(200).json({
      teacher: await this.service.setTeacherActive(
        param(request, 'teacherId'),
        param(request, 'institutionId'),
        active,
        context(response),
      ),
    });
  }

  private async teacherInstitutionState(request: Request, response: Response, active: boolean) {
    response.status(200).json({
      teacherInstitution: await this.service.setTeacherInstitutionActive(
        param(request, 'teacherId'),
        param(request, 'institutionId'),
        active,
        context(response),
      ),
    });
  }

  private async courseState(request: Request, response: Response, active: boolean) {
    response.status(200).json({
      course: await this.service.setCourseActive(param(request, 'courseId'), active, context(response)),
    });
  }

  private async subjectState(request: Request, response: Response, active: boolean) {
    response.status(200).json({
      subject: await this.service.setSubjectActive(
        param(request, 'subjectId'),
        active,
        context(response),
      ),
    });
  }

  private async assignmentState(request: Request, response: Response, active: boolean) {
    response.status(200).json({
      teachingAssignment: await this.service.setTeachingAssignmentActive(
        param(request, 'assignmentId'),
        active,
        context(response),
      ),
    });
  }
}
