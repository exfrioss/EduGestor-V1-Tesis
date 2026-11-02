import { AuditActorKind, AuditOutcome, Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import type { OperationContext } from '../academic/academic.types.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import type { PermissionCode } from '../authorization/permission-catalog.js';
import { decodeCursor, encodeCursor } from '../curriculum/cursor.js';
import type { z } from 'zod';
import type * as S from './activities.schemas.js';
import { formalGrade, validateDefinition } from '../grading/grading.definition.js';

type Store = PrismaClient | Prisma.TransactionClient;
const missing = () => new AppError(404, 'RESOURCE_NOT_FOUND', 'Recurso no encontrado');
const denied = () => new AppError(403, 'PERMISSION_DENIED', 'Acceso denegado');
const conflict = () => new AppError(409, 'CONFLICT', 'Operación en conflicto');
const stale = () => new AppError(409, 'STALE_VERSION', 'Versión desactualizada');
const invalid = () => new AppError(422, 'INVALID_REFERENCE', 'Referencia incompatible');
const decimal = (value: string | Prisma.Decimal) => new Prisma.Decimal(value);
const bankData = (row: any) => ({ id: row.id, kind: row.kind, title: row.title, description: row.description, instrumentContent: row.instrumentContent, scoringKind: row.scoringKind, suggestedMaxPoints: row.suggestedMaxPoints?.toString() ?? null, source: null, rowVersion: row.rowVersion });
const taskData = (row: any) => ({ id: row.id, teachingAssignmentId: row.teachingAssignmentId, title: row.title, description: row.description, maxPoints: row.maxPoints.toString(), scoringKind: row.scoringKind, sourceBankItemId: row.sourceBankItemId, sourceTaskId: row.sourceTaskId, assessmentId: row.assessment?.id ?? null, rowVersion: row.rowVersion });
const assessmentData = (row: any) => ({ id: row.id, teachingAssignmentId: row.teachingAssignmentId, title: row.title, description: row.description, taskId: row.taskId, sourceBankItemId: row.sourceBankItemId, sourceAssessmentId: row.sourceAssessmentId, instrumentContent: row.instrumentContent, standaloneMaxPoints: row.standaloneMaxPoints?.toString() ?? null, standaloneScoringKind: row.standaloneScoringKind, maxPoints: (row.task?.maxPoints ?? row.standaloneMaxPoints)?.toString() ?? null, scoringKind: row.task?.scoringKind ?? row.standaloneScoringKind, rowVersion: row.rowVersion });
const resultData = (row: any) => ({ id: row.id, assessmentId: row.assessmentId, enrollmentId: row.enrollmentId, status: row.status, earnedPoints: row.earnedPoints?.toString() ?? null, evaluatedAt: row.evaluatedAt, evaluatedById: row.evaluatedById, rowVersion: row.rowVersion });

export class ActivitiesService {
  constructor(private readonly db: PrismaClient) {}

  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try { return await this.db.$transaction(work, { timeout: 15000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002' || error.code === 'P2004') throw conflict();
        if (error.code === 'P2034') throw new AppError(409, 'CONCURRENT_MODIFICATION', 'Modificación concurrente');
      }
      throw error;
    }
  }
  private async audit(tx: Store, ctx: OperationContext, action: string, entityType: string, entityId: string, institutionId: string) {
    await tx.auditLog.create({ data: { actorUserId: ctx.actorUserId, actorKind: ctx.accountKind === 'TECHNICAL' ? AuditActorKind.TECHNICAL : AuditActorKind.USER, action, entityType, entityId, institutionId, outcome: AuditOutcome.SUCCESS, requestId: ctx.requestId } });
  }
  private async permission(tx: Store, ctx: OperationContext, code: PermissionCode, institutionId: string, courseId?: string) {
    if (!(await new AuthorizationService(tx).isAuthorized(ctx.actorUserId, code, { institutionId, ...(courseId ? { courseId } : {}) }))) throw denied();
  }
  private async teacher(tx: Store, ctx: OperationContext, institutionId: string, code: PermissionCode) {
    const teacher = await tx.teacher.findUnique({ where: { userId: ctx.actorUserId }, include: { user: true, institutions: { where: { institutionId, endedAt: null } } } });
    if (!teacher || !teacher.isActive || !teacher.user.isActive || teacher.institutions.length === 0) throw missing();
    const institution = await tx.institution.findUnique({ where: { id: institutionId } });
    if (!institution?.isActive) throw missing();
    const assignments = await tx.teachingAssignment.findMany({ where: { teacherId: teacher.id, institutionId, endedAt: null, course: { isActive: true }, subject: { isActive: true } }, select: { courseId: true } });
    if (assignments.length === 0) throw missing();
    const authorization = new AuthorizationService(tx);
    let permitted = false;
    for (const assignment of assignments) {
      if (await authorization.isAuthorized(ctx.actorUserId, code, { institutionId, courseId: assignment.courseId })) { permitted = true; break; }
    }
    if (!permitted) throw denied();
    return teacher;
  }
  private async assignment(tx: Store, id: string, ctx: OperationContext, codes: PermissionCode[]) {
    if (tx !== this.db) await tx.$queryRaw`SELECT "id" FROM "TeachingAssignment" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const row = await tx.teachingAssignment.findUnique({ where: { id }, include: { teacher: { include: { user: true, institutions: true } }, institution: true, course: true, subject: true } });
    if (!row || row.teacher.userId !== ctx.actorUserId || row.endedAt || !row.teacher.isActive || !row.teacher.user.isActive || !row.institution.isActive || !row.course.isActive || !row.subject.isActive || row.course.institutionId !== row.institutionId || row.subject.institutionId !== row.institutionId || !row.teacher.institutions.some(link => link.institutionId === row.institutionId && !link.endedAt)) throw missing();
    for (const code of codes) await this.permission(tx, ctx, code, row.institutionId, row.courseId);
    return row;
  }
  private async bank(tx: Store, institutionId: string, itemId: string, ctx: OperationContext, code: PermissionCode) {
    const owner = await this.teacher(tx, ctx, institutionId, code);
    const item = await tx.activityBankItem.findFirst({ where: { id: itemId, ownerTeacherId: owner.id } });
    if (!item) throw missing();
    return item;
  }
  private async task(tx: Store, assignmentId: string, taskId: string) {
    const row = await tx.task.findFirst({ where: { id: taskId, teachingAssignmentId: assignmentId }, include: { assessment: true } });
    if (!row) throw missing();
    return row;
  }
  private async assessment(tx: Store, assignmentId: string, assessmentId: string) {
    const row = await tx.assessment.findFirst({ where: { id: assessmentId, teachingAssignmentId: assignmentId }, include: { task: true } });
    if (!row) throw missing();
    return row;
  }
  private async enrollment(tx: Store, assignment: { courseId: string; course: { academicYearId: string } }, enrollmentId: string, writing = false) {
    const row = await tx.enrollment.findUnique({ where: { id: enrollmentId }, include: { student: true } });
    if (!row || row.courseId !== assignment.courseId || row.academicYearId !== assignment.course.academicYearId) throw invalid();
    if (writing && !row.student.isActive) throw conflict();
    return row;
  }
  private page<T extends { id: string }>(rows: T[], query: { limit: number; cursor?: string }, context: unknown) {
    const after = decodeCursor(query.cursor, context);
    const filtered = after ? rows.filter(row => row.id > after) : rows;
    const data = filtered.slice(0, query.limit);
    return { data, nextCursor: filtered.length > query.limit ? encodeCursor(data[data.length - 1]!.id, context) : null };
  }

  async listBank(institutionId: string, query: z.infer<typeof S.bankPage>, ctx: OperationContext) {
    const owner = await this.teacher(this.db, ctx, institutionId, 'activity-bank.read');
    const rows = await this.db.activityBankItem.findMany({ where: { ownerTeacherId: owner.id, ...(query.kind ? { kind: query.kind } : {}), ...(query.q ? { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }] } : {}) }, orderBy: { id: 'asc' } });
    const result = this.page(rows, query, { type: 'bank', institutionId, ownerId: owner.id, kind: query.kind, q: query.q });
    return { data: result.data.map(bankData), nextCursor: result.nextCursor };
  }
  async getBank(institutionId: string, itemId: string, ctx: OperationContext) { return bankData(await this.bank(this.db, institutionId, itemId, ctx, 'activity-bank.read')); }
  async createBank(institutionId: string, input: z.infer<typeof S.bankCreate>, ctx: OperationContext) {
    return this.transaction(async tx => {
      const owner = await this.teacher(tx, ctx, institutionId, 'activity-bank.manage');
      const row = await tx.activityBankItem.create({ data: { ownerTeacherId: owner.id, kind: input.kind, title: input.title, description: input.description, scoringKind: input.scoringKind, suggestedMaxPoints: input.suggestedMaxPoints == null ? null : decimal(input.suggestedMaxPoints), instrumentContent: input.instrumentContent ?? null } });
      await this.audit(tx, ctx, 'activity-bank.create', 'ActivityBankItem', row.id, institutionId); return bankData(row);
    });
  }
  async patchBank(institutionId: string, itemId: string, input: z.infer<typeof S.bankPatch>, ctx: OperationContext) {
    return this.transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "ActivityBankItem" WHERE "id" = ${itemId}::uuid FOR UPDATE`;
      const row = await this.bank(tx, institutionId, itemId, ctx, 'activity-bank.manage');
      if (row.rowVersion !== input.expectedVersion) throw stale();
      const changed = await tx.activityBankItem.update({ where: { id: itemId }, data: { ...(input.kind ? { kind: input.kind } : {}), ...(input.title ? { title: input.title } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.scoringKind ? { scoringKind: input.scoringKind } : {}), ...(input.suggestedMaxPoints !== undefined ? { suggestedMaxPoints: input.suggestedMaxPoints === null ? null : decimal(input.suggestedMaxPoints) } : {}), ...(input.instrumentContent !== undefined ? { instrumentContent: input.instrumentContent } : {}), rowVersion: { increment: 1 } } });
      await this.audit(tx, ctx, 'activity-bank.update', 'ActivityBankItem', row.id, institutionId); return bankData(changed);
    });
  }
  async listTasks(assignmentId: string, query: z.infer<typeof S.page>, ctx: OperationContext) {
    await this.assignment(this.db, assignmentId, ctx, ['task.read']);
    const rows = await this.db.task.findMany({ where: { teachingAssignmentId: assignmentId }, include: { assessment: { select: { id: true } } }, orderBy: { id: 'asc' } });
    const result = this.page(rows, query, { type: 'tasks', assignmentId }); return { data: result.data.map(taskData), nextCursor: result.nextCursor };
  }
  async getTask(assignmentId: string, taskId: string, ctx: OperationContext) { await this.assignment(this.db, assignmentId, ctx, ['task.read']); return taskData(await this.task(this.db, assignmentId, taskId)); }
  async createTask(assignmentId: string, input: z.infer<typeof S.taskCreate>, ctx: OperationContext) {
    return this.transaction(async tx => {
      const assignment = await this.assignment(tx, assignmentId, ctx, ['task.manage']);
      const bank = input.sourceBankItemId ? await this.bank(tx, assignment.institutionId, input.sourceBankItemId, ctx, 'activity-bank.read') : null;
      if (bank && bank.kind !== 'TASK') throw invalid();
      const row = await tx.task.create({ data: { teachingAssignmentId: assignmentId, title: bank?.title ?? input.title, description: bank?.description ?? input.description, maxPoints: decimal(input.maxPoints), scoringKind: input.scoringKind, sourceBankItemId: input.sourceBankItemId, createdById: ctx.actorUserId } });
      await this.audit(tx, ctx, 'task.create', 'Task', row.id, assignment.institutionId); return taskData(row);
    });
  }
  async reuseTask(assignmentId: string, taskId: string, input: z.infer<typeof S.taskReuse>, ctx: OperationContext) {
    return this.transaction(async tx => {
      await this.assignment(tx, assignmentId, ctx, ['task.read']); const source = await this.task(tx, assignmentId, taskId);
      const target = await this.assignment(tx, input.targetAssignmentId, ctx, ['task.manage']);
      const row = await tx.task.create({ data: { teachingAssignmentId: target.id, title: input.title ?? source.title, description: input.description ?? source.description, maxPoints: decimal(input.maxPoints ?? source.maxPoints), scoringKind: input.scoringKind ?? source.scoringKind, sourceTaskId: source.id, createdById: ctx.actorUserId } });
      await this.audit(tx, ctx, 'task.reuse', 'Task', row.id, target.institutionId); return taskData(row);
    });
  }
  async patchTask(assignmentId: string, taskId: string, input: z.infer<typeof S.taskPatch>, ctx: OperationContext) {
    return this.transaction(async tx => {
      const assignment = await this.assignment(tx, assignmentId, ctx, ['task.manage']);
      await tx.$queryRaw`SELECT "id" FROM "Task" WHERE "id" = ${taskId}::uuid FOR UPDATE`;
      const row = await this.task(tx, assignmentId, taskId);
      if (row.rowVersion !== input.expectedVersion) throw stale();
      const changed = await tx.task.update({ where: { id: row.id }, data: { ...(input.title ? { title: input.title } : {}), ...(input.description !== undefined ? { description: input.description } : {}), rowVersion: { increment: 1 } }, include: { assessment: { select: { id: true } } } });
      await this.audit(tx, ctx, 'task.update', 'Task', row.id, assignment.institutionId); return taskData(changed);
    });
  }

  async listAssessments(assignmentId: string, query: z.infer<typeof S.assessmentPage>, ctx: OperationContext) {
    await this.assignment(this.db, assignmentId, ctx, ['assessment.read']);
    const rows = await this.db.assessment.findMany({ where: { teachingAssignmentId: assignmentId, ...(query.taskId ? { taskId: query.taskId } : {}) }, include: { task: true }, orderBy: { id: 'asc' } });
    const result = this.page(rows, query, { type: 'assessments', assignmentId, taskId: query.taskId }); return { data: result.data.map(assessmentData), nextCursor: result.nextCursor };
  }
  async getAssessment(assignmentId: string, assessmentId: string, ctx: OperationContext) { await this.assignment(this.db, assignmentId, ctx, ['assessment.read']); return assessmentData(await this.assessment(this.db, assignmentId, assessmentId)); }
  async createAssessment(assignmentId: string, input: z.infer<typeof S.assessmentCreate>, ctx: OperationContext) {
    return this.transaction(async tx => {
      const assignment = await this.assignment(tx, assignmentId, ctx, ['assessment.manage']);
      const task = input.taskId ? (await this.assignment(tx, assignmentId, ctx, ['task.read']), await this.task(tx, assignmentId, input.taskId)) : null;
      const bank = input.sourceBankItemId ? await this.bank(tx, assignment.institutionId, input.sourceBankItemId, ctx, 'activity-bank.read') : null;
      if (bank && bank.kind !== 'INSTRUMENT') throw invalid();
      if (task?.assessment) throw conflict();
      const row = await tx.assessment.create({ data: { teachingAssignmentId: assignmentId, title: bank?.title ?? input.title, description: bank?.description ?? input.description ?? null, taskId: input.taskId, standaloneMaxPoints: input.taskId ? null : decimal(input.standaloneMaxPoints!), standaloneScoringKind: input.taskId ? null : input.standaloneScoringKind!, instrumentContent: bank?.instrumentContent ?? input.instrumentContent ?? null, sourceBankItemId: input.sourceBankItemId, createdById: ctx.actorUserId }, include: { task: true } });
      await this.audit(tx, ctx, 'assessment.create', 'Assessment', row.id, assignment.institutionId); return assessmentData(row);
    });
  }
  async reuseAssessment(assignmentId: string, assessmentId: string, input: z.infer<typeof S.assessmentReuse>, ctx: OperationContext) {
    return this.transaction(async tx => {
      await this.assignment(tx, assignmentId, ctx, ['assessment.read']); const source = await this.assessment(tx, assignmentId, assessmentId);
      const target = await this.assignment(tx, input.targetAssignmentId, ctx, ['assessment.manage']);
      const row = await tx.assessment.create({ data: { teachingAssignmentId: target.id, title: input.title ?? source.title, description: input.description === undefined ? source.description : input.description, instrumentContent: source.instrumentContent, standaloneMaxPoints: decimal(input.standaloneMaxPoints ?? source.task?.maxPoints ?? source.standaloneMaxPoints!), standaloneScoringKind: input.standaloneScoringKind ?? source.task?.scoringKind ?? source.standaloneScoringKind!, sourceAssessmentId: source.id, createdById: ctx.actorUserId }, include: { task: true } });
      await this.audit(tx, ctx, 'assessment.reuse', 'Assessment', row.id, target.institutionId); return assessmentData(row);
    });
  }
  async patchAssessment(assignmentId: string, assessmentId: string, input: z.infer<typeof S.assessmentPatch>, ctx: OperationContext) {
    return this.transaction(async tx => {
      const assignment = await this.assignment(tx, assignmentId, ctx, ['assessment.manage']);
      await tx.$queryRaw`SELECT "id" FROM "Assessment" WHERE "id" = ${assessmentId}::uuid FOR UPDATE`;
      const row = await this.assessment(tx, assignmentId, assessmentId);
      if (row.rowVersion !== input.expectedVersion) throw stale();
      const changed = await tx.assessment.update({ where: { id: row.id }, data: { ...(input.title ? { title: input.title } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.instrumentContent !== undefined ? { instrumentContent: input.instrumentContent } : {}), rowVersion: { increment: 1 } }, include: { task: true } });
      await this.audit(tx, ctx, 'assessment.update', 'Assessment', row.id, assignment.institutionId); return assessmentData(changed);
    });
  }
  async linkTask(assignmentId: string, assessmentId: string, input: z.infer<typeof S.linkTask>, ctx: OperationContext) {
    return this.transaction(async tx => {
      const assignment = await this.assignment(tx, assignmentId, ctx, ['assessment.manage', 'task.read']);
      await tx.$queryRaw`SELECT "id" FROM "Assessment" WHERE "id" = ${assessmentId}::uuid FOR UPDATE`;
      const row = await this.assessment(tx, assignmentId, assessmentId);
      if (row.rowVersion !== input.expectedVersion) throw stale(); if (row.taskId) throw conflict();
      const task = await this.task(tx, assignmentId, input.taskId); if (task.assessment) throw conflict();
      if (await tx.assessmentResult.count({ where: { assessmentId: row.id } })) throw conflict();
      const changed = await tx.assessment.update({ where: { id: row.id }, data: { taskId: task.id, standaloneMaxPoints: null, standaloneScoringKind: null, rowVersion: { increment: 1 } }, include: { task: true } });
      await this.audit(tx, ctx, 'assessment.link-task', 'Assessment', row.id, assignment.institutionId); return assessmentData(changed);
    });
  }

  async listResults(assignmentId: string, assessmentId: string, query: z.infer<typeof S.page>, ctx: OperationContext) {
    const assignment = await this.assignment(this.db, assignmentId, ctx, ['assessment-result.read', 'assessment.read', 'enrollment.read', 'student.read']);
    await this.assessment(this.db, assignmentId, assessmentId);
    const enrollments = await this.db.enrollment.findMany({ where: { courseId: assignment.courseId, academicYearId: assignment.course.academicYearId }, include: { student: true }, orderBy: { id: 'asc' } });
    const paged = this.page(enrollments, query, { type: 'results', assignmentId, assessmentId });
    const results = await this.db.assessmentResult.findMany({ where: { assessmentId, enrollmentId: { in: paged.data.map(row => row.id) } } });
    const byEnrollment = new Map(results.map(row => [row.enrollmentId, row]));
    return { data: paged.data.map(row => ({ enrollmentId: row.id, student: { id: row.student.id, givenNames: row.student.givenNames, familyNames: row.student.familyNames, isActive: row.student.isActive }, result: byEnrollment.has(row.id) ? resultData(byEnrollment.get(row.id)) : null, status: byEnrollment.get(row.id)?.status ?? 'PENDIENTE' })), nextCursor: paged.nextCursor };
  }
  private async writeResult(tx: Prisma.TransactionClient, assignmentId: string, assessmentId: string, enrollmentId: string, input: z.infer<typeof S.resultPut>, ctx: OperationContext, taskId?: string) {
    const assignment = await this.assignment(tx, assignmentId, ctx, ['assessment-result.manage', taskId ? 'task.read' : 'assessment.read', 'enrollment.read']);
    const current = await this.assessment(tx, assignmentId, assessmentId);
    if (current.taskId) await tx.$queryRaw`SELECT "id" FROM "Task" WHERE "id" = ${current.taskId}::uuid FOR UPDATE`;
    else await tx.$queryRaw`SELECT "id" FROM "Assessment" WHERE "id" = ${assessmentId}::uuid FOR UPDATE`;
    const assessment = await this.assessment(tx, assignmentId, assessmentId);
    await this.enrollment(tx, assignment, enrollmentId, true);
    const max = assessment.task?.maxPoints ?? assessment.standaloneMaxPoints!;
    if (input.status === 'EVALUADO' && decimal(input.earnedPoints!).greaterThan(max)) throw invalid();
    await tx.$queryRaw`SELECT "id" FROM "AssessmentResult" WHERE "assessmentId" = ${assessmentId}::uuid AND "enrollmentId" = ${enrollmentId}::uuid FOR UPDATE`;
    const existing = await tx.assessmentResult.findUnique({ where: { assessmentId_enrollmentId: { assessmentId, enrollmentId } } });
    if ((existing?.rowVersion ?? null) !== input.expectedVersion) throw stale();
    const data = { status: input.status, earnedPoints: input.status === 'EVALUADO' ? decimal(input.earnedPoints!) : null, evaluatedAt: input.status === 'EVALUADO' ? new Date() : null, evaluatedById: input.status === 'EVALUADO' ? ctx.actorUserId : null };
    const row = existing ? await tx.assessmentResult.update({ where: { id: existing.id }, data: { ...data, rowVersion: { increment: 1 } } }) : await tx.assessmentResult.create({ data: { assessmentId, enrollmentId, ...data } });
    await this.audit(tx, ctx, existing ? 'assessment-result.update' : 'assessment-result.create', 'AssessmentResult', row.id, assignment.institutionId);
    return { created: !existing, data: resultData(row) };
  }
  async putAssessmentResult(assignmentId: string, assessmentId: string, enrollmentId: string, input: z.infer<typeof S.resultPut>, ctx: OperationContext) {
    return this.transaction(tx => this.writeResult(tx, assignmentId, assessmentId, enrollmentId, input, ctx));
  }
  async putTaskResult(assignmentId: string, taskId: string, enrollmentId: string, input: z.infer<typeof S.resultPut>, ctx: OperationContext) {
    return this.transaction(async tx => {
      const assignment = await this.assignment(tx, assignmentId, ctx, ['assessment-result.manage', 'task.read', 'enrollment.read']);
      await this.enrollment(tx, assignment, enrollmentId, true);
      // Serialize the first linked Assessment creation on the Task row.
      await tx.$queryRaw`SELECT "id" FROM "Task" WHERE "id" = ${taskId}::uuid FOR UPDATE`;
      const task = await this.task(tx, assignmentId, taskId);
      if (task.rowVersion !== input.expectedTaskVersion) throw stale();
      let assessment = task.assessment;
      if (!assessment) {
        assessment = await tx.assessment.create({ data: { teachingAssignmentId: assignmentId, taskId, title: task.title, description: task.description, createdById: ctx.actorUserId } });
        await this.audit(tx, ctx, 'assessment.create-for-task', 'Assessment', assessment.id, assignment.institutionId);
      }
      return this.writeResult(tx, assignmentId, assessment.id, enrollmentId, input, ctx, taskId);
    });
  }

  async process(assignmentId: string, query: z.infer<typeof S.page>, ctx: OperationContext) {
    const assignment = await this.assignment(this.db, assignmentId, ctx, ['task.read', 'assessment.read', 'assessment-result.read', 'enrollment.read', 'student.read']);
    const appliedScale = assignment.gradingScaleId ? await this.db.gradingScale.findFirst({ where: { id: assignment.gradingScaleId, institutionId: assignment.institutionId } }) : null;
    let definition: ReturnType<typeof validateDefinition> | null = null;
    if (appliedScale) {
      try { definition = validateDefinition({ minimumGrade: appliedScale.minimumGrade.toString(), maximumGrade: appliedScale.maximumGrade.toString(), conversionDefinition: appliedScale.conversionDefinition, roundingDefinition: appliedScale.roundingDefinition }); } catch { definition = null; }
    }
    const [tasks, independent, enrollments] = await Promise.all([
      this.db.task.findMany({ where: { teachingAssignmentId: assignmentId }, include: { assessment: true }, orderBy: { id: 'asc' } }),
      this.db.assessment.findMany({ where: { teachingAssignmentId: assignmentId, taskId: null }, orderBy: { id: 'asc' } }),
      this.db.enrollment.findMany({ where: { courseId: assignment.courseId, academicYearId: assignment.course.academicYearId }, include: { student: true }, orderBy: { id: 'asc' } }),
    ]);
    const activities = [
      ...tasks.map(row => ({ id: row.id, kind: 'TASK', title: row.title, assessmentId: row.assessment?.id ?? null, maxPoints: row.maxPoints.toString(), scoringKind: row.scoringKind })),
      ...independent.map(row => ({ id: row.id, kind: 'ASSESSMENT', title: row.title, assessmentId: row.id, maxPoints: row.standaloneMaxPoints!.toString(), scoringKind: row.standaloneScoringKind! })),
    ];
    const paged = this.page(enrollments, query, { type: 'process', assignmentId });
    const results = await this.db.assessmentResult.findMany({ where: { assessmentId: { in: activities.flatMap(a => a.assessmentId ? [a.assessmentId] : []) }, enrollmentId: { in: paged.data.map(row => row.id) } } });
    const resultMap = new Map(results.map(row => [`${row.assessmentId}:${row.enrollmentId}`, row]));
    const rows = paged.data.map(enrollment => {
      let D = new Prisma.Decimal(0), O = new Prisma.Decimal(0), X = new Prisma.Decimal(0), pendingCount = 0;
      const resultStates = activities.map(activity => {
        const result = activity.assessmentId ? resultMap.get(`${activity.assessmentId}:${enrollment.id}`) : undefined;
        const evaluated = result?.status === 'EVALUADO';
        if (activity.scoringKind === 'ORDINARIA') D = D.plus(activity.maxPoints);
        if (evaluated) { if (activity.scoringKind === 'ORDINARIA') O = O.plus(result.earnedPoints!); else X = X.plus(result.earnedPoints!); }
        else pendingCount++;
        return { activityId: activity.id, status: result?.status ?? 'PENDIENTE', earnedPoints: evaluated ? result.earnedPoints!.toString() : null, rowVersion: result?.rowVersion ?? null };
      });
      const T = O.plus(X);
      const percentage = D.isZero() ? null : T.div(D).times(100).toString();
      const grade = percentage !== null && pendingCount === 0 && definition ? formalGrade(percentage, definition) : null;
      return { enrollmentId: enrollment.id, student: { id: enrollment.student.id, givenNames: enrollment.student.givenNames, familyNames: enrollment.student.familyNames }, ordinaryPossible: D.toString(), ordinaryEarned: O.toString(), extraEarned: X.toString(), totalEarned: T.toString(), pendingCount, isPartial: pendingCount > 0, percentage, formalGrade: grade, formalGradeReason: D.isZero() ? 'NO_ORDINARY_BASE' : pendingCount ? 'PENDING_RESULTS' : grade === null ? 'NO_VALID_SCALE' : null, results: resultStates };
    });
    return { data: { assignmentId, activities, rows }, nextCursor: paged.nextCursor };
  }
}
