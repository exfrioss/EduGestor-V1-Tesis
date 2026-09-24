-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('STANDARD', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "ScopeKind" AS ENUM ('INSTITUTION', 'COURSE_SET', 'RESOURCE_SET');

-- CreateEnum
CREATE TYPE "CurriculumDiscipline" AS ENUM ('MATEMATICA_APLICADA', 'ALGORITMICA');

-- CreateEnum
CREATE TYPE "AuditActorKind" AS ENUM ('USER', 'TECHNICAL', 'PROCESS');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'DENIED', 'FAILURE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "login" TEXT NOT NULL,
    "loginNormalized" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "accountKind" "AccountKind" NOT NULL DEFAULT 'STANDARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "lastSeenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessScope" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "kind" "ScopeKind" NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AccessScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopeCourse" (
    "id" UUID NOT NULL,
    "scopeId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScopeCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "scopeId" UUID NOT NULL,
    "grantedById" UUID NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "revokedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignmentPermission" (
    "id" UUID NOT NULL,
    "roleAssignmentId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "parentGrantId" UUID,
    "delegatedById" UUID NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RoleAssignmentPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMPTZ(3),
    "disabledById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMPTZ(3),
    "disabledById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherInstitution" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TeacherInstitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "grade" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "shift" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMPTZ(3),
    "disabledById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "curriculumDiscipline" "CurriculumDiscipline",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMPTZ(3),
    "disabledById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingAssignment" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" UUID,
    "actorKind" "AuditActorKind" NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "institutionId" UUID,
    "outcome" "AuditOutcome" NOT NULL,
    "requestId" UUID NOT NULL,
    "reason" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginNormalized_key" ON "User"("loginNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "AccessScope_institutionId_idx" ON "AccessScope"("institutionId");

-- CreateIndex
CREATE INDEX "AccessScope_createdById_idx" ON "AccessScope"("createdById");

-- CreateIndex
CREATE INDEX "ScopeCourse_courseId_idx" ON "ScopeCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ScopeCourse_scopeId_courseId_key" ON "ScopeCourse"("scopeId", "courseId");

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_revokedAt_idx" ON "RoleAssignment"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "RoleAssignment_scopeId_idx" ON "RoleAssignment"("scopeId");

-- CreateIndex
CREATE INDEX "RoleAssignment_grantedById_idx" ON "RoleAssignment"("grantedById");

-- CreateIndex
CREATE INDEX "RoleAssignmentPermission_parentGrantId_idx" ON "RoleAssignmentPermission"("parentGrantId");

-- CreateIndex
CREATE INDEX "RoleAssignmentPermission_permissionId_idx" ON "RoleAssignmentPermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAssignmentPermission_roleAssignmentId_permissionId_key" ON "RoleAssignmentPermission"("roleAssignmentId", "permissionId");

-- CreateIndex
CREATE INDEX "Institution_disabledById_idx" ON "Institution"("disabledById");

-- CreateIndex
CREATE INDEX "AcademicYear_institutionId_startsOn_idx" ON "AcademicYear"("institutionId", "startsOn");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_institutionId_label_key" ON "AcademicYear"("institutionId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_id_institutionId_key" ON "AcademicYear"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");

-- CreateIndex
CREATE INDEX "Teacher_disabledById_idx" ON "Teacher"("disabledById");

-- CreateIndex
CREATE INDEX "TeacherInstitution_institutionId_endedAt_idx" ON "TeacherInstitution"("institutionId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherInstitution_teacherId_institutionId_key" ON "TeacherInstitution"("teacherId", "institutionId");

-- CreateIndex
CREATE INDEX "Course_institutionId_isActive_idx" ON "Course"("institutionId", "isActive");

-- CreateIndex
CREATE INDEX "Course_academicYearId_idx" ON "Course"("academicYearId");

-- CreateIndex
CREATE INDEX "Course_disabledById_idx" ON "Course"("disabledById");

-- CreateIndex
CREATE UNIQUE INDEX "Course_institutionId_academicYearId_grade_section_shift_key" ON "Course"("institutionId", "academicYearId", "grade", "section", "shift");

-- CreateIndex
CREATE UNIQUE INDEX "Course_id_institutionId_key" ON "Course"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_id_academicYearId_key" ON "Course"("id", "academicYearId");

-- CreateIndex
CREATE INDEX "Subject_institutionId_isActive_idx" ON "Subject"("institutionId", "isActive");

-- CreateIndex
CREATE INDEX "Subject_disabledById_idx" ON "Subject"("disabledById");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_institutionId_nameNormalized_key" ON "Subject"("institutionId", "nameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_id_institutionId_key" ON "Subject"("id", "institutionId");

-- CreateIndex
CREATE INDEX "TeachingAssignment_teacherId_endedAt_idx" ON "TeachingAssignment"("teacherId", "endedAt");

-- CreateIndex
CREATE INDEX "TeachingAssignment_courseId_subjectId_idx" ON "TeachingAssignment"("courseId", "subjectId");

-- CreateIndex
CREATE INDEX "TeachingAssignment_institutionId_idx" ON "TeachingAssignment"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssignment_teacherId_courseId_subjectId_key" ON "TeachingAssignment"("teacherId", "courseId", "subjectId");

-- CreateIndex
CREATE INDEX "AuditLog_institutionId_occurredAt_idx" ON "AuditLog"("institutionId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_occurredAt_idx" ON "AuditLog"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_occurredAt_idx" ON "AuditLog"("entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessScope" ADD CONSTRAINT "AccessScope_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessScope" ADD CONSTRAINT "AccessScope_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeCourse" ADD CONSTRAINT "ScopeCourse_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "AccessScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeCourse" ADD CONSTRAINT "ScopeCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "AccessScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignmentPermission" ADD CONSTRAINT "RoleAssignmentPermission_roleAssignmentId_fkey" FOREIGN KEY ("roleAssignmentId") REFERENCES "RoleAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignmentPermission" ADD CONSTRAINT "RoleAssignmentPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignmentPermission" ADD CONSTRAINT "RoleAssignmentPermission_parentGrantId_fkey" FOREIGN KEY ("parentGrantId") REFERENCES "RoleAssignmentPermission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignmentPermission" ADD CONSTRAINT "RoleAssignmentPermission_delegatedById_fkey" FOREIGN KEY ("delegatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_disabledById_fkey" FOREIGN KEY ("disabledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_disabledById_fkey" FOREIGN KEY ("disabledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInstitution" ADD CONSTRAINT "TeacherInstitution_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInstitution" ADD CONSTRAINT "TeacherInstitution_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_disabledById_fkey" FOREIGN KEY ("disabledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_disabledById_fkey" FOREIGN KEY ("disabledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricciones normativas que Prisma no puede representar directamente.

ALTER TABLE "AcademicYear"
  ADD CONSTRAINT "AcademicYear_dates_check" CHECK ("startsOn" <= "endsOn");

CREATE UNIQUE INDEX "AcademicYear_one_current_per_institution_key"
  ON "AcademicYear"("institutionId") WHERE "isCurrent" = true;

CREATE UNIQUE INDEX "RoleAssignment_one_active_grant_key"
  ON "RoleAssignment"("userId", "roleId", "scopeId") WHERE "revokedAt" IS NULL;

ALTER TABLE "AccessScope"
  ADD CONSTRAINT "AccessScope_resource_set_deferred_check" CHECK ("kind" <> 'RESOURCE_SET');

ALTER TABLE "RoleAssignment"
  ADD CONSTRAINT "RoleAssignment_revocation_actor_check"
  CHECK (("revokedAt" IS NULL AND "revokedById" IS NULL) OR "revokedAt" IS NOT NULL);

ALTER TABLE "RoleAssignmentPermission"
  ADD CONSTRAINT "RoleAssignmentPermission_not_own_parent_check"
  CHECK ("parentGrantId" IS NULL OR "parentGrantId" <> "id");

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_technical_reason_check"
  CHECK ("actorKind" <> 'TECHNICAL' OR NULLIF(BTRIM("reason"), '') IS NOT NULL);

ALTER TABLE "User"
  ADD CONSTRAINT "User_active_state_check"
  CHECK (("isActive" AND "disabledAt" IS NULL) OR (NOT "isActive" AND "disabledAt" IS NOT NULL));

ALTER TABLE "Institution"
  ADD CONSTRAINT "Institution_active_state_check"
  CHECK (("isActive" AND "disabledAt" IS NULL) OR (NOT "isActive" AND "disabledAt" IS NOT NULL));

ALTER TABLE "Teacher"
  ADD CONSTRAINT "Teacher_active_state_check"
  CHECK (("isActive" AND "disabledAt" IS NULL) OR (NOT "isActive" AND "disabledAt" IS NOT NULL));

ALTER TABLE "Course"
  ADD CONSTRAINT "Course_active_state_check"
  CHECK (("isActive" AND "disabledAt" IS NULL) OR (NOT "isActive" AND "disabledAt" IS NOT NULL));

ALTER TABLE "Subject"
  ADD CONSTRAINT "Subject_active_state_check"
  CHECK (("isActive" AND "disabledAt" IS NULL) OR (NOT "isActive" AND "disabledAt" IS NOT NULL));

ALTER TABLE "Course"
  ADD CONSTRAINT "Course_academic_year_institution_fkey"
  FOREIGN KEY ("academicYearId", "institutionId")
  REFERENCES "AcademicYear"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeachingAssignment"
  ADD CONSTRAINT "TeachingAssignment_teacher_institution_fkey"
  FOREIGN KEY ("teacherId", "institutionId")
  REFERENCES "TeacherInstitution"("teacherId", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TeachingAssignment_course_institution_fkey"
  FOREIGN KEY ("courseId", "institutionId")
  REFERENCES "Course"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TeachingAssignment_subject_institution_fkey"
  FOREIGN KEY ("subjectId", "institutionId")
  REFERENCES "Subject"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION validate_scope_course_context()
RETURNS trigger AS $$
DECLARE
  scope_kind "ScopeKind";
  scope_institution UUID;
  course_institution UUID;
BEGIN
  SELECT "kind", "institutionId" INTO scope_kind, scope_institution
    FROM "AccessScope" WHERE "id" = NEW."scopeId";
  SELECT "institutionId" INTO course_institution
    FROM "Course" WHERE "id" = NEW."courseId";

  IF scope_kind <> 'COURSE_SET' THEN
    RAISE EXCEPTION 'ScopeCourse solo admite ámbitos COURSE_SET' USING ERRCODE = '23514';
  END IF;
  IF scope_institution IS DISTINCT FROM course_institution THEN
    RAISE EXCEPTION 'El curso y el ámbito deben pertenecer a la misma institución' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ScopeCourse_context_trigger"
BEFORE INSERT OR UPDATE ON "ScopeCourse"
FOR EACH ROW EXECUTE FUNCTION validate_scope_course_context();

CREATE OR REPLACE FUNCTION prevent_invalid_scope_change()
RETURNS trigger AS $$
BEGIN
  IF (OLD."kind", OLD."institutionId") IS DISTINCT FROM (NEW."kind", NEW."institutionId")
     AND (EXISTS (SELECT 1 FROM "ScopeCourse" WHERE "scopeId" = OLD."id")
       OR EXISTS (SELECT 1 FROM "RoleAssignment" WHERE "scopeId" = OLD."id")) THEN
    RAISE EXCEPTION 'No se puede cambiar un ámbito que ya está utilizado' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AccessScope_immutable_when_used_trigger"
BEFORE UPDATE ON "AccessScope"
FOR EACH ROW EXECUTE FUNCTION prevent_invalid_scope_change();

CREATE OR REPLACE FUNCTION validate_role_assignment_scope()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "AccessScope" scope
    WHERE scope."id" = NEW."scopeId"
      AND scope."kind" = 'COURSE_SET'
      AND NOT EXISTS (SELECT 1 FROM "ScopeCourse" course WHERE course."scopeId" = scope."id")
  ) THEN
    RAISE EXCEPTION 'Un ámbito COURSE_SET debe contener al menos un curso antes de concederse' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RoleAssignment_nonempty_scope_trigger"
BEFORE INSERT OR UPDATE OF "scopeId" ON "RoleAssignment"
FOR EACH ROW EXECUTE FUNCTION validate_role_assignment_scope();

CREATE OR REPLACE FUNCTION validate_permission_delegation_parent()
RETURNS trigger AS $$
DECLARE
  parent_permission UUID;
  parent_user UUID;
BEGIN
  IF NEW."parentGrantId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT parent."permissionId", assignment."userId"
    INTO parent_permission, parent_user
    FROM "RoleAssignmentPermission" parent
    JOIN "RoleAssignment" assignment ON assignment."id" = parent."roleAssignmentId"
    WHERE parent."id" = NEW."parentGrantId";

  IF parent_permission IS DISTINCT FROM NEW."permissionId" OR parent_user IS DISTINCT FROM NEW."delegatedById" THEN
    RAISE EXCEPTION 'La concesión padre debe pertenecer al delegante y conceder el mismo permiso' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RoleAssignmentPermission_parent_context_trigger"
BEFORE INSERT OR UPDATE ON "RoleAssignmentPermission"
FOR EACH ROW EXECUTE FUNCTION validate_permission_delegation_parent();

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog es append-only' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_append_only_trigger"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
