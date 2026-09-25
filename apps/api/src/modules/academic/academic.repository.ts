import {
  Prisma,
  type AccountKind,
  type AuditActorKind,
  type AuditOutcome,
  type CurriculumDiscipline,
  type PrismaClient,
} from '@prisma/client';

type AcademicDatabase = PrismaClient | Prisma.TransactionClient;

export interface AuditRecord {
  actorUserId: string;
  actorKind: AuditActorKind;
  action: string;
  entityType: string;
  entityId?: string;
  institutionId?: string;
  outcome: AuditOutcome;
  requestId: string;
  reason?: string;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  details?: Prisma.InputJsonValue;
}

const institutionSelect = {
  id: true,
  name: true,
  isActive: true,
  disabledAt: true,
  createdAt: true,
  updatedAt: true,
  rowVersion: true,
} as const;

const teacherSelect = {
  id: true,
  userId: true,
  displayName: true,
  isActive: true,
  disabledAt: true,
  createdAt: true,
  updatedAt: true,
  rowVersion: true,
  user: { select: { id: true, login: true, isActive: true } },
  institutions: {
    select: { id: true, institutionId: true, endedAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

const academicYearSelect = {
  id: true,
  institutionId: true,
  label: true,
  startsOn: true,
  endsOn: true,
  isCurrent: true,
  createdAt: true,
  updatedAt: true,
  rowVersion: true,
} as const;

const courseSelect = {
  id: true,
  institutionId: true,
  academicYearId: true,
  grade: true,
  section: true,
  shift: true,
  isActive: true,
  disabledAt: true,
  createdAt: true,
  updatedAt: true,
  rowVersion: true,
  academicYear: { select: academicYearSelect },
} as const;

const subjectSelect = {
  id: true,
  institutionId: true,
  name: true,
  curriculumDiscipline: true,
  isActive: true,
  disabledAt: true,
  createdAt: true,
  updatedAt: true,
  rowVersion: true,
} as const;

const assignmentSelect = {
  id: true,
  teacherId: true,
  institutionId: true,
  courseId: true,
  subjectId: true,
  endedAt: true,
  createdAt: true,
  updatedAt: true,
  rowVersion: true,
  teacher: { select: { id: true, displayName: true, userId: true, isActive: true } },
  institution: { select: { id: true, name: true, isActive: true } },
  course: { select: courseSelect },
  subject: { select: subjectSelect },
} as const;

export class AcademicRepository {
  constructor(private readonly database: AcademicDatabase) {}

  authorizationStore() {
    return this.database;
  }

  async transaction<T>(work: (repository: AcademicRepository) => Promise<T>): Promise<T> {
    if (!('$transaction' in this.database)) return work(this);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.database.$transaction(
          (transaction) => work(new AcademicRepository(transaction)),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034' ||
          attempt === 3
        ) {
          throw error;
        }
      }
    }
    throw new Error('No se pudo completar la transacción serializable');
  }

  findActor(id: string) {
    return this.database.user.findUnique({
      where: { id },
      select: { id: true, accountKind: true, isActive: true },
    });
  }

  findUserForTeacher(id: string) {
    return this.database.user.findUnique({
      where: { id },
      select: { id: true, login: true, isActive: true, teacher: { select: { id: true } } },
    });
  }

  findUserByNormalizedLogin(loginNormalized: string) {
    return this.database.user.findUnique({
      where: { loginNormalized },
      select: { id: true },
    });
  }

  createStandardUser(data: { login: string; loginNormalized: string; passwordHash: string }) {
    return this.database.user.create({
      data: { ...data, accountKind: 'STANDARD' },
      select: { id: true, login: true, isActive: true },
    });
  }

  findInstitution(id: string) {
    return this.database.institution.findUnique({ where: { id }, select: institutionSelect });
  }

  listInstitutions() {
    return this.database.institution.findMany({ select: institutionSelect, orderBy: { name: 'asc' } });
  }

  createInstitution(name: string) {
    return this.database.institution.create({ data: { name }, select: institutionSelect });
  }

  updateInstitution(id: string, data: Prisma.InstitutionUpdateInput) {
    return this.database.institution.update({ where: { id }, data, select: institutionSelect });
  }

  findTeacher(id: string) {
    return this.database.teacher.findUnique({ where: { id }, select: teacherSelect });
  }

  listTeachers(institutionId: string) {
    return this.database.teacher.findMany({
      where: { institutions: { some: { institutionId } } },
      select: teacherSelect,
      orderBy: { displayName: 'asc' },
    });
  }

  createTeacher(userId: string, displayName: string, institutionId: string) {
    return this.database.teacher.create({
      data: {
        userId,
        displayName,
        institutions: { create: { institutionId } },
      },
      select: teacherSelect,
    });
  }

  updateTeacher(id: string, data: Prisma.TeacherUpdateInput) {
    return this.database.teacher.update({ where: { id }, data, select: teacherSelect });
  }

  findTeacherInstitution(teacherId: string, institutionId: string) {
    return this.database.teacherInstitution.findUnique({
      where: { teacherId_institutionId: { teacherId, institutionId } },
    });
  }

  createTeacherInstitution(teacherId: string, institutionId: string) {
    return this.database.teacherInstitution.create({ data: { teacherId, institutionId } });
  }

  updateTeacherInstitution(id: string, endedAt: Date | null) {
    return this.database.teacherInstitution.update({
      where: { id },
      data: { endedAt, rowVersion: { increment: 1 } },
    });
  }

  findAcademicYear(id: string) {
    return this.database.academicYear.findUnique({ where: { id }, select: academicYearSelect });
  }

  listAcademicYears(institutionId: string) {
    return this.database.academicYear.findMany({
      where: { institutionId },
      select: academicYearSelect,
      orderBy: [{ startsOn: 'desc' }, { label: 'asc' }],
    });
  }

  findCurrentAcademicYear(institutionId: string) {
    return this.database.academicYear.findFirst({
      where: { institutionId, isCurrent: true },
      select: academicYearSelect,
    });
  }

  createAcademicYear(data: {
    institutionId: string;
    label: string;
    startsOn: Date;
    endsOn: Date;
    isCurrent: boolean;
  }) {
    return this.database.academicYear.create({ data, select: academicYearSelect });
  }

  updateAcademicYear(id: string, data: Prisma.AcademicYearUpdateInput) {
    return this.database.academicYear.update({ where: { id }, data, select: academicYearSelect });
  }

  countCoursesForAcademicYear(id: string) {
    return this.database.course.count({ where: { academicYearId: id } });
  }

  findCourse(id: string) {
    return this.database.course.findUnique({ where: { id }, select: courseSelect });
  }

  listCourses(institutionId: string) {
    return this.database.course.findMany({
      where: { institutionId },
      select: courseSelect,
      orderBy: [{ academicYear: { startsOn: 'desc' } }, { grade: 'asc' }, { section: 'asc' }],
    });
  }

  createCourse(data: {
    institutionId: string;
    academicYearId: string;
    grade: string;
    section: string;
    shift: string;
  }) {
    return this.database.course.create({ data, select: courseSelect });
  }

  updateCourse(id: string, data: Prisma.CourseUpdateInput) {
    return this.database.course.update({ where: { id }, data, select: courseSelect });
  }

  countAssignmentsForCourse(id: string) {
    return this.database.teachingAssignment.count({ where: { courseId: id } });
  }

  findSubject(id: string) {
    return this.database.subject.findUnique({ where: { id }, select: subjectSelect });
  }

  listSubjects(institutionId: string) {
    return this.database.subject.findMany({
      where: { institutionId },
      select: subjectSelect,
      orderBy: { name: 'asc' },
    });
  }

  createSubject(data: {
    institutionId: string;
    name: string;
    nameNormalized: string;
    curriculumDiscipline?: CurriculumDiscipline | null;
  }) {
    return this.database.subject.create({ data, select: subjectSelect });
  }

  updateSubject(id: string, data: Prisma.SubjectUpdateInput) {
    return this.database.subject.update({ where: { id }, data, select: subjectSelect });
  }

  findTeachingAssignment(id: string) {
    return this.database.teachingAssignment.findUnique({
      where: { id },
      select: assignmentSelect,
    });
  }

  listTeachingAssignments(filters: {
    institutionId?: string;
    teacherId?: string;
    courseId?: string;
    activeOnly?: boolean;
  }) {
    return this.database.teachingAssignment.findMany({
      where: {
        institutionId: filters.institutionId,
        teacherId: filters.teacherId,
        courseId: filters.courseId,
        endedAt: filters.activeOnly === true ? null : undefined,
      },
      select: assignmentSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  createTeachingAssignment(data: {
    institutionId: string;
    teacherId: string;
    courseId: string;
    subjectId: string;
  }) {
    return this.database.teachingAssignment.create({ data, select: assignmentSelect });
  }

  updateTeachingAssignment(id: string, endedAt: Date | null) {
    return this.database.teachingAssignment.update({
      where: { id },
      data: { endedAt, rowVersion: { increment: 1 } },
      select: assignmentSelect,
    });
  }

  appendAudit(record: AuditRecord) {
    return this.database.auditLog.create({ data: record });
  }

  accountKind(id: string): Promise<AccountKind | null> {
    return this.database.user
      .findUnique({ where: { id }, select: { accountKind: true } })
      .then((user) => user?.accountKind ?? null);
  }
}
