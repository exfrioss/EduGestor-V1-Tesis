import {
  AccountKind,
  AuditActorKind,
  AuditOutcome,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import type { CurriculumContext, PageInput } from './curriculum.types.js';

const denied = () => new AppError(403, 'PERMISSION_DENIED', 'Acceso denegado');
const notFound = () => new AppError(404, 'RESOURCE_NOT_FOUND', 'Recurso no encontrado');
const invalidReference = () =>
  new AppError(422, 'INVALID_REFERENCE', 'La referencia indicada no es válida');

const planProjection = { id: true, code: true, name: true, rowVersion: true } as const;
const areaProjection = { id: true, planTypeId: true, code: true, name: true, rowVersion: true } as const;
const disciplineProjection = {
  id: true,
  planTypeId: true,
  academicAreaId: true,
  code: true,
  officialName: true,
  rowVersion: true,
} as const;
const mappingProjection = {
  id: true,
  subjectId: true,
  btiYear: true,
  curriculumDisciplineId: true,
  retiredAt: true,
  rowVersion: true,
  curriculumDiscipline: {
    select: {
      officialName: true,
      planType: { select: { id: true, name: true } },
      academicArea: { select: { id: true, name: true } },
    },
  },
} as const;

type Database = PrismaClient | Prisma.TransactionClient;
type MappingRecord = Prisma.SubjectCurriculumMappingGetPayload<{ select: typeof mappingProjection }>;

export class CurriculumService {
  constructor(private readonly client: PrismaClient) {}

  async listPlanTypes(input: { institutionId: string } & PageInput, context: CurriculumContext) {
    await this.requireCatalogRead(input.institutionId, context);
    const cursorContext = { route: 'plan-types', institutionId: input.institutionId };
    const after = decodeCursor(input.cursor, cursorContext);
    const rows = await this.client.planType.findMany({
      where: after === undefined ? undefined : { id: { gt: after } },
      select: planProjection,
      orderBy: { id: 'asc' },
      take: input.limit + 1,
    });
    return this.page(rows, input.limit, cursorContext);
  }

  async listAcademicAreas(
    planTypeId: string,
    input: { institutionId: string } & PageInput,
    context: CurriculumContext,
  ) {
    await this.requireCatalogRead(input.institutionId, context);
    if ((await this.client.planType.count({ where: { id: planTypeId } })) === 0) throw notFound();
    const cursorContext = { route: 'academic-areas', institutionId: input.institutionId, planTypeId };
    const after = decodeCursor(input.cursor, cursorContext);
    const rows = await this.client.academicArea.findMany({
      where: { planTypeId, ...(after === undefined ? {} : { id: { gt: after } }) },
      select: areaProjection,
      orderBy: { id: 'asc' },
      take: input.limit + 1,
    });
    return this.page(rows, input.limit, cursorContext);
  }

  async listDisciplines(
    input: {
      institutionId: string;
      planTypeId?: string;
      academicAreaId?: string;
      areaStatus?: 'known' | 'unknown';
    } & PageInput,
    context: CurriculumContext,
  ) {
    await this.requireCatalogRead(input.institutionId, context);
    if (
      input.planTypeId !== undefined &&
      (await this.client.planType.count({ where: { id: input.planTypeId } })) === 0
    ) throw notFound();
    if (input.academicAreaId !== undefined) {
      const area = await this.client.academicArea.findUnique({
        where: { id: input.academicAreaId },
        select: { planTypeId: true },
      });
      if (area === null) throw notFound();
      if (input.planTypeId !== undefined && area.planTypeId !== input.planTypeId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Los filtros de plan y área no coinciden');
      }
    }
    const cursorContext = {
      route: 'disciplines',
      institutionId: input.institutionId,
      planTypeId: input.planTypeId ?? null,
      academicAreaId: input.academicAreaId ?? null,
      areaStatus: input.areaStatus ?? null,
    };
    const after = decodeCursor(input.cursor, cursorContext);
    const rows = await this.client.curriculumDiscipline.findMany({
      where: {
        planTypeId: input.planTypeId,
        academicAreaId:
          input.academicAreaId ??
          (input.areaStatus === 'known' ? { not: null } : input.areaStatus === 'unknown' ? null : undefined),
        ...(after === undefined ? {} : { id: { gt: after } }),
      },
      select: disciplineProjection,
      orderBy: { id: 'asc' },
      take: input.limit + 1,
    });
    return this.page(
      rows.map((row) => ({
        ...row,
        classificationStatus: row.academicAreaId === null ? 'INCOMPLETE' : 'COMPLETE',
      })),
      input.limit,
      cursorContext,
    );
  }

  createPlanType(
    input: { code: string; name: string; technicalReason: string },
    context: CurriculumContext,
  ) {
    return this.technicalMutation('curriculum.plan-type.create', 'PlanType', input.technicalReason, context, async (db) => {
      try {
        const created = await db.planType.create({
          data: { code: input.code, name: input.name },
          select: planProjection,
        });
        await this.audit(db, context, 'curriculum.plan-type.create', 'PlanType', created.id, input.technicalReason, { code: created.code, name: created.name });
        return created;
      } catch (error) {
        this.rethrowUnique(error);
      }
    });
  }

  updatePlanType(
    id: string,
    input: { name: string; expectedVersion: number; technicalReason: string },
    context: CurriculumContext,
  ) {
    return this.technicalMutation('curriculum.plan-type.update', 'PlanType', input.technicalReason, context, async (db) => {
      const result = await db.planType.updateMany({
        where: { id, rowVersion: input.expectedVersion },
        data: { name: input.name, rowVersion: { increment: 1 } },
      });
      if (result.count === 0) await this.throwMissingOrStale(db, 'planType', id);
      const updated = await db.planType.findUniqueOrThrow({ where: { id }, select: planProjection });
      await this.audit(db, context, 'curriculum.plan-type.update', 'PlanType', id, input.technicalReason, { name: updated.name, rowVersion: updated.rowVersion });
      return updated;
    });
  }

  createAcademicArea(
    input: { planTypeId: string; code: string; name: string; technicalReason: string },
    context: CurriculumContext,
  ) {
    return this.technicalMutation('curriculum.academic-area.create', 'AcademicArea', input.technicalReason, context, async (db) => {
      if ((await db.planType.count({ where: { id: input.planTypeId } })) === 0) throw invalidReference();
      try {
        const created = await db.academicArea.create({
          data: { planTypeId: input.planTypeId, code: input.code, name: input.name },
          select: areaProjection,
        });
        await this.audit(db, context, 'curriculum.academic-area.create', 'AcademicArea', created.id, input.technicalReason, { planTypeId: created.planTypeId, code: created.code, name: created.name });
        return created;
      } catch (error) {
        this.rethrowUnique(error);
      }
    });
  }

  updateAcademicArea(
    id: string,
    input: { name: string; expectedVersion: number; technicalReason: string },
    context: CurriculumContext,
  ) {
    return this.technicalMutation('curriculum.academic-area.update', 'AcademicArea', input.technicalReason, context, async (db) => {
      const result = await db.academicArea.updateMany({ where: { id, rowVersion: input.expectedVersion }, data: { name: input.name, rowVersion: { increment: 1 } } });
      if (result.count === 0) await this.throwMissingOrStale(db, 'academicArea', id);
      const updated = await db.academicArea.findUniqueOrThrow({ where: { id }, select: areaProjection });
      await this.audit(db, context, 'curriculum.academic-area.update', 'AcademicArea', id, input.technicalReason, { name: updated.name, rowVersion: updated.rowVersion });
      return updated;
    });
  }

  createDiscipline(
    input: { planTypeId: string; academicAreaId: string | null; code: string; officialName: string; technicalReason: string },
    context: CurriculumContext,
  ) {
    return this.technicalMutation('curriculum.discipline.create', 'CurriculumDiscipline', input.technicalReason, context, async (db) => {
      await this.validateArea(db, input.planTypeId, input.academicAreaId);
      try {
        const created = await db.curriculumDiscipline.create({
          data: {
            planTypeId: input.planTypeId,
            academicAreaId: input.academicAreaId,
            code: input.code,
            officialName: input.officialName,
          },
          select: disciplineProjection,
        });
        await this.audit(db, context, 'curriculum.discipline.create', 'CurriculumDiscipline', created.id, input.technicalReason, { planTypeId: created.planTypeId, academicAreaId: created.academicAreaId, code: created.code, officialName: created.officialName });
        return { ...created, classificationStatus: created.academicAreaId === null ? 'INCOMPLETE' : 'COMPLETE' };
      } catch (error) {
        this.rethrowUnique(error);
      }
    });
  }

  updateDiscipline(
    id: string,
    input: { officialName?: string; academicAreaId?: string | null; expectedVersion: number; technicalReason: string },
    context: CurriculumContext,
  ) {
    return this.technicalMutation('curriculum.discipline.update', 'CurriculumDiscipline', input.technicalReason, context, async (db) => {
      const current = await db.curriculumDiscipline.findUnique({ where: { id }, select: disciplineProjection });
      if (current === null) throw notFound();
      if (current.rowVersion !== input.expectedVersion) throw new AppError(409, 'STALE_VERSION', 'La versión cambió');
      if (input.academicAreaId !== undefined) {
        await this.validateArea(db, current.planTypeId, input.academicAreaId);
        const reclassifies = current.academicAreaId !== null && input.academicAreaId !== current.academicAreaId;
        if (reclassifies && (await db.subjectCurriculumMapping.count({ where: { curriculumDisciplineId: id } })) > 0) {
          throw new AppError(409, 'HISTORICAL_REFERENCE_CONFLICT', 'La clasificación ya tiene referencias históricas');
        }
      }
      const updated = await db.curriculumDiscipline.update({
        where: { id },
        data: {
          officialName: input.officialName,
          academicAreaId: input.academicAreaId,
          rowVersion: { increment: 1 },
        },
        select: disciplineProjection,
      });
      await this.audit(db, context, 'curriculum.discipline.update', 'CurriculumDiscipline', id, input.technicalReason, { officialName: updated.officialName, academicAreaId: updated.academicAreaId, rowVersion: updated.rowVersion });
      return { ...updated, classificationStatus: updated.academicAreaId === null ? 'INCOMPLETE' : 'COMPLETE' };
    });
  }

  async listMappings(
    institutionId: string,
    subjectId: string,
    input: { btiYear?: number; status: 'current' | 'retired' | 'all'; courseId?: string } & PageInput,
    context: CurriculumContext,
  ) {
    const effectiveYear = await this.requireMappingRead(institutionId, subjectId, input.courseId, input.btiYear, context);
    const cursorContext = { route: 'mappings', institutionId, subjectId, btiYear: effectiveYear ?? null, status: input.status, courseId: input.courseId ?? null };
    const after = decodeCursor(input.cursor, cursorContext);
    const rows = await this.client.subjectCurriculumMapping.findMany({
      where: {
        subjectId,
        btiYear: effectiveYear,
        retiredAt: input.status === 'current' ? null : input.status === 'retired' ? { not: null } : undefined,
        ...(after === undefined ? {} : { id: { gt: after } }),
      },
      select: mappingProjection,
      orderBy: { id: 'asc' },
      take: input.limit + 1,
    });
    return this.page(rows.map((row) => this.mappingView(row)), input.limit, cursorContext);
  }

  createMapping(
    institutionId: string,
    subjectId: string,
    input: { btiYear: number; curriculumDisciplineId: string },
    context: CurriculumContext,
  ) {
    return this.mappingMutation('subject-curriculum-mapping.create', institutionId, subjectId, context, async (db, subject) => {
      if (!subject.isActive || !subject.institution.isActive) throw new AppError(409, 'RESOURCE_INACTIVE', 'El recurso está inactivo');
      if ((await db.curriculumDiscipline.count({ where: { id: input.curriculumDisciplineId } })) === 0) throw invalidReference();
      try {
        const created = await db.subjectCurriculumMapping.create({
          data: { ...input, subjectId, createdById: context.actorUserId, updatedById: context.actorUserId },
          select: mappingProjection,
        });
        await this.audit(db, context, 'subject-curriculum-mapping.create', 'SubjectCurriculumMapping', created.id, undefined, { subjectId, btiYear: created.btiYear, curriculumDisciplineId: created.curriculumDisciplineId }, institutionId);
        return this.mappingView(created);
      } catch (error) {
        if (this.isUnique(error)) throw new AppError(409, 'CURRENT_MAPPING_EXISTS', 'Ya existe una correspondencia vigente');
        throw error;
      }
    });
  }

  retireMapping(
    institutionId: string,
    subjectId: string,
    mappingId: string,
    input: { expectedVersion: number },
    context: CurriculumContext,
  ) {
    return this.mappingMutation('subject-curriculum-mapping.retire', institutionId, subjectId, context, async (db) => {
      const current = await db.subjectCurriculumMapping.findUnique({ where: { id: mappingId }, select: mappingProjection });
      if (current === null || current.subjectId !== subjectId) throw notFound();
      if (current.rowVersion !== input.expectedVersion) throw new AppError(409, 'STALE_VERSION', 'La versión cambió');
      if (current.retiredAt !== null) return this.mappingView(current);
      const updated = await db.subjectCurriculumMapping.update({ where: { id: mappingId }, data: { retiredAt: new Date(), updatedById: context.actorUserId, rowVersion: { increment: 1 } }, select: mappingProjection });
      await this.audit(db, context, 'subject-curriculum-mapping.retire', 'SubjectCurriculumMapping', mappingId, undefined, { subjectId, btiYear: updated.btiYear, retiredAt: updated.retiredAt?.toISOString() }, institutionId);
      return this.mappingView(updated);
    });
  }

  replaceMapping(
    institutionId: string,
    subjectId: string,
    mappingId: string,
    input: { curriculumDisciplineId: string; expectedVersion: number },
    context: CurriculumContext,
  ) {
    return this.mappingMutation('subject-curriculum-mapping.replace', institutionId, subjectId, context, async (db, subject) => {
      if (!subject.isActive || !subject.institution.isActive) throw new AppError(409, 'RESOURCE_INACTIVE', 'El recurso está inactivo');
      const current = await db.subjectCurriculumMapping.findUnique({ where: { id: mappingId }, select: mappingProjection });
      if (current === null || current.subjectId !== subjectId) throw notFound();
      if (current.retiredAt !== null) throw new AppError(409, 'MAPPING_RETIRED', 'La correspondencia ya fue retirada');
      if (current.rowVersion !== input.expectedVersion) throw new AppError(409, 'STALE_VERSION', 'La versión cambió');
      if (current.curriculumDisciplineId === input.curriculumDisciplineId) throw new AppError(422, 'NO_CHANGE', 'La sustitución no introduce cambios');
      if ((await db.curriculumDiscipline.count({ where: { id: input.curriculumDisciplineId } })) === 0) throw invalidReference();
      const retired = await db.subjectCurriculumMapping.update({ where: { id: mappingId }, data: { retiredAt: new Date(), updatedById: context.actorUserId, rowVersion: { increment: 1 } }, select: mappingProjection });
      try {
        const replacement = await db.subjectCurriculumMapping.create({ data: { subjectId, btiYear: current.btiYear, curriculumDisciplineId: input.curriculumDisciplineId, createdById: context.actorUserId, updatedById: context.actorUserId }, select: mappingProjection });
        await this.audit(db, context, 'subject-curriculum-mapping.replace', 'SubjectCurriculumMapping', replacement.id, undefined, { subjectId, btiYear: replacement.btiYear, retiredMappingId: retired.id, curriculumDisciplineId: replacement.curriculumDisciplineId }, institutionId);
        return { retiredMapping: this.mappingView(retired), currentMapping: this.mappingView(replacement) };
      } catch (error) {
        if (this.isUnique(error)) throw new AppError(409, 'CURRENT_MAPPING_EXISTS', 'Ya existe una correspondencia vigente');
        throw error;
      }
    });
  }

  private async requireCatalogRead(institutionId: string, context: CurriculumContext) {
    const institution = await this.client.institution.findUnique({ where: { id: institutionId }, select: { id: true } });
    if (institution === null) throw denied();
    const authorization = new AuthorizationService(this.client);
    if (!(await authorization.hasEffectiveGrantInInstitution(context.actorUserId, 'curriculum-catalog.read', institutionId))) throw denied();
    const teacher = await this.client.teacher.findUnique({
      where: { userId: context.actorUserId },
      select: {
        id: true,
        isActive: true,
        institutions: { where: { institutionId, endedAt: null }, select: { id: true } },
      },
    });
    if (teacher !== null) {
      const assignments = teacher.isActive && teacher.institutions.length > 0
        ? await this.client.teachingAssignment.count({
            where: { teacherId: teacher.id, institutionId, endedAt: null },
          })
        : 0;
      if (assignments === 0) throw denied();
    }
  }

  private async requireTechnicalManage(context: CurriculumContext) {
    if (context.accountKind !== AccountKind.TECHNICAL) throw denied();
    if (!(await new AuthorizationService(this.client).hasEffectiveTechnicalRootGrant(context.actorUserId, 'curriculum-catalog.manage'))) throw denied();
  }

  private async technicalMutation<T>(
    action: string,
    entityType: string,
    reason: string,
    context: CurriculumContext,
    work: (database: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      await this.requireTechnicalManage(context);
      return await this.serializable(work);
    } catch (error) {
      if (error instanceof AppError) await this.deniedAudit(context, action, entityType, error.message, reason);
      throw error;
    }
  }

  private async mappingMutation<T>(
    action: string,
    institutionId: string,
    subjectId: string,
    context: CurriculumContext,
    work: (database: Prisma.TransactionClient, subject: { isActive: boolean; institution: { isActive: boolean } }) => Promise<T>,
  ): Promise<T> {
    try {
      await this.subjectAtInstitution(this.client, institutionId, subjectId);
      const authorization = new AuthorizationService(this.client);
      if (!(await authorization.isAuthorized(context.actorUserId, 'subject-curriculum-mapping.manage', { institutionId }))) {
        const [hasInInstitution, hasAnywhere] = await Promise.all([
          authorization.hasEffectiveGrantInInstitution(context.actorUserId, 'subject-curriculum-mapping.manage', institutionId),
          authorization.hasAnyEffectiveGrant(context.actorUserId, 'subject-curriculum-mapping.manage'),
        ]);
        if (!hasInInstitution && hasAnywhere) throw notFound();
        throw denied();
      }
      return await this.serializable(async (db) =>
        work(db, await this.subjectAtInstitution(db, institutionId, subjectId)),
      );
    } catch (error) {
      if (error instanceof AppError) await this.deniedAudit(context, action, 'SubjectCurriculumMapping', error.message, undefined, institutionId, { subjectId });
      throw error;
    }
  }

  private async requireMappingRead(
    institutionId: string,
    subjectId: string,
    courseId: string | undefined,
    requestedYear: number | undefined,
    context: CurriculumContext,
  ): Promise<number | undefined> {
    await this.subjectAtInstitution(this.client, institutionId, subjectId);
    const authorization = new AuthorizationService(this.client);
    if (courseId === undefined) {
      if (!(await authorization.isAuthorized(context.actorUserId, 'subject-curriculum-mapping.read', { institutionId }))) {
        const [hasInInstitution, hasAnywhere] = await Promise.all([
          authorization.hasEffectiveGrantInInstitution(context.actorUserId, 'subject-curriculum-mapping.read', institutionId),
          authorization.hasAnyEffectiveGrant(context.actorUserId, 'subject-curriculum-mapping.read'),
        ]);
        if (!hasInInstitution && hasAnywhere) throw notFound();
        throw denied();
      }
      return requestedYear;
    }
    const course = await this.client.course.findUnique({ where: { id: courseId }, select: { institutionId: true, btiYear: true } });
    if (course === null || course.institutionId !== institutionId) throw notFound();
    if (course.btiYear === null) throw new AppError(400, 'VALIDATION_ERROR', 'El curso no tiene contexto BTI');
    if (requestedYear !== undefined && requestedYear !== course.btiYear) throw new AppError(400, 'VALIDATION_ERROR', 'El año BTI no coincide con el curso');
    const subjectInCourse = await this.client.teachingAssignment.count({ where: { courseId, subjectId, endedAt: null } });
    if (subjectInCourse === 0) throw notFound();
    if (!(await authorization.isAuthorized(context.actorUserId, 'subject-curriculum-mapping.read', { institutionId, courseId }))) {
      const [hasInInstitution, hasAnywhere] = await Promise.all([
        authorization.hasEffectiveGrantInInstitution(context.actorUserId, 'subject-curriculum-mapping.read', institutionId),
        authorization.hasAnyEffectiveGrant(context.actorUserId, 'subject-curriculum-mapping.read'),
      ]);
      if (!hasInInstitution && hasAnywhere) throw notFound();
      throw denied();
    }
    const teacher = await this.client.teacher.findUnique({
      where: { userId: context.actorUserId },
      select: {
        id: true,
        isActive: true,
        institutions: { where: { institutionId, endedAt: null }, select: { id: true } },
      },
    });
    if (teacher !== null) {
      const own = teacher.isActive && teacher.institutions.length > 0
        ? await this.client.teachingAssignment.count({ where: { teacherId: teacher.id, institutionId, courseId, subjectId, endedAt: null } })
        : 0;
      if (own === 0) throw denied();
    }
    return course.btiYear;
  }

  private async subjectAtInstitution(database: Database, institutionId: string, subjectId: string) {
    const subject = await database.subject.findUnique({ where: { id: subjectId }, select: { institutionId: true, isActive: true, institution: { select: { isActive: true } } } });
    if (subject === null || subject.institutionId !== institutionId) throw notFound();
    return subject;
  }

  private async validateArea(database: Database, planTypeId: string, academicAreaId: string | null) {
    if ((await database.planType.count({ where: { id: planTypeId } })) === 0) throw invalidReference();
    if (academicAreaId === null) return;
    const area = await database.academicArea.findUnique({ where: { id: academicAreaId }, select: { planTypeId: true } });
    if (area === null) throw invalidReference();
    if (area.planTypeId !== planTypeId) throw new AppError(422, 'AREA_PLAN_MISMATCH', 'El área pertenece a otro tipo de plan');
  }

  private page<T extends { id: string }>(rows: T[], limit: number, context: unknown) {
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    return { data, nextCursor: hasMore ? encodeCursor(data[data.length - 1]!.id, context) : null };
  }

  private mappingView(row: MappingRecord) {
    return {
      id: row.id,
      subjectId: row.subjectId,
      btiYear: row.btiYear,
      curriculumDisciplineId: row.curriculumDisciplineId,
      discipline: {
        officialName: row.curriculumDiscipline.officialName,
        planType: row.curriculumDiscipline.planType,
        academicArea: row.curriculumDiscipline.academicArea,
      },
      retiredAt: row.retiredAt,
      rowVersion: row.rowVersion,
    };
  }

  private async serializable<T>(work: (database: Prisma.TransactionClient) => Promise<T>) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.client.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error;
        if (attempt === 3) throw new AppError(409, 'CONCURRENT_MODIFICATION', 'Modificación concurrente');
      }
    }
    throw new AppError(409, 'CONCURRENT_MODIFICATION', 'Modificación concurrente');
  }

  private async throwMissingOrStale(database: Database, model: 'planType' | 'academicArea', id: string): Promise<never> {
    const count = model === 'planType'
      ? await database.planType.count({ where: { id } })
      : await database.academicArea.count({ where: { id } });
    if (count === 0) throw notFound();
    throw new AppError(409, 'STALE_VERSION', 'La versión cambió');
  }

  private isUnique(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private rethrowUnique(error: unknown): never {
    if (this.isUnique(error)) throw new AppError(409, 'DUPLICATE_CODE', 'El código ya existe');
    throw error;
  }

  private audit(
    database: Database,
    context: CurriculumContext,
    action: string,
    entityType: string,
    entityId: string,
    reason: string | undefined,
    afterData: Prisma.InputJsonObject,
    institutionId?: string,
  ) {
    return database.auditLog.create({
      data: {
        actorUserId: context.actorUserId,
        actorKind: context.accountKind === AccountKind.TECHNICAL ? AuditActorKind.TECHNICAL : AuditActorKind.USER,
        action,
        entityType,
        entityId,
        institutionId,
        outcome: AuditOutcome.SUCCESS,
        requestId: context.requestId,
        reason,
        afterData,
      },
    });
  }

  private deniedAudit(
    context: CurriculumContext,
    action: string,
    entityType: string,
    reason: string,
    technicalReason?: string,
    institutionId?: string,
    details?: Prisma.InputJsonObject,
  ) {
    return this.client.auditLog.create({
      data: {
        actorUserId: context.actorUserId,
        actorKind: context.accountKind === AccountKind.TECHNICAL ? AuditActorKind.TECHNICAL : AuditActorKind.USER,
        action,
        entityType,
        institutionId,
        outcome: AuditOutcome.DENIED,
        requestId: context.requestId,
        reason,
        details: { ...(details ?? {}), ...(technicalReason === undefined ? {} : { technicalReason }) },
      },
    });
  }
}
