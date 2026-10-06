import { AuditActorKind, AuditOutcome, Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import type { PermissionCode } from '../authorization/permission-catalog.js';
import { decodeCursor, encodeCursor } from '../curriculum/cursor.js';
import type { OperationContext } from '../academic/academic.types.js';
import { normalizeNationalId } from './national-id.js';
import type { z } from 'zod';
import type { createStudent, createEnrollment, patchStudent, patchActivation, listQuery } from './students.schemas.js';

type Store = Prisma.TransactionClient | PrismaClient;
type ListQuery = z.infer<typeof listQuery>;
const missing = () => new AppError(404, 'RESOURCE_NOT_FOUND', 'Recurso no encontrado');
const denied = () => new AppError(403, 'PERMISSION_DENIED', 'Acceso denegado');
const conflict = () => new AppError(409, 'CONFLICT', 'La operación entra en conflicto con un registro existente o inactivo');
const studentProjection = (s: { id: string; givenNames: string; familyNames: string; nationalId: string | null; isActive: boolean; rowVersion: number }) => ({
  id: s.id, givenNames: s.givenNames, familyNames: s.familyNames, nationalId: s.nationalId, isActive: s.isActive, rowVersion: s.rowVersion,
});
const enrollmentProjection = (e: { id: string; studentId: string; courseId: string; academicYearId: string; createdAt: Date; student: Parameters<typeof studentProjection>[0] }) => ({
  id: e.id, studentId: e.studentId, courseId: e.courseId, academicYearId: e.academicYearId,
  createdAt: e.createdAt, student: studentProjection(e.student),
});

export class StudentsService {
  constructor(private readonly db: PrismaClient) {}

  private async teacherId(store: Store, actorUserId: string) {
    const teacher = await store.teacher.findUnique({ where: { userId: actorUserId }, select: { id: true } });
    return teacher?.id ?? null;
  }

  private async allowed(store: Store, ctx: OperationContext, permission: PermissionCode, institutionId: string, courseId?: string) {
    return new AuthorizationService(store).isAuthorized(ctx.actorUserId, permission, { institutionId, ...(courseId ? { courseId } : {}) });
  }

  private async canReadCourse(store: Store, ctx: OperationContext, institutionId: string, courseId: string) {
    if (!(await this.allowed(store, ctx, 'student.read', institutionId, courseId)) ||
        !(await this.allowed(store, ctx, 'enrollment.read', institutionId, courseId))) return false;
    return this.teacherContext(store, ctx, institutionId, courseId);
  }

  private async teacherContext(store: Store, ctx: OperationContext, institutionId: string, courseId: string) {
    const teacherId = await this.teacherId(store, ctx.actorUserId);
    if (teacherId === null) return true;
    const teacher = await store.teacher.findUnique({ where: { id: teacherId }, select: { isActive: true, user: { select: { isActive: true } } } });
    if (!teacher?.isActive || !teacher.user.isActive) return false;
    const link = await store.teacherInstitution.count({ where: { teacherId, institutionId, endedAt: null, institution: { isActive: true } } });
    const assignment = await store.teachingAssignment.count({ where: { teacherId, institutionId, courseId, endedAt: null } });
    return link > 0 && assignment > 0;
  }

  private async course(store: Store, institutionId: string, courseId: string) {
    const course = await store.course.findUnique({ where: { id: courseId }, include: { institution: true } });
    if (course === null || course.institutionId !== institutionId) throw missing();
    return course;
  }

  private async assertCoursePermission(store: Store, ctx: OperationContext, institutionId: string, courseId: string, permission: PermissionCode) {
    if (!(await this.allowed(store, ctx, permission, institutionId, courseId)) ||
        !(await this.teacherContext(store, ctx, institutionId, courseId))) throw denied();
  }

  private async assertYearAndActive(store: Store, institutionId: string, courseId: string, academicYearId: string) {
    const course = await this.course(store, institutionId, courseId);
    if (course.academicYearId !== academicYearId) throw new AppError(422, 'INVALID_REFERENCE', 'Año lectivo incompatible con el curso');
    if (!course.isActive || !course.institution.isActive) throw conflict();
  }

  private async audit(store: Store, ctx: OperationContext, action: string, entityType: string, entityId: string, institutionId: string, beforeData?: Prisma.InputJsonValue, afterData?: Prisma.InputJsonValue) {
    await store.auditLog.create({ data: {
      actorUserId: ctx.actorUserId, actorKind: ctx.accountKind === 'TECHNICAL' ? AuditActorKind.TECHNICAL : AuditActorKind.USER,
      action, entityType, entityId, institutionId, outcome: AuditOutcome.SUCCESS, requestId: ctx.requestId,
      ...(beforeData === undefined ? {} : { beforeData }), ...(afterData === undefined ? {} : { afterData }),
    } });
  }

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.db.$transaction(work, { timeout: 15000 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002' || e.code === 'P2004') throw conflict();
        if (e.code === 'P2034') throw new AppError(409, 'CONCURRENT_MODIFICATION', 'Modificación concurrente');
      }
      throw e;
    }
  }

  async createStudent(institutionId: string, courseId: string, input: z.infer<typeof createStudent>, ctx: OperationContext) {
    const ids = normalizeNationalId(input.nationalId);
    return this.transaction(async tx => {
      await this.assertYearAndActive(tx, institutionId, courseId, input.academicYearId);
      await this.assertCoursePermission(tx, ctx, institutionId, courseId, 'student.manage');
      await this.assertCoursePermission(tx, ctx, institutionId, courseId, 'enrollment.manage');
      const student = await tx.student.create({ data: { givenNames: input.givenNames, familyNames: input.familyNames, ...ids } });
      const enrollment = await tx.enrollment.create({ data: { studentId: student.id, courseId, academicYearId: input.academicYearId }, include: { student: true } });
      await this.audit(tx, ctx, 'student.create', 'Student', student.id, institutionId, undefined, studentProjection(student));
      await this.audit(tx, ctx, 'enrollment.create', 'Enrollment', enrollment.id, institutionId, undefined, { studentId: student.id, courseId, academicYearId: input.academicYearId });
      return { student: studentProjection(student), enrollment: enrollmentProjection(enrollment) };
    });
  }

  private async visibleEnrollments(store: Store, institutionId: string, ctx: OperationContext, studentId?: string, courseId?: string) {
    const rows = await store.enrollment.findMany({
      where: { ...(studentId ? { studentId } : {}), course: { institutionId, ...(courseId ? { id: courseId } : {}) } },
      include: { student: true }, orderBy: { id: 'asc' },
    });
    const visible = [];
    for (const row of rows) if (await this.canReadCourse(store, ctx, institutionId, row.courseId)) visible.push(row);
    return visible;
  }

  private async assertListContext(institutionId: string, query: ListQuery, ctx: OperationContext) {
    const institution = await this.db.institution.findUnique({ where: { id: institutionId } });
    if (!institution) throw missing();
    if (query.courseId) {
      await this.course(this.db, institutionId, query.courseId);
      if (!(await this.canReadCourse(this.db, ctx, institutionId, query.courseId))) throw denied();
    } else {
      if (await this.teacherId(this.db, ctx.actorUserId)) throw new AppError(400, 'VALIDATION_ERROR', 'courseId obligatorio');
      if (!(await this.allowed(this.db, ctx, 'student.read', institutionId)) ||
          !(await this.allowed(this.db, ctx, 'enrollment.read', institutionId))) throw denied();
    }
  }

  private page<T extends { id: string }>(rows: T[], query: ListQuery, context: unknown) {
    const after = decodeCursor(query.cursor, context);
    const filtered = after ? rows.filter(row => row.id > after) : rows;
    const data = filtered.slice(0, query.limit);
    const nextCursor = filtered.length > query.limit ? encodeCursor(data[data.length - 1]!.id, context) : null;
    return { data, nextCursor };
  }

  async listStudents(institutionId: string, query: ListQuery, ctx: OperationContext) {
    await this.assertListContext(institutionId, query, ctx);
    const rows = await this.visibleEnrollments(this.db, institutionId, ctx, undefined, query.courseId);
    const byId = new Map<string, { id: string; student: ReturnType<typeof studentProjection>; enrollments: ReturnType<typeof enrollmentProjection>[] }>();
    const term = query.q?.toLocaleLowerCase().trim();
    const normalizedTerm = term?.replace(/[^0-9]/g, '');
    for (const row of rows) {
      const student = row.student;
      if (term && !`${student.givenNames} ${student.familyNames}`.toLocaleLowerCase().includes(term) &&
          !(normalizedTerm && student.nationalIdNormalized?.includes(normalizedTerm))) continue;
      const entry = byId.get(student.id) ?? { id: student.id, student: studentProjection(student), enrollments: [] };
      entry.enrollments.push(enrollmentProjection(row));
      byId.set(student.id, entry);
    }
    const context = { kind: 'students', actor: ctx.actorUserId, institutionId, courseId: query.courseId, q: term };
    const paged = this.page([...byId.values()].sort((a,b) => a.id.localeCompare(b.id)), query, context);
    return { data: paged.data.map(({ id: _id, ...value }) => value), nextCursor: paged.nextCursor };
  }

  async listCourseStudents(institutionId: string, courseId: string, query: ListQuery, ctx: OperationContext) {
    await this.assertListContext(institutionId, { ...query, courseId }, ctx);
    const rows = await this.visibleEnrollments(this.db, institutionId, ctx, undefined, courseId);
    return this.page(rows.map(enrollmentProjection), query, { kind: 'roster', actor: ctx.actorUserId, institutionId, courseId });
  }

  async studentDetail(institutionId: string, studentId: string, courseId: string | undefined, ctx: OperationContext) {
    const query = { limit: 25, ...(courseId ? { courseId } : {}) };
    await this.assertListContext(institutionId, query, ctx);
    const rows = await this.visibleEnrollments(this.db, institutionId, ctx, studentId, courseId);
    if (!rows.length) throw missing();
    return { student: studentProjection(rows[0]!.student), enrollments: rows.map(enrollmentProjection) };
  }

  async listEnrollments(institutionId: string, studentId: string, query: ListQuery, ctx: OperationContext) {
    await this.assertListContext(institutionId, query, ctx);
    const rows = await this.visibleEnrollments(this.db, institutionId, ctx, studentId, query.courseId);
    if (!rows.length) throw missing();
    return this.page(rows.map(enrollmentProjection), query, { kind: 'history', actor: ctx.actorUserId, institutionId, studentId, courseId: query.courseId });
  }

  async enrollmentDetail(institutionId: string, enrollmentId: string, ctx: OperationContext) {
    const row = await this.db.enrollment.findUnique({ where: { id: enrollmentId }, include: { student: true, course: true } });
    if (!row || row.course.institutionId !== institutionId || !(await this.canReadCourse(this.db, ctx, institutionId, row.courseId))) throw missing();
    return enrollmentProjection(row);
  }

  async createEnrollment(institutionId: string, courseId: string, input: z.infer<typeof createEnrollment>, ctx: OperationContext) {
    return this.transaction(async tx => {
      await this.assertYearAndActive(tx, institutionId, courseId, input.academicYearId);
      await this.assertCoursePermission(tx, ctx, institutionId, courseId, 'enrollment.manage');
      // Student row locks serialize insertion against a global identity edit.
      await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id" = ${input.studentId}::uuid FOR UPDATE`;
      const student = await tx.student.findUnique({ where: { id: input.studentId } });
      if (!student) throw missing();
      const contexts = await tx.enrollment.findMany({ where: { studentId: input.studentId }, include: { course: true } });
      let visible = false;
      for (const row of contexts) {
        if (await this.canReadCourse(tx, ctx, row.course.institutionId, row.courseId)) { visible = true; break; }
      }
      if (!visible) throw missing();
      if (!student.isActive) throw conflict();
      const enrollment = await tx.enrollment.create({ data: { studentId: input.studentId, courseId, academicYearId: input.academicYearId }, include: { student: true } });
      await this.audit(tx, ctx, 'enrollment.create', 'Enrollment', enrollment.id, institutionId, undefined, { studentId: input.studentId, courseId, academicYearId: input.academicYearId });
      return enrollmentProjection(enrollment);
    });
  }

  private async mutateStudent(institutionId: string, studentId: string, expectedVersion: number, ctx: OperationContext, action: string, update: (tx: Prisma.TransactionClient, current: NonNullable<Awaited<ReturnType<Prisma.TransactionClient['student']['findUnique']>>>) => Promise<ReturnType<typeof studentProjection>>) {
    return this.transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id" = ${studentId}::uuid FOR UPDATE`;
      const current = await tx.student.findUnique({ where: { id: studentId } });
      if (!current) throw missing();
      const contexts = await tx.enrollment.findMany({ where: { studentId }, include: { course: true } });
      if (!contexts.some(row => row.course.institutionId === institutionId)) throw missing();
      for (const row of contexts) {
        if (!(await this.allowed(tx, ctx, 'student.manage', row.course.institutionId, row.courseId)) ||
            !(await this.teacherContext(tx, ctx, row.course.institutionId, row.courseId))) throw denied();
      }
      if (current.rowVersion !== expectedVersion) throw new AppError(409, 'STALE_VERSION', 'Versión desactualizada');
      const result = await update(tx, current);
      await this.audit(tx, ctx, action, 'Student', studentId, institutionId, studentProjection(current), result);
      return result;
    });
  }

  async patchStudent(institutionId: string, studentId: string, input: z.infer<typeof patchStudent>, ctx: OperationContext) {
    return this.mutateStudent(institutionId, studentId, input.expectedVersion, ctx, 'student.update', async tx => {
      const ids = input.nationalId === undefined ? {} : normalizeNationalId(input.nationalId);
      const updated = await tx.student.update({ where: { id: studentId }, data: {
        ...(input.givenNames === undefined ? {} : { givenNames: input.givenNames }),
        ...(input.familyNames === undefined ? {} : { familyNames: input.familyNames }), ...ids, rowVersion: { increment: 1 },
      } });
      return studentProjection(updated);
    });
  }

  async patchActivation(institutionId: string, studentId: string, input: z.infer<typeof patchActivation>, ctx: OperationContext) {
    return this.mutateStudent(institutionId, studentId, input.expectedVersion, ctx, input.isActive ? 'student.activate' : 'student.deactivate', async tx => {
      const updated = await tx.student.update({ where: { id: studentId }, data: {
        isActive: input.isActive, disabledAt: input.isActive ? null : new Date(), disabledById: input.isActive ? null : ctx.actorUserId,
        rowVersion: { increment: 1 },
      } });
      return studentProjection(updated);
    });
  }
}
