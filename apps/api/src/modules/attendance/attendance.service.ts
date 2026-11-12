import { AuditActorKind, AuditOutcome, Prisma, type AttendanceRecord, type PrismaClient } from '@prisma/client';
import type { z } from 'zod';
import { AppError } from '../../errors/app-error.js';
import type { OperationContext } from '../academic/academic.types.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import type { PermissionCode } from '../authorization/permission-catalog.js';
import { decodeCursor, encodeCursor } from '../curriculum/cursor.js';
import type * as S from './attendance.schemas.js';

type Store = PrismaClient | Prisma.TransactionClient;
type DateQuery = z.infer<typeof S.sessionQuery>;
type RecordInput = z.infer<typeof S.recordPut>;
const missing = () => new AppError(404, 'RESOURCE_NOT_FOUND', 'Recurso no encontrado');
const denied = () => new AppError(403, 'PERMISSION_DENIED', 'Acceso denegado');
const conflict = () => new AppError(409, 'CONFLICT', 'Operación en conflicto');
const stale = () => new AppError(409, 'STALE_VERSION', 'Versión desactualizada');
const invalid = () => new AppError(422, 'INVALID_REFERENCE', 'Referencia incompatible');
const dateValue = (value: string) => new Date(`${value}T00:00:00.000Z`);
const sessionData = (row: { id: string; teachingAssignmentId: string; classDate: Date; createdById: string; createdAt: Date; updatedAt: Date; rowVersion: number }) => ({
  id: row.id, teachingAssignmentId: row.teachingAssignmentId, classDate: row.classDate.toISOString().slice(0, 10),
  createdById: row.createdById, createdAt: row.createdAt, updatedAt: row.updatedAt, rowVersion: row.rowVersion,
});
const recordData = (row: AttendanceRecord) => ({
  id: row.id, attendanceSessionId: row.attendanceSessionId, enrollmentId: row.enrollmentId,
  status: row.status, isJustified: row.isJustified, justificationObservation: row.justificationObservation,
  observation: row.observation, recordedById: row.recordedById, createdAt: row.createdAt,
  updatedAt: row.updatedAt, rowVersion: row.rowVersion,
});
const auditData = (row: AttendanceRecord) => ({
  status: row.status, isJustified: row.isJustified, justificationObservation: row.justificationObservation,
  observation: row.observation, rowVersion: row.rowVersion,
});
const dateWhere = (query: { date?: string; from?: string; to?: string }) => ({
  ...(query.date ? { equals: dateValue(query.date) } : {}),
  ...(query.from ? { gte: dateValue(query.from) } : {}),
  ...(query.to ? { lte: dateValue(query.to) } : {}),
});

