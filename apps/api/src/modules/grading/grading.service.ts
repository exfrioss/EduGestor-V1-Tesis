import { AuditActorKind, AuditOutcome, Prisma, type PrismaClient } from '@prisma/client';
import type { z } from 'zod';
import type { AuthConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import type { OperationContext } from '../academic/academic.types.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import type { PermissionCode } from '../authorization/permission-catalog.js';
import { decodeCursor, encodeCursor } from '../curriculum/cursor.js';
import { digest, issueConfirmation, verifyConfirmation, type Purpose } from './confirmation.js';
import { formalGrade, validateDefinition, type Definition } from './grading.definition.js';
import type * as S from './grading.schemas.js';

type Store = PrismaClient | Prisma.TransactionClient;
export type GradingContext = OperationContext & { authSessionId: string };
const fail = (status: number, code: string, message: string) => new AppError(status, code, message);
const missing = () => fail(404, 'RESOURCE_NOT_FOUND', 'Recurso no encontrado');
const stale = () => fail(409, 'STALE_VERSION', 'Versión desactualizada');
const invalid = () => fail(422, 'INVALID_REFERENCE', 'Referencia incompatible');
const decimal = (value: string | Prisma.Decimal) => new Prisma.Decimal(value);
const scaleData = (row: any) => ({ id: row.id, institutionId: row.institutionId, name: row.name, version: row.version, minimumGrade: row.minimumGrade.toString(), maximumGrade: row.maximumGrade.toString(), conversionDefinition: row.conversionDefinition, roundingDefinition: row.roundingDefinition, lockedAt: row.lockedAt, rowVersion: row.rowVersion });

export class GradingService {
  constructor(private readonly db: PrismaClient, private readonly config: AuthConfig) {}

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try { return await this.db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002' || error.code === 'P2004') throw fail(409, 'CONFLICT', 'Operación en conflicto');
        if (error.code === 'P2034') throw fail(409, 'CONCURRENT_MODIFICATION', 'Modificación concurrente');
      }
      throw error;
    }
  }
  private async permission(tx: Store, ctx: GradingContext, code: PermissionCode, institutionId: string, courseId?: string) {
    if (!(await new AuthorizationService(tx).isAuthorized(ctx.actorUserId, code, { institutionId, ...(courseId ? { courseId } : {}) }))) throw fail(403, 'PERMISSION_DENIED', 'Acceso denegado');
  }
  private async institution(tx: Store, institutionId: string, ctx: GradingContext, code: PermissionCode) {
    const row = await tx.institution.findUnique({ where: { id: institutionId } });
    if (!row?.isActive) throw missing();
    await this.permission(tx, ctx, code, institutionId);
    return row;
  }
  private async assignment(tx: Store, id: string, ctx: GradingContext, codes: PermissionCode[]) {
    const row = await tx.teachingAssignment.findUnique({ where: { id }, include: { teacher: { include: { user: true, institutions: true } }, institution: true, course: true, subject: true, gradingScale: true } });
    if (!row || row.teacher.userId !== ctx.actorUserId || row.endedAt || !row.teacher.isActive || !row.teacher.user.isActive || !row.institution.isActive || !row.course.isActive || !row.subject.isActive || row.course.institutionId !== row.institutionId || row.subject.institutionId !== row.institutionId || !row.teacher.institutions.some(link => link.institutionId === row.institutionId && !link.endedAt)) throw missing();
    for (const code of codes) await this.permission(tx, ctx, code, row.institutionId, code.startsWith('grading-scale.') ? undefined : row.courseId);
    return row;
  }
  private async audit(tx: Prisma.TransactionClient, ctx: GradingContext, action: string, entityType: string, entityId: string, institutionId: string, beforeData?: unknown, afterData?: unknown, details?: unknown) {
    await tx.auditLog.create({ data: { actorUserId: ctx.actorUserId, actorKind: ctx.accountKind === 'TECHNICAL' ? AuditActorKind.TECHNICAL : AuditActorKind.USER, action, entityType, entityId, institutionId, outcome: AuditOutcome.SUCCESS, requestId: ctx.requestId, beforeData: beforeData as Prisma.InputJsonValue | undefined, afterData: afterData as Prisma.InputJsonValue | undefined, details: details as Prisma.InputJsonValue | undefined } });
  }
  private async getScale(tx: Store, institutionId: string, scaleId: string | null) {
    if (scaleId === null) return null;
    const scale = await tx.gradingScale.findFirst({ where: { id: scaleId, institutionId } });
    if (!scale) throw invalid();
    try { validateDefinition(scaleData(scale)); } catch { throw invalid(); }
    return scale;
  }
  async list(institutionId: string, query: z.infer<typeof S.page>, ctx: GradingContext) {
    await this.institution(this.db, institutionId, ctx, 'grading-scale.read');
    const after = decodeCursor(query.cursor, { type: 'grading-scales', institutionId });
    const rows = await this.db.gradingScale.findMany({ where: { institutionId, ...(after ? { id: { gt: after } } : {}) }, orderBy: { id: 'asc' }, take: query.limit + 1 });
    const data = rows.slice(0, query.limit);
    return { data: data.map(scaleData), nextCursor: rows.length > query.limit ? encodeCursor(data[data.length - 1]!.id, { type: 'grading-scales', institutionId }) : null };
  }
  async get(institutionId: string, scaleId: string, ctx: GradingContext) {
    await this.institution(this.db, institutionId, ctx, 'grading-scale.read');
    const row = await this.db.gradingScale.findFirst({ where: { id: scaleId, institutionId } });
    if (!row) throw missing();
    return scaleData(row);
  }
  async create(institutionId: string, input: z.infer<typeof S.create>, ctx: GradingContext) {
    return this.transaction(async tx => {
      await this.institution(tx, institutionId, ctx, 'grading-scale.manage');
      const def = validateDefinition(input);
      const row = await tx.gradingScale.create({ data: { institutionId, name: input.name, version: 1, minimumGrade: decimal(def.minimumGrade), maximumGrade: decimal(def.maximumGrade), conversionDefinition: def.conversionDefinition, roundingDefinition: def.roundingDefinition, createdById: ctx.actorUserId } });
      await this.audit(tx, ctx, 'grading-scale.create', 'GradingScale', row.id, institutionId, undefined, scaleData(row));
      return scaleData(row);
    });
  }
  async createVersion(institutionId: string, scaleId: string, input: z.infer<typeof S.version>, ctx: GradingContext) {
    return this.transaction(async tx => {
      await this.institution(tx, institutionId, ctx, 'grading-scale.manage');
      const source = await tx.gradingScale.findFirst({ where: { id: scaleId, institutionId } });
      if (!source) throw missing();
      if (source.rowVersion !== input.expectedVersion) throw stale();
      if (input.version <= source.version) throw fail(409, source.lockedAt ? 'SCALE_VERSION_LOCKED' : 'CONFLICT', 'Versión de escala inválida');
      const def = validateDefinition(input);
      const row = await tx.gradingScale.create({ data: { institutionId, name: source.name, version: input.version, minimumGrade: decimal(def.minimumGrade), maximumGrade: decimal(def.maximumGrade), conversionDefinition: def.conversionDefinition, roundingDefinition: def.roundingDefinition, createdById: ctx.actorUserId } });
      await this.audit(tx, ctx, 'grading-scale.version.create', 'GradingScale', row.id, institutionId, scaleData(source), scaleData(row));
      return scaleData(row);
    });
  }
  async assignedScale(assignmentId: string, ctx: GradingContext) {
    const assignment = await this.assignment(this.db, assignmentId, ctx, ['grading-scale.read', 'teaching-assignment.read']);
    return assignment.gradingScale ? scaleData(assignment.gradingScale) : null;
  }

  private async snapshot(tx: Store, assignment: Awaited<ReturnType<GradingService['assignment']>>, extraScaleId?: string | null) {
    const [tasks, assessments, enrollments] = await Promise.all([
      tx.task.findMany({ where: { teachingAssignmentId: assignment.id }, include: { assessment: true }, orderBy: { id: 'asc' } }),
      tx.assessment.findMany({ where: { teachingAssignmentId: assignment.id, taskId: null }, orderBy: { id: 'asc' } }),
      tx.enrollment.findMany({ where: { courseId: assignment.courseId, academicYearId: assignment.course.academicYearId }, orderBy: { id: 'asc' } }),
    ]);
    const activities = [
      ...tasks.map(row => ({ id: row.id, version: row.rowVersion, assessmentId: row.assessment?.id ?? null, assessmentVersion: row.assessment?.rowVersion ?? null, maxPoints: row.maxPoints.toString(), scoringKind: row.scoringKind, taskId: row.id })),
      ...assessments.map(row => ({ id: row.id, version: row.rowVersion, assessmentId: row.id, assessmentVersion: row.rowVersion, maxPoints: row.standaloneMaxPoints!.toString(), scoringKind: row.standaloneScoringKind!, taskId: null })),
    ];
    const results = await tx.assessmentResult.findMany({ where: { assessmentId: { in: activities.flatMap(a => a.assessmentId ? [a.assessmentId] : []) }, enrollmentId: { in: enrollments.map(row => row.id) } } });
    const resultMap = new Map(results.map(row => [`${row.assessmentId}:${row.enrollmentId}`, row]));
    const pairs = activities.flatMap(a => enrollments.map(e => {
      const row = a.assessmentId ? resultMap.get(`${a.assessmentId}:${e.id}`) : undefined;
      return { activityId: a.id, enrollmentId: e.id, resultId: row?.id ?? null, resultVersion: row?.rowVersion ?? null, status: row?.status ?? 'PENDIENTE', earnedPoints: row?.earnedPoints?.toString() ?? null };
    }));
    const extraScale = extraScaleId && extraScaleId !== assignment.gradingScaleId ? await this.getScale(tx, assignment.institutionId, extraScaleId) : null;
    const scales = [assignment.gradingScale, extraScale].filter(Boolean).map(row => scaleData(row));
    const snapshot = { assignment: { id: assignment.id, rowVersion: assignment.rowVersion, institutionId: assignment.institutionId, courseId: assignment.courseId, gradingScaleId: assignment.gradingScaleId }, activities, enrollments: enrollments.map(row => ({ id: row.id })), pairs, scales };
    return { ...snapshot, contextDigest: digest(snapshot) };
  }
  private project(snapshot: Awaited<ReturnType<GradingService['snapshot']>>, scale: Definition | null, override?: { id: string; maxPoints: string }) {
    const rows = snapshot.enrollments.map(enrollment => {
      let D = decimal('0'), O = decimal('0'), X = decimal('0'), pendingCount = 0;
      for (const activity of snapshot.activities) {
        const max = override?.id === activity.id ? override.maxPoints : activity.maxPoints;
        const pair = snapshot.pairs.find(row => row.activityId === activity.id && row.enrollmentId === enrollment.id)!;
        if (activity.scoringKind === 'ORDINARIA') D = D.plus(max);
        if (pair.status === 'EVALUADO') { if (activity.scoringKind === 'ORDINARIA') O = O.plus(pair.earnedPoints!); else X = X.plus(pair.earnedPoints!); }
        else pendingCount++;
      }
      const total = O.plus(X), percentage = D.isZero() ? null : total.div(D).times(100).toString();
      return { enrollmentId: enrollment.id, ordinaryPossible: D.toString(), ordinaryEarned: O.toString(), extraEarned: X.toString(), totalEarned: total.toString(), pendingCount, percentage, formalGrade: percentage !== null && pendingCount === 0 && scale ? formalGrade(percentage, scale) : null };
    });
    return rows;
  }
  private definition(scale: any): Definition | null {
    if (!scale) return null;
    try { return validateDefinition(scaleData(scale)); } catch { return null; }
  }
  private tokenInput(ctx: GradingContext, assignment: Awaited<ReturnType<GradingService['assignment']>>, purpose: Purpose, resourceId: string, version: number, oldValue: string | null, newValue: string | null, contextDigest: string) {
    return { purpose, actorUserId: ctx.actorUserId, authSessionId: ctx.authSessionId, institutionId: assignment.institutionId, assignmentId: assignment.id, resourceId, expectedAssignmentVersion: assignment.rowVersion, expectedResourceVersion: version, oldValue, newValue, contextDigest };
  }
  async scalePreview(assignmentId: string, input: z.infer<typeof S.scaleChange>, ctx: GradingContext) {
    const assignment = await this.assignment(this.db, assignmentId, ctx, ['grading-scale.read', 'teaching-assignment.manage']);
    if (assignment.rowVersion !== input.expectedAssignmentVersion) throw stale();
    if (assignment.gradingScaleId === input.newGradingScaleId) throw fail(400, 'VALIDATION_ERROR', 'La escala no cambia');
    const target = await this.getScale(this.db, assignment.institutionId, input.newGradingScaleId);
    const snapshot = await this.snapshot(this.db, assignment, input.newGradingScaleId);
    return { before: this.project(snapshot, this.definition(assignment.gradingScale)), after: this.project(snapshot, this.definition(target)), warnings: [], affectedCount: snapshot.enrollments.length, ...issueConfirmation(this.config, this.tokenInput(ctx, assignment, 'ASSIGNMENT_SCALE_CHANGE', assignment.id, assignment.rowVersion, assignment.gradingScaleId, input.newGradingScaleId, snapshot.contextDigest)) };
  }
  async scaleConfirm(assignmentId: string, input: z.infer<typeof S.scaleConfirm>, ctx: GradingContext) {
    return this.transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "TeachingAssignment" WHERE "id" = ${assignmentId}::uuid FOR UPDATE`;
      const assignment = await this.assignment(tx, assignmentId, ctx, ['grading-scale.read', 'teaching-assignment.manage']);
      if (assignment.rowVersion !== input.expectedAssignmentVersion) throw stale();
      if (assignment.gradingScaleId === input.newGradingScaleId) throw fail(400, 'VALIDATION_ERROR', 'La escala no cambia');
      await tx.$queryRaw`SELECT "id" FROM "Course" WHERE "id" = ${assignment.courseId}::uuid FOR UPDATE`;
      const target = await this.getScale(tx, assignment.institutionId, input.newGradingScaleId);
      const snapshot = await this.snapshot(tx, assignment, input.newGradingScaleId);
      verifyConfirmation(this.config, input.confirmationToken, this.tokenInput(ctx, assignment, 'ASSIGNMENT_SCALE_CHANGE', assignment.id, assignment.rowVersion, assignment.gradingScaleId, input.newGradingScaleId, snapshot.contextDigest));
      const before = this.project(snapshot, this.definition(assignment.gradingScale)), after = this.project(snapshot, this.definition(target));
      const updated = await tx.teachingAssignment.update({ where: { id: assignment.id }, data: { gradingScaleId: input.newGradingScaleId, rowVersion: { increment: 1 } } });
      await this.audit(tx, ctx, 'teaching-assignment.grading-scale.change', 'TeachingAssignment', updated.id, assignment.institutionId, { gradingScaleId: assignment.gradingScaleId }, { gradingScaleId: updated.gradingScaleId }, { affectedCount: snapshot.enrollments.length, before, after });
      return { gradingScaleId: updated.gradingScaleId, rowVersion: updated.rowVersion, before, after };
    });
  }
  private async maxResource(tx: Store, assignmentId: string, id: string, kind: 'task' | 'assessment') {
    if (kind === 'task') {
      const row = await tx.task.findFirst({ where: { id, teachingAssignmentId: assignmentId }, include: { assessment: true } });
      if (!row) throw missing();
      return { id: row.id, version: row.rowVersion, max: row.maxPoints.toString(), assessmentId: row.assessment?.id ?? null };
    }
    const row = await tx.assessment.findFirst({ where: { id, teachingAssignmentId: assignmentId } });
    if (!row) throw missing();
    if (row.taskId) throw invalid();
    return { id: row.id, version: row.rowVersion, max: row.standaloneMaxPoints!.toString(), assessmentId: row.id };
  }
  async maxPreview(assignmentId: string, resourceId: string, kind: 'task' | 'assessment', input: z.infer<typeof S.maxChange>, ctx: GradingContext) {
    const assignment = await this.assignment(this.db, assignmentId, ctx, [kind === 'task' ? 'task.manage' : 'assessment.manage', 'assessment-result.read']);
    const resource = await this.maxResource(this.db, assignmentId, resourceId, kind);
    if (resource.version !== input.expectedVersion) throw stale();
    if (decimal(resource.max).equals(input.newMaxPoints)) throw fail(400, 'VALIDATION_ERROR', 'El máximo no cambia');
    const snapshot = await this.snapshot(this.db, assignment);
    const overLimit = snapshot.pairs.filter(row => row.activityId === resourceId && row.status === 'EVALUADO' && decimal(row.earnedPoints!).greaterThan(input.newMaxPoints)).length;
    const warnings = [...(overLimit ? [`${overLimit} resultados históricos superan el nuevo máximo`] : []), ...(snapshot.pairs.some(row => row.activityId === resourceId && row.resultId) ? ['El cambio recalcula Proceso sin alterar puntos obtenidos'] : [])];
    return { before: this.project(snapshot, this.definition(assignment.gradingScale)), after: this.project(snapshot, this.definition(assignment.gradingScale), { id: resourceId, maxPoints: input.newMaxPoints }), warnings, affectedCount: snapshot.enrollments.length, ...issueConfirmation(this.config, this.tokenInput(ctx, assignment, kind === 'task' ? 'TASK_MAX_CHANGE' : 'ASSESSMENT_MAX_CHANGE', resourceId, resource.version, resource.max, input.newMaxPoints, snapshot.contextDigest)) };
  }
  async maxConfirm(assignmentId: string, resourceId: string, kind: 'task' | 'assessment', input: z.infer<typeof S.maxConfirm>, ctx: GradingContext) {
    return this.transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "TeachingAssignment" WHERE "id" = ${assignmentId}::uuid FOR UPDATE`;
      const assignment = await this.assignment(tx, assignmentId, ctx, [kind === 'task' ? 'task.manage' : 'assessment.manage']);
      await tx.$queryRaw`SELECT "id" FROM "Course" WHERE "id" = ${assignment.courseId}::uuid FOR UPDATE`;
      const table = kind === 'task' ? Prisma.raw('"Task"') : Prisma.raw('"Assessment"');
      await tx.$queryRaw`SELECT "id" FROM ${table} WHERE "id" = ${resourceId}::uuid FOR UPDATE`;
      const resource = await this.maxResource(tx, assignmentId, resourceId, kind);
      if (resource.version !== input.expectedVersion) throw stale();
      if (decimal(resource.max).equals(input.newMaxPoints)) throw fail(400, 'VALIDATION_ERROR', 'El máximo no cambia');
      const snapshot = await this.snapshot(tx, assignment);
      const hasResults = resource.assessmentId !== null && await tx.assessmentResult.count({ where: { assessmentId: resource.assessmentId } }) > 0;
      if (hasResults && !input.confirmationToken) throw fail(409, 'CONFIRMATION_REQUIRED', 'Se requiere confirmación');
      if (input.confirmationToken) verifyConfirmation(this.config, input.confirmationToken, this.tokenInput(ctx, assignment, kind === 'task' ? 'TASK_MAX_CHANGE' : 'ASSESSMENT_MAX_CHANGE', resourceId, resource.version, resource.max, input.newMaxPoints, snapshot.contextDigest));
      const before = this.project(snapshot, this.definition(assignment.gradingScale)), after = this.project(snapshot, this.definition(assignment.gradingScale), { id: resourceId, maxPoints: input.newMaxPoints });
      await tx.$queryRaw`SELECT set_config('edugestor.confirmed_max_change', ${resourceId}, true)`;
      const row = kind === 'task' ? await tx.task.update({ where: { id: resourceId }, data: { maxPoints: decimal(input.newMaxPoints), rowVersion: { increment: 1 } } }) : await tx.assessment.update({ where: { id: resourceId }, data: { standaloneMaxPoints: decimal(input.newMaxPoints), rowVersion: { increment: 1 } } });
      await this.audit(tx, ctx, `${kind}.max-points.change`, kind === 'task' ? 'Task' : 'Assessment', resourceId, assignment.institutionId, { maxPoints: resource.max }, { maxPoints: input.newMaxPoints }, { affectedCount: snapshot.enrollments.length, overLimitCount: snapshot.pairs.filter(pair => pair.activityId === resourceId && pair.status === 'EVALUADO' && decimal(pair.earnedPoints!).greaterThan(input.newMaxPoints)).length, before, after });
      return { id: row.id, maxPoints: input.newMaxPoints, rowVersion: row.rowVersion, before, after };
    });
  }
}
