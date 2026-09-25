import {
  AccountKind,
  AuditActorKind,
  AuditOutcome,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import { hashPassword } from '../../security/password.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import type { PermissionCode } from '../authorization/permission-catalog.js';
import { normalizeLogin } from '../users/normalize-login.js';
import { AcademicRepository, type AuditRecord } from './academic.repository.js';
import { normalizeComparableText, normalizeDisplayText } from './normalization.js';
import type {
  CreateAcademicYearInput,
  CreateCourseInput,
  CreateInstitutionInput,
  CreateSubjectInput,
  CreateTeacherInput,
  CreateTeachingAssignmentInput,
  OperationContext,
  UpdateAcademicYearInput,
  UpdateCourseInput,
  UpdateInstitutionInput,
  UpdateSubjectInput,
  UpdateTeacherInput,
} from './academic.types.js';

const notFound = (entity: string) => new AppError(404, 'RESOURCE_NOT_FOUND', `${entity} no encontrado`);
const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
const invalid = (message: string) => new AppError(400, 'VALIDATION_ERROR', message);

const toAppError = (error: unknown): unknown => {
  if (error instanceof AppError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return conflict('Ya existe un registro con la misma combinación');
    if (error.code === 'P2003') return invalid('La relación indicada no es válida');
  }
  return error;
};

export class AcademicService {
  private readonly repository: AcademicRepository;

  constructor(client: PrismaClient) {
    this.repository = new AcademicRepository(client);
  }

  async createInstitution(input: CreateInstitutionInput, context: OperationContext) {
    return this.execute(
      'institution.create',
      'Institution',
      context,
      { name: normalizeDisplayText(input.name) },
      async () => {
        if (
          context.accountKind !== AccountKind.TECHNICAL ||
          input.technicalReason === undefined ||
          normalizeDisplayText(input.technicalReason).length === 0
        ) {
          throw new AppError(
            403,
            'INSTITUTION_BOOTSTRAP_REQUIRED',
            'La creación inicial de una institución requiere una operación técnica excepcional',
          );
        }
        return this.repository.transaction(async (repository) => {
          const institution = await repository.createInstitution(normalizeDisplayText(input.name));
          await repository.appendAudit(
            this.auditRecord(context, {
              action: 'institution.create',
              entityType: 'Institution',
              entityId: institution.id,
              institutionId: institution.id,
              outcome: AuditOutcome.SUCCESS,
              reason: normalizeDisplayText(input.technicalReason!),
              afterData: this.institutionAuditData(institution),
            }),
          );
          return institution;
        });
      },
    );
  }

  async listInstitutions(context: OperationContext) {
    const institutions = await this.repository.listInstitutions();
    const authorization = new AuthorizationService(this.repository.authorizationStore());
    const visible = [];
    for (const institution of institutions) {
      if (
        await authorization.isAuthorized(context.actorUserId, 'institution.read', {
          institutionId: institution.id,
        })
      ) {
        visible.push(institution);
      }
    }
    return visible;
  }

  async getInstitution(id: string, context: OperationContext) {
    const institution = await this.repository.findInstitution(id);
    if (institution === null) throw notFound('Institución');
    await this.assertAuthorized(this.repository, context, 'institution.read', { institutionId: id });
    return institution;
  }

  async updateInstitution(id: string, input: UpdateInstitutionInput, context: OperationContext) {
    return this.mutateInstitution(id, 'institution.update', { name: input.name }, context, async (repository, current) =>
      repository.updateInstitution(id, {
        name: normalizeDisplayText(input.name),
        rowVersion: { increment: 1 },
      }),
    );
  }

  async setInstitutionActive(id: string, active: boolean, context: OperationContext) {
    return this.mutateInstitution(
      id,
      active ? 'institution.activate' : 'institution.deactivate',
      { active },
      context,
      async (repository, current) => {
        if (current.isActive === active) return current;
        return repository.updateInstitution(id, {
          isActive: active,
          disabledAt: active ? null : new Date(),
          disabledBy: active ? { disconnect: true } : { connect: { id: context.actorUserId } },
          rowVersion: { increment: 1 },
        });
      },
    );
  }

  async createTeacher(input: CreateTeacherInput, context: OperationContext) {
    return this.execute(
      'teacher.create',
      'Teacher',
      context,
      { institutionId: input.institutionId, displayName: normalizeDisplayText(input.displayName) },
      async () => {
        const passwordHash =
          input.account.kind === 'NEW' ? await hashPassword(input.account.password) : null;
        return this.repository.transaction(async (repository) => {
          await this.assertAuthorized(repository, context, 'teacher.manage', {
            institutionId: input.institutionId,
          });
          await this.requireActiveInstitution(repository, input.institutionId);

          let user;
          if (input.account.kind === 'NEW') {
            const login = normalizeDisplayText(input.account.login);
            const loginNormalized = normalizeLogin(login);
            if ((await repository.findUserByNormalizedLogin(loginNormalized)) !== null) {
              throw conflict('El identificador de acceso ya está en uso');
            }
            user = await repository.createStandardUser({ login, loginNormalized, passwordHash: passwordHash! });
          } else {
            user = await repository.findUserForTeacher(input.account.userId);
            if (user === null || !user.isActive || user.teacher !== null) {
              throw invalid('La cuenta indicada no está disponible para un perfil docente');
            }
          }

          const teacher = await repository.createTeacher(
            user.id,
            normalizeDisplayText(input.displayName),
            input.institutionId,
          );
          await repository.appendAudit(
            this.auditRecord(context, {
              action: 'teacher.create',
              entityType: 'Teacher',
              entityId: teacher.id,
              institutionId: input.institutionId,
              outcome: AuditOutcome.SUCCESS,
              afterData: {
                teacherId: teacher.id,
                userId: user.id,
                displayName: teacher.displayName,
                accountCreated: input.account.kind === 'NEW',
              },
            }),
          );
          return teacher;
        });
      },
    );
  }

  async listTeachers(institutionId: string, context: OperationContext) {
    await this.assertAuthorized(this.repository, context, 'teacher.read', { institutionId });
    return this.repository.listTeachers(institutionId);
  }

  async getTeacher(teacherId: string, institutionId: string, context: OperationContext) {
    await this.assertAuthorized(this.repository, context, 'teacher.read', { institutionId });
    const teacher = await this.repository.findTeacher(teacherId);
    if (
      teacher === null ||
      !teacher.institutions.some((link) => link.institutionId === institutionId)
    ) {
      throw notFound('Docente');
    }
    return teacher;
  }

  async updateTeacher(
    teacherId: string,
    institutionId: string,
    input: UpdateTeacherInput,
    context: OperationContext,
  ) {
    return this.mutateTeacher(
      teacherId,
      institutionId,
      'teacher.update',
      context,
      async (repository) =>
        repository.updateTeacher(teacherId, {
          displayName: normalizeDisplayText(input.displayName),
          rowVersion: { increment: 1 },
        }),
    );
  }

  async setTeacherActive(
    teacherId: string,
    institutionId: string,
    active: boolean,
    context: OperationContext,
  ) {
    return this.mutateTeacher(
      teacherId,
      institutionId,
      active ? 'teacher.activate' : 'teacher.deactivate',
      context,
      async (repository, current) => {
        if (current.isActive === active) return current;
        if (active && !current.user.isActive) {
          throw invalid('La cuenta de acceso debe estar activa antes de reactivar el docente');
        }
        return repository.updateTeacher(teacherId, {
          isActive: active,
          disabledAt: active ? null : new Date(),
          disabledBy: active ? { disconnect: true } : { connect: { id: context.actorUserId } },
          rowVersion: { increment: 1 },
        });
      },
    );
  }

  async setTeacherInstitutionActive(
    teacherId: string,
    institutionId: string,
    active: boolean,
    context: OperationContext,
  ) {
    return this.execute(
      active ? 'teacher-institution.activate' : 'teacher-institution.end',
      'TeacherInstitution',
      context,
      { teacherId, institutionId },
      () =>
        this.repository.transaction(async (repository) => {
          await this.assertAuthorized(repository, context, 'teacher.manage', { institutionId });
          const teacher = await repository.findTeacher(teacherId);
          if (teacher === null) throw notFound('Docente');
          if (active) {
            await this.requireActiveInstitution(repository, institutionId);
            if (!teacher.isActive) throw invalid('El docente debe estar activo para vincularlo');
          }
          const existing = await repository.findTeacherInstitution(teacherId, institutionId);
          const link =
            existing === null
              ? active
                ? await repository.createTeacherInstitution(teacherId, institutionId)
                : (() => {
                    throw notFound('Vinculación docente-institución');
                  })()
              : await repository.updateTeacherInstitution(existing.id, active ? null : new Date());
          await repository.appendAudit(
            this.auditRecord(context, {
              action: active ? 'teacher-institution.activate' : 'teacher-institution.end',
              entityType: 'TeacherInstitution',
              entityId: link.id,
              institutionId,
              outcome: AuditOutcome.SUCCESS,
              details: { teacherId, active },
            }),
          );
          return link;
        }),
    );
  }

  async createAcademicYear(input: CreateAcademicYearInput, context: OperationContext) {
    return this.execute(
      'academic-year.create',
      'AcademicYear',
      context,
      { institutionId: input.institutionId, label: input.label, isCurrent: input.isCurrent },
      () =>
        this.repository.transaction(async (repository) => {
          await this.assertAuthorized(repository, context, 'course.manage', {
            institutionId: input.institutionId,
          });
          await this.requireActiveInstitution(repository, input.institutionId);
          this.validateDates(input.startsOn, input.endsOn);
          const year = await repository.createAcademicYear({
            ...input,
            label: normalizeDisplayText(input.label),
          });
          await repository.appendAudit(
            this.auditRecord(context, {
              action: 'academic-year.create',
              entityType: 'AcademicYear',
              entityId: year.id,
              institutionId: input.institutionId,
              outcome: AuditOutcome.SUCCESS,
              afterData: this.yearAuditData(year),
            }),
          );
          return year;
        }),
    );
  }

  async listAcademicYears(institutionId: string, context: OperationContext) {
    await this.assertAuthorized(this.repository, context, 'course.read', { institutionId });
    return this.repository.listAcademicYears(institutionId);
  }

  async getAcademicYear(id: string, context: OperationContext) {
    const year = await this.repository.findAcademicYear(id);
    if (year === null) throw notFound('Año lectivo');
    await this.assertAuthorized(this.repository, context, 'course.read', {
      institutionId: year.institutionId,
    });
    return year;
  }

  async getCurrentAcademicYear(institutionId: string, context: OperationContext) {
    await this.assertAuthorized(this.repository, context, 'course.read', { institutionId });
    const year = await this.repository.findCurrentAcademicYear(institutionId);
    if (year === null) throw notFound('Año lectivo activo');
    return year;
  }

  async updateAcademicYear(id: string, input: UpdateAcademicYearInput, context: OperationContext) {
    return this.execute(
      'academic-year.update',
      'AcademicYear',
      context,
      { id },
      () =>
        this.repository.transaction(async (repository) => {
          const current = await repository.findAcademicYear(id);
          if (current === null) throw notFound('Año lectivo');
          await this.assertAuthorized(repository, context, 'course.manage', {
            institutionId: current.institutionId,
          });
          const startsOn = input.startsOn ?? current.startsOn;
          const endsOn = input.endsOn ?? current.endsOn;
          this.validateDates(startsOn, endsOn);
          const updated = await repository.updateAcademicYear(id, {
            ...(input.label === undefined ? {} : { label: normalizeDisplayText(input.label) }),
            ...(input.startsOn === undefined ? {} : { startsOn: input.startsOn }),
            ...(input.endsOn === undefined ? {} : { endsOn: input.endsOn }),
            ...(input.isCurrent === undefined ? {} : { isCurrent: input.isCurrent }),
            rowVersion: { increment: 1 },
          });
          await repository.appendAudit(
            this.auditRecord(context, {
              action: 'academic-year.update',
              entityType: 'AcademicYear',
              entityId: id,
              institutionId: current.institutionId,
              outcome: AuditOutcome.SUCCESS,
              beforeData: this.yearAuditData(current),
              afterData: this.yearAuditData(updated),
            }),
          );
          return updated;
        }),
    );
  }

  async createCourse(input: CreateCourseInput, context: OperationContext) {
    return this.execute(
      'course.create',
      'Course',
      context,
      { institutionId: input.institutionId, academicYearId: input.academicYearId },
      () =>
        this.repository.transaction(async (repository) => {
          await this.assertAuthorized(repository, context, 'course.manage', {
            institutionId: input.institutionId,
          });
          await this.requireActiveInstitution(repository, input.institutionId);
          const year = await repository.findAcademicYear(input.academicYearId);
          if (year === null || year.institutionId !== input.institutionId) {
            throw invalid('El año lectivo no pertenece a la institución');
          }
          const course = await repository.createCourse({
            institutionId: input.institutionId,
            academicYearId: input.academicYearId,
            grade: normalizeComparableText(input.grade),
            section: normalizeComparableText(input.section),
            shift: normalizeComparableText(input.shift),
            btiYear: input.btiYear,
          });
          await repository.appendAudit(
            this.auditRecord(context, {
              action: 'course.create',
              entityType: 'Course',
              entityId: course.id,
              institutionId: input.institutionId,
              outcome: AuditOutcome.SUCCESS,
              afterData: this.courseAuditData(course),
            }),
          );
          return course;
        }),
    );
  }

  async listCourses(institutionId: string, context: OperationContext) {
    const courses = await this.repository.listCourses(institutionId);
    const authorization = new AuthorizationService(this.repository.authorizationStore());
    const visible = [];
    for (const course of courses) {
      if (
        await authorization.isAuthorized(context.actorUserId, 'course.read', {
          institutionId,
          courseId: course.id,
        })
      ) {
        visible.push(course);
      }
    }
    return visible;
  }

  async getCourse(id: string, context: OperationContext) {
    const course = await this.repository.findCourse(id);
    if (course === null) throw notFound('Curso');
    await this.assertAuthorized(this.repository, context, 'course.read', {
      institutionId: course.institutionId,
      courseId: course.id,
    });
    return course;
  }

  async updateCourse(id: string, input: UpdateCourseInput, context: OperationContext) {
    return this.execute('course.update', 'Course', context, { id }, () =>
      this.repository.transaction(async (repository) => {
        const current = await repository.findCourse(id);
        if (current === null) throw notFound('Curso');
        await this.assertAuthorized(repository, context, 'course.manage', {
          institutionId: current.institutionId,
          courseId: current.id,
        });
        if (input.academicYearId !== undefined && input.academicYearId !== current.academicYearId) {
          if ((await repository.countAssignmentsForCourse(id)) > 0) {
            throw conflict('No se puede trasladar un curso con historia a otro año lectivo');
          }
          const year = await repository.findAcademicYear(input.academicYearId);
          if (year === null || year.institutionId !== current.institutionId) {
            throw invalid('El año lectivo no pertenece a la institución');
          }
        }
        const updated = await repository.updateCourse(id, {
          ...(input.academicYearId === undefined
            ? {}
            : { academicYear: { connect: { id: input.academicYearId } } }),
          ...(input.grade === undefined ? {} : { grade: normalizeComparableText(input.grade) }),
          ...(input.section === undefined ? {} : { section: normalizeComparableText(input.section) }),
          ...(input.shift === undefined ? {} : { shift: normalizeComparableText(input.shift) }),
          ...(input.btiYear === undefined ? {} : { btiYear: input.btiYear }),
          rowVersion: { increment: 1 },
        });
        await repository.appendAudit(
          this.auditRecord(context, {
            action: 'course.update',
            entityType: 'Course',
            entityId: id,
            institutionId: current.institutionId,
            outcome: AuditOutcome.SUCCESS,
            beforeData: this.courseAuditData(current),
            afterData: this.courseAuditData(updated),
          }),
        );
        return updated;
      }),
    );
  }

  async setCourseActive(id: string, active: boolean, context: OperationContext) {
    return this.setActivatableEntity('Course', 'course', id, active, context);
  }

  async createSubject(input: CreateSubjectInput, context: OperationContext) {
    return this.execute(
      'subject.create',
      'Subject',
      context,
      { institutionId: input.institutionId, name: normalizeDisplayText(input.name) },
      () =>
        this.repository.transaction(async (repository) => {
          await this.assertAuthorized(repository, context, 'subject.manage', {
            institutionId: input.institutionId,
          });
          await this.requireActiveInstitution(repository, input.institutionId);
          const subject = await repository.createSubject({
            institutionId: input.institutionId,
            name: normalizeDisplayText(input.name),
            nameNormalized: normalizeComparableText(input.name),
          });
          await repository.appendAudit(
            this.auditRecord(context, {
              action: 'subject.create',
              entityType: 'Subject',
              entityId: subject.id,
              institutionId: input.institutionId,
              outcome: AuditOutcome.SUCCESS,
              afterData: this.subjectAuditData(subject),
            }),
          );
          return subject;
        }),
    );
  }

  async listSubjects(institutionId: string, context: OperationContext) {
    await this.assertAuthorized(this.repository, context, 'subject.read', { institutionId });
    return this.repository.listSubjects(institutionId);
  }

  async getSubject(id: string, context: OperationContext) {
    const subject = await this.repository.findSubject(id);
    if (subject === null) throw notFound('Materia');
    await this.assertAuthorized(this.repository, context, 'subject.read', {
      institutionId: subject.institutionId,
    });
    return subject;
  }

  async updateSubject(id: string, input: UpdateSubjectInput, context: OperationContext) {
    return this.execute('subject.update', 'Subject', context, { id }, () =>
      this.repository.transaction(async (repository) => {
        const current = await repository.findSubject(id);
        if (current === null) throw notFound('Materia');
        await this.assertAuthorized(repository, context, 'subject.manage', {
          institutionId: current.institutionId,
        });
        const updated = await repository.updateSubject(id, {
          ...(input.name === undefined
            ? {}
            : {
                name: normalizeDisplayText(input.name),
                nameNormalized: normalizeComparableText(input.name),
              }),
          rowVersion: { increment: 1 },
        });
        await repository.appendAudit(
          this.auditRecord(context, {
            action: 'subject.update',
            entityType: 'Subject',
            entityId: id,
            institutionId: current.institutionId,
            outcome: AuditOutcome.SUCCESS,
            beforeData: this.subjectAuditData(current),
            afterData: this.subjectAuditData(updated),
          }),
        );
        return updated;
      }),
    );
  }

  async setSubjectActive(id: string, active: boolean, context: OperationContext) {
    return this.setActivatableEntity('Subject', 'subject', id, active, context);
  }

  async createTeachingAssignment(input: CreateTeachingAssignmentInput, context: OperationContext) {
    return this.execute(
      'teaching-assignment.create',
      'TeachingAssignment',
      context,
      {
        institutionId: input.institutionId,
        teacherId: input.teacherId,
        courseId: input.courseId,
        subjectId: input.subjectId,
      },
      () =>
        this.repository.transaction(async (repository) => {
          await this.assertAuthorized(repository, context, 'teaching-assignment.manage', {
            institutionId: input.institutionId,
            courseId: input.courseId,
          });
          const [institution, teacher, link, course, subject] = await Promise.all([
            repository.findInstitution(input.institutionId),
            repository.findTeacher(input.teacherId),
            repository.findTeacherInstitution(input.teacherId, input.institutionId),
            repository.findCourse(input.courseId),
            repository.findSubject(input.subjectId),
          ]);
          if (institution === null || !institution.isActive) throw invalid('La institución no está activa');
          if (teacher === null || !teacher.isActive || !teacher.user.isActive) {
            throw invalid('El docente no está activo');
          }
          if (link === null || link.endedAt !== null) {
            throw invalid('El docente no posee una vinculación institucional vigente');
          }
          if (course === null || !course.isActive || course.institutionId !== input.institutionId) {
            throw invalid('El curso no está activo en la institución');
          }
          if (subject === null || !subject.isActive || subject.institutionId !== input.institutionId) {
            throw invalid('La materia no está activa en la institución');
          }
          const assignment = await repository.createTeachingAssignment(input);
          await repository.appendAudit(
            this.auditRecord(context, {
              action: 'teaching-assignment.create',
              entityType: 'TeachingAssignment',
              entityId: assignment.id,
              institutionId: input.institutionId,
              outcome: AuditOutcome.SUCCESS,
              afterData: this.assignmentAuditData(assignment),
            }),
          );
          return assignment;
        }),
    );
  }

  async listTeachingAssignments(
    filters: { institutionId: string; courseId?: string; teacherId?: string; includeEnded?: boolean },
    context: OperationContext,
  ) {
    const assignments = await this.repository.listTeachingAssignments({
      ...filters,
      activeOnly: filters.includeEnded !== true,
    });
    const authorization = new AuthorizationService(this.repository.authorizationStore());
    const visible = [];
    for (const assignment of assignments) {
      if (
        await authorization.isAuthorized(context.actorUserId, 'teaching-assignment.read', {
          institutionId: assignment.institutionId,
          courseId: assignment.courseId,
        })
      ) {
        visible.push(assignment);
      }
    }
    return visible;
  }

  async getTeachingAssignment(id: string, context: OperationContext) {
    const assignment = await this.repository.findTeachingAssignment(id);
    if (assignment === null) throw notFound('Asignación docente');
    if (
      assignment.endedAt === null &&
      assignment.teacher.userId === context.actorUserId &&
      assignment.teacher.isActive
    ) {
      return assignment;
    }
    await this.assertAuthorized(this.repository, context, 'teaching-assignment.read', {
      institutionId: assignment.institutionId,
      courseId: assignment.courseId,
    });
    return assignment;
  }

  async listMyTeachingAssignments(context: OperationContext) {
    const actor = await this.repository.findUserForTeacher(context.actorUserId);
    if (actor?.teacher === null || actor?.teacher === undefined) return [];
    return this.repository.listTeachingAssignments({ teacherId: actor.teacher.id, activeOnly: true });
  }

  async setTeachingAssignmentActive(id: string, active: boolean, context: OperationContext) {
    return this.execute(
      active ? 'teaching-assignment.reactivate' : 'teaching-assignment.retire',
      'TeachingAssignment',
      context,
      { id, active },
      () =>
        this.repository.transaction(async (repository) => {
          const current = await repository.findTeachingAssignment(id);
          if (current === null) throw notFound('Asignación docente');
          await this.assertAuthorized(repository, context, 'teaching-assignment.manage', {
            institutionId: current.institutionId,
            courseId: current.courseId,
          });
          if (active) {
            const [institution, teacher, link, course, subject] = await Promise.all([
              repository.findInstitution(current.institutionId),
              repository.findTeacher(current.teacherId),
              repository.findTeacherInstitution(current.teacherId, current.institutionId),
              repository.findCourse(current.courseId),
              repository.findSubject(current.subjectId),
            ]);
            if (
              institution?.isActive !== true ||
              teacher?.isActive !== true ||
              teacher.user.isActive !== true ||
              link?.endedAt !== null ||
              course?.isActive !== true ||
              subject?.isActive !== true
            ) {
              throw invalid('No se puede reactivar la asignación con entidades inactivas');
            }
          }
          const updated = await repository.updateTeachingAssignment(id, active ? null : new Date());
          await repository.appendAudit(
            this.auditRecord(context, {
              action: active ? 'teaching-assignment.reactivate' : 'teaching-assignment.retire',
              entityType: 'TeachingAssignment',
              entityId: id,
              institutionId: current.institutionId,
              outcome: AuditOutcome.SUCCESS,
              beforeData: this.assignmentAuditData(current),
              afterData: this.assignmentAuditData(updated),
            }),
          );
          return updated;
        }),
    );
  }

  private async mutateInstitution<T>(
    id: string,
    action: string,
    attempted: Prisma.InputJsonValue,
    context: OperationContext,
    mutation: (repository: AcademicRepository, current: NonNullable<Awaited<ReturnType<AcademicRepository['findInstitution']>>>) => Promise<T>,
  ) {
    return this.execute(action, 'Institution', context, { id, attempted }, () =>
      this.repository.transaction(async (repository) => {
        const current = await repository.findInstitution(id);
        if (current === null) throw notFound('Institución');
        await this.assertAuthorized(repository, context, 'institution.manage', { institutionId: id });
        const updated = await mutation(repository, current);
        await repository.appendAudit(
          this.auditRecord(context, {
            action,
            entityType: 'Institution',
            entityId: id,
            institutionId: id,
            outcome: AuditOutcome.SUCCESS,
            beforeData: this.institutionAuditData(current),
            afterData: this.institutionAuditData(updated as typeof current),
          }),
        );
        return updated;
      }),
    );
  }

  private async mutateTeacher<T>(
    teacherId: string,
    institutionId: string,
    action: string,
    context: OperationContext,
    mutation: (repository: AcademicRepository, current: NonNullable<Awaited<ReturnType<AcademicRepository['findTeacher']>>>) => Promise<T>,
  ) {
    return this.execute(action, 'Teacher', context, { teacherId, institutionId }, () =>
      this.repository.transaction(async (repository) => {
        await this.assertAuthorized(repository, context, 'teacher.manage', { institutionId });
        const current = await repository.findTeacher(teacherId);
        if (
          current === null ||
          !current.institutions.some((link) => link.institutionId === institutionId)
        ) {
          throw notFound('Docente');
        }
        const updated = await mutation(repository, current);
        await repository.appendAudit(
          this.auditRecord(context, {
            action,
            entityType: 'Teacher',
            entityId: teacherId,
            institutionId,
            outcome: AuditOutcome.SUCCESS,
            beforeData: this.teacherAuditData(current),
            afterData: this.teacherAuditData(updated as typeof current),
          }),
        );
        return updated;
      }),
    );
  }

  private async setActivatableEntity(
    entityType: 'Course' | 'Subject',
    permissionPrefix: 'course' | 'subject',
    id: string,
    active: boolean,
    context: OperationContext,
  ) {
    const action = `${permissionPrefix}.${active ? 'activate' : 'deactivate'}`;
    return this.execute(action, entityType, context, { id, active }, () =>
      this.repository.transaction(async (repository) => {
        const current =
          entityType === 'Course'
            ? await repository.findCourse(id)
            : await repository.findSubject(id);
        if (current === null) throw notFound(entityType === 'Course' ? 'Curso' : 'Materia');
        await this.assertAuthorized(repository, context, `${permissionPrefix}.manage` as PermissionCode, {
          institutionId: current.institutionId,
          ...('academicYearId' in current ? { courseId: current.id } : {}),
        });
        const updated =
          entityType === 'Course'
            ? await repository.updateCourse(id, {
                isActive: active,
                disabledAt: active ? null : new Date(),
                disabledBy: active ? { disconnect: true } : { connect: { id: context.actorUserId } },
                rowVersion: { increment: 1 },
              })
            : await repository.updateSubject(id, {
                isActive: active,
                disabledAt: active ? null : new Date(),
                disabledBy: active ? { disconnect: true } : { connect: { id: context.actorUserId } },
                rowVersion: { increment: 1 },
              });
        await repository.appendAudit(
          this.auditRecord(context, {
            action,
            entityType,
            entityId: id,
            institutionId: current.institutionId,
            outcome: AuditOutcome.SUCCESS,
            beforeData: { id, isActive: current.isActive },
            afterData: { id, isActive: updated.isActive },
          }),
        );
        return updated;
      }),
    );
  }

  private async assertAuthorized(
    repository: AcademicRepository,
    context: OperationContext,
    permission: PermissionCode,
    resource: { institutionId: string; courseId?: string },
  ) {
    const authorization = new AuthorizationService(repository.authorizationStore());
    if (!(await authorization.isAuthorized(context.actorUserId, permission, resource))) {
      throw new AppError(403, 'PERMISSION_DENIED', 'Acceso denegado');
    }
  }

  private async requireActiveInstitution(repository: AcademicRepository, id: string) {
    const institution = await repository.findInstitution(id);
    if (institution === null || !institution.isActive) throw invalid('La institución no está activa');
    return institution;
  }

  private validateDates(startsOn: Date, endsOn: Date) {
    if (startsOn > endsOn) throw invalid('La fecha inicial debe ser anterior o igual a la final');
  }

  private async execute<T>(
    action: string,
    entityType: string,
    context: OperationContext,
    attempted: Prisma.InputJsonValue,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work();
    } catch (rawError) {
      const error = toAppError(rawError);
      if (error instanceof AppError) {
        await this.repository.appendAudit(
          this.auditRecord(context, {
            action,
            entityType,
            outcome: AuditOutcome.DENIED,
            reason: error.message,
            details: attempted,
          }),
        );
      }
      throw error;
    }
  }

  private auditRecord(
    context: OperationContext,
    event: Omit<AuditRecord, 'actorUserId' | 'actorKind' | 'requestId'>,
  ): AuditRecord {
    return {
      ...event,
      actorUserId: context.actorUserId,
      actorKind:
        context.accountKind === AccountKind.TECHNICAL
          ? AuditActorKind.TECHNICAL
          : AuditActorKind.USER,
      requestId: context.requestId,
      reason:
        event.reason ??
        (context.accountKind === AccountKind.TECHNICAL
          ? 'Operación técnica excepcional'
          : undefined),
    };
  }

  private institutionAuditData(value: { id: string; name: string; isActive: boolean }) {
    return { id: value.id, name: value.name, isActive: value.isActive };
  }

  private teacherAuditData(value: { id: string; userId: string; displayName: string; isActive: boolean }) {
    return {
      id: value.id,
      userId: value.userId,
      displayName: value.displayName,
      isActive: value.isActive,
    };
  }

  private yearAuditData(value: {
    id: string;
    label: string;
    startsOn: Date;
    endsOn: Date;
    isCurrent: boolean;
  }) {
    return {
      id: value.id,
      label: value.label,
      startsOn: value.startsOn.toISOString(),
      endsOn: value.endsOn.toISOString(),
      isCurrent: value.isCurrent,
    };
  }

  private courseAuditData(value: {
    id: string;
    academicYearId: string;
    grade: string;
    section: string;
    shift: string;
    btiYear: number | null;
    isActive: boolean;
  }) {
    return {
      id: value.id,
      academicYearId: value.academicYearId,
      grade: value.grade,
      section: value.section,
      shift: value.shift,
      btiYear: value.btiYear,
      isActive: value.isActive,
    };
  }

  private subjectAuditData(value: {
    id: string;
    name: string;
    isActive: boolean;
  }) {
    return {
      id: value.id,
      name: value.name,
      isActive: value.isActive,
    };
  }

  private assignmentAuditData(value: {
    id: string;
    teacherId: string;
    courseId: string;
    subjectId: string;
    endedAt: Date | null;
  }) {
    return {
      id: value.id,
      teacherId: value.teacherId,
      courseId: value.courseId,
      subjectId: value.subjectId,
      endedAt: value.endedAt?.toISOString() ?? null,
    };
  }
}