export class AttendanceService {
  constructor(private readonly db: PrismaClient) {}

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(work, { timeout: 15000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2034') {
            if (attempt < 2) continue;
            throw new AppError(409, 'CONCURRENT_MODIFICATION', 'Modificación concurrente');
          }
          if (error.code === 'P2002' || error.code === 'P2004') throw conflict();
          if (error.code === 'P2003') throw invalid();
        }
        throw error;
      }
    }
    throw new AppError(409, 'CONCURRENT_MODIFICATION', 'Modificación concurrente');
  }

  private async permission(tx: Store, ctx: OperationContext, code: PermissionCode, institutionId: string, courseId: string) {
    if (!(await new AuthorizationService(tx).isAuthorized(ctx.actorUserId, code, { institutionId, courseId }))) throw denied();
  }

  private async assignment(tx: Store, assignmentId: string, ctx: OperationContext, codes: PermissionCode[], writing = false) {
    const row = await tx.teachingAssignment.findUnique({ where: { id: assignmentId }, include: {
      teacher: { include: { user: true, institutions: true } }, institution: true, course: true, subject: true,
    } });
    if (!row || row.course.institutionId !== row.institutionId || row.subject.institutionId !== row.institutionId) throw missing();
    const actorTeacher = await tx.teacher.findUnique({ where: { userId: ctx.actorUserId }, select: { id: true, isActive: true } });
    if (actorTeacher) {
      if (!actorTeacher.isActive || row.teacherId !== actorTeacher.id || row.endedAt ||
          !row.teacher.user.isActive || !row.teacher.isActive ||
          !row.teacher.institutions.some(link => link.institutionId === row.institutionId && link.endedAt === null)) throw missing();
    } else if (writing) {
      // RF-015 authorizes capture by the assigned teacher. Administrative reading
      // remains possible only with explicit grants on the real course.
      throw missing();
    }
    if (writing && (!row.institution.isActive || !row.course.isActive || !row.subject.isActive || row.endedAt)) throw conflict();
    for (const code of codes) await this.permission(tx, ctx, code, row.institutionId, row.courseId);
    return row;
  }

  private async session(tx: Store, assignmentId: string, sessionId: string) {
    const row = await tx.attendanceSession.findFirst({ where: { id: sessionId, teachingAssignmentId: assignmentId } });
    if (!row) throw missing();
    return row;
  }

  private page<T extends { id: string }>(rows: T[], query: { limit: number; cursor?: string }, context: unknown) {
    const after = decodeCursor(query.cursor, context);
    const remaining = after ? rows.filter(row => row.id > after) : rows;
    const data = remaining.slice(0, query.limit);
    return { data, nextCursor: remaining.length > query.limit ? encodeCursor(data[data.length - 1]!.id, context) : null };
  }

  private async audit(tx: Store, ctx: OperationContext, action: string, entityType: string, entityId: string, institutionId: string, before?: AttendanceRecord, after?: AttendanceRecord) {
    await tx.auditLog.create({ data: {
      actorUserId: ctx.actorUserId, actorKind: ctx.accountKind === 'TECHNICAL' ? AuditActorKind.TECHNICAL : AuditActorKind.USER,
      action, entityType, entityId, institutionId, outcome: AuditOutcome.SUCCESS, requestId: ctx.requestId,
      ...(ctx.accountKind === 'TECHNICAL' ? { reason: 'Operación excepcional de asistencia' } : {}),
      ...(before ? { beforeData: auditData(before) } : {}), ...(after ? { afterData: auditData(after) } : {}),
    } });
  }

  async createSession(assignmentId: string, input: z.infer<typeof S.sessionCreate>, ctx: OperationContext) {
    return this.transaction(async tx => {
      const assignment = await this.assignment(tx, assignmentId, ctx, ['attendance.manage'], true);
      const row = await tx.attendanceSession.create({ data: {
        teachingAssignmentId: assignmentId, classDate: dateValue(input.classDate), createdById: ctx.actorUserId,
      } });
      await this.audit(tx, ctx, 'attendance-session.create', 'AttendanceSession', row.id, assignment.institutionId);
      return sessionData(row);
    });
  }

  async listSessions(assignmentId: string, query: DateQuery, ctx: OperationContext) {
    await this.assignment(this.db, assignmentId, ctx, ['attendance.read']);
    const rows = await this.db.attendanceSession.findMany({ where: { teachingAssignmentId: assignmentId, classDate: dateWhere(query) }, orderBy: { id: 'asc' } });
    const result = this.page(rows, query, { type: 'attendance-sessions', assignmentId, date: query.date, from: query.from, to: query.to });
    return { data: result.data.map(sessionData), nextCursor: result.nextCursor };
  }

  async getSession(assignmentId: string, sessionId: string, ctx: OperationContext) {
    await this.assignment(this.db, assignmentId, ctx, ['attendance.read', 'enrollment.read', 'student.read']);
    const session = await this.session(this.db, assignmentId, sessionId);
    const rows = await this.db.attendanceRecord.findMany({ where: { attendanceSessionId: sessionId }, include: { enrollment: { include: { student: true } } }, orderBy: { enrollmentId: 'asc' } });
    return { session: sessionData(session), records: rows.map(row => ({ ...recordData(row), student: {
      id: row.enrollment.student.id, givenNames: row.enrollment.student.givenNames,
      familyNames: row.enrollment.student.familyNames, isActive: row.enrollment.student.isActive,
    } })) };
  }

  private async writeRecord(tx: Prisma.TransactionClient, assignmentId: string, sessionId: string, enrollmentId: string, input: RecordInput, ctx: OperationContext) {
    const assignment = await this.assignment(tx, assignmentId, ctx, ['attendance.manage', 'enrollment.read'], true);
    const enrollment = await tx.enrollment.findUnique({ where: { id: enrollmentId }, include: { student: true } });
    if (!enrollment) throw missing();
    if (enrollment.courseId !== assignment.courseId || enrollment.academicYearId !== assignment.course.academicYearId) throw invalid();
    const existing = await tx.attendanceRecord.findUnique({ where: { attendanceSessionId_enrollmentId: { attendanceSessionId: sessionId, enrollmentId } } });
    if ((existing?.rowVersion ?? null) !== input.expectedVersion) throw stale();
    if (!existing && !enrollment.student.isActive) throw conflict();
    const data = {
      status: input.status, isJustified: input.isJustified,
      justificationObservation: input.isJustified ? (input.justificationObservation === undefined ? existing?.justificationObservation ?? null : input.justificationObservation) : null,
      observation: input.observation === undefined ? existing?.observation ?? null : input.observation,
    };
    const row = existing
      ? await tx.attendanceRecord.update({ where: { id: existing.id }, data: { ...data, rowVersion: { increment: 1 } } })
      : await tx.attendanceRecord.create({ data: { attendanceSessionId: sessionId, enrollmentId, recordedById: ctx.actorUserId, ...data } });
    await this.audit(tx, ctx, existing ? 'attendance-record.update' : 'attendance-record.create', 'AttendanceRecord', row.id, assignment.institutionId, existing ?? undefined, row);
    return { created: !existing, data: recordData(row) };
  }

  async putRecord(assignmentId: string, sessionId: string, enrollmentId: string, input: RecordInput, ctx: OperationContext) {
    return this.transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "AttendanceSession" WHERE "id" = ${sessionId}::uuid AND "teachingAssignmentId" = ${assignmentId}::uuid FOR UPDATE`;
      await this.session(tx, assignmentId, sessionId);
      return this.writeRecord(tx, assignmentId, sessionId, enrollmentId, input, ctx);
    });
  }

  async putBatch(assignmentId: string, sessionId: string, input: z.infer<typeof S.batchPut>, ctx: OperationContext) {
    return this.transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "AttendanceSession" WHERE "id" = ${sessionId}::uuid AND "teachingAssignmentId" = ${assignmentId}::uuid FOR UPDATE`;
      await this.session(tx, assignmentId, sessionId);
      const records = [];
      let createdCount = 0;
      for (const item of [...input.records].sort((a, b) => a.enrollmentId.localeCompare(b.enrollmentId))) {
        const result = await this.writeRecord(tx, assignmentId, sessionId, item.enrollmentId, item, ctx);
        records.push(result.data);
        if (result.created) createdCount++;
      }
      return { records, createdCount, updatedCount: records.length - createdCount };
    });
  }

  async listCourseSessions(institutionId: string, courseId: string, query: z.infer<typeof S.courseQuery>, ctx: OperationContext) {
    const course = await this.db.course.findFirst({ where: { id: courseId, institutionId } });
    if (!course) throw missing();
    await this.permission(this.db, ctx, 'attendance.read', institutionId, courseId);
    const actorTeacher = await this.db.teacher.findUnique({ where: { userId: ctx.actorUserId }, include: { user: true, institutions: true } });
    if (actorTeacher && (!actorTeacher.isActive || !actorTeacher.user.isActive || !actorTeacher.institutions.some(link => link.institutionId === institutionId && !link.endedAt))) throw missing();
    const rows = await this.db.attendanceSession.findMany({ where: {
      classDate: dateWhere(query), teachingAssignment: {
        courseId, institutionId, ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(actorTeacher ? { teacherId: actorTeacher.id, endedAt: null } : {}),
      },
    }, include: { teachingAssignment: { select: { subjectId: true } } }, orderBy: { id: 'asc' } });
    const result = this.page(rows, query, { type: 'course-attendance', institutionId, courseId, subjectId: query.subjectId, date: query.date, from: query.from, to: query.to });
    return { data: result.data.map(row => ({ sessionId: row.id, assignmentId: row.teachingAssignmentId, subjectId: row.teachingAssignment.subjectId, classDate: row.classDate.toISOString().slice(0, 10) })), nextCursor: result.nextCursor };
  }

  async listEnrollmentHistory(institutionId: string, enrollmentId: string, query: z.infer<typeof S.historyQuery>, ctx: OperationContext) {
    const enrollment = await this.db.enrollment.findUnique({ where: { id: enrollmentId }, include: { course: true } });
    if (!enrollment || enrollment.course.institutionId !== institutionId) throw missing();
    for (const code of ['attendance.read', 'enrollment.read', 'student.read'] as const)
      await this.permission(this.db, ctx, code, institutionId, enrollment.courseId);
    const actorTeacher = await this.db.teacher.findUnique({ where: { userId: ctx.actorUserId } });
    if (actorTeacher && !query.assignmentId) throw new AppError(400, 'VALIDATION_ERROR', 'Filtro de asignación obligatorio');
    if (query.assignmentId) {
      const assignment = await this.assignment(this.db, query.assignmentId, ctx, ['attendance.read', 'enrollment.read', 'student.read']);
      if (assignment.courseId !== enrollment.courseId) throw missing();
    }
    const rows = await this.db.attendanceRecord.findMany({ where: {
      enrollmentId, session: { classDate: dateWhere(query), teachingAssignment: {
        courseId: enrollment.courseId, institutionId, ...(query.assignmentId ? { id: query.assignmentId } : {}),
      } },
    }, include: { session: { include: { teachingAssignment: { include: { subject: { select: { id: true, name: true } } } } } } }, orderBy: { id: 'asc' } });
    const result = this.page(rows, query, { type: 'attendance-history', institutionId, enrollmentId, assignmentId: query.assignmentId, from: query.from, to: query.to });
    return { data: result.data.map(row => ({ ...recordData(row), sessionId: row.attendanceSessionId,
      classDate: row.session.classDate.toISOString().slice(0, 10), assignmentId: row.session.teachingAssignmentId,
      subject: row.session.teachingAssignment.subject,
    })), nextCursor: result.nextCursor };
  }
}
