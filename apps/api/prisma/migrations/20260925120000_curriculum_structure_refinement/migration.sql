-- Course may identify a BTI year without inferring it from the free-text grade.
ALTER TABLE "Course" ADD COLUMN "btiYear" SMALLINT;

ALTER TABLE "Course"
  ADD CONSTRAINT "Course_btiYear_check"
  CHECK ("btiYear" IS NULL OR "btiYear" BETWEEN 1 AND 3);

-- Preserve the legacy optional enum as append-only migration evidence. It is
-- deliberately not converted to a current mapping because it did not identify
-- a BTI year and therefore cannot satisfy the approved mapping key.
INSERT INTO "AuditLog" (
  "id",
  "actorKind",
  "action",
  "entityType",
  "entityId",
  "institutionId",
  "outcome",
  "requestId",
  "details"
)
SELECT
  gen_random_uuid(),
  'PROCESS'::"AuditActorKind",
  'migration.subject.curriculum-reference-retired',
  'Subject',
  "id",
  "institutionId",
  'SUCCESS'::"AuditOutcome",
  gen_random_uuid(),
  jsonb_build_object(
    'legacyCurriculumDiscipline', "curriculumDiscipline"::text,
    'convertedToMapping', false,
    'reason', 'La referencia anterior no identificaba el año BTI requerido por el modelo aprobado'
  )
FROM "Subject"
WHERE "curriculumDiscipline" IS NOT NULL;

ALTER TABLE "Subject" DROP COLUMN "curriculumDiscipline";
DROP TYPE "CurriculumDiscipline";

CREATE TABLE "PlanType" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PlanType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AcademicArea" (
  "id" UUID NOT NULL,
  "planTypeId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "AcademicArea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CurriculumDiscipline" (
  "id" UUID NOT NULL,
  "planTypeId" UUID NOT NULL,
  "academicAreaId" UUID,
  "code" TEXT NOT NULL,
  "officialName" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "CurriculumDiscipline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubjectCurriculumMapping" (
  "id" UUID NOT NULL,
  "subjectId" UUID NOT NULL,
  "btiYear" SMALLINT NOT NULL,
  "curriculumDisciplineId" UUID NOT NULL,
  "retiredAt" TIMESTAMPTZ(3),
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "SubjectCurriculumMapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubjectCurriculumMapping_btiYear_check" CHECK ("btiYear" BETWEEN 1 AND 3)
);

CREATE UNIQUE INDEX "PlanType_code_key" ON "PlanType"("code");
CREATE UNIQUE INDEX "AcademicArea_planTypeId_code_key" ON "AcademicArea"("planTypeId", "code");
CREATE UNIQUE INDEX "AcademicArea_id_planTypeId_key" ON "AcademicArea"("id", "planTypeId");
CREATE UNIQUE INDEX "CurriculumDiscipline_planTypeId_code_key" ON "CurriculumDiscipline"("planTypeId", "code");
CREATE INDEX "CurriculumDiscipline_academicAreaId_planTypeId_idx" ON "CurriculumDiscipline"("academicAreaId", "planTypeId");
CREATE INDEX "SubjectCurriculumMapping_subjectId_btiYear_createdAt_idx" ON "SubjectCurriculumMapping"("subjectId", "btiYear", "createdAt");
CREATE INDEX "SubjectCurriculumMapping_curriculumDisciplineId_idx" ON "SubjectCurriculumMapping"("curriculumDisciplineId");
CREATE INDEX "SubjectCurriculumMapping_createdById_idx" ON "SubjectCurriculumMapping"("createdById");
CREATE INDEX "SubjectCurriculumMapping_updatedById_idx" ON "SubjectCurriculumMapping"("updatedById");
CREATE UNIQUE INDEX "SubjectCurriculumMapping_subjectId_btiYear_active_key"
  ON "SubjectCurriculumMapping"("subjectId", "btiYear")
  WHERE "retiredAt" IS NULL;

ALTER TABLE "AcademicArea"
  ADD CONSTRAINT "AcademicArea_planTypeId_fkey"
  FOREIGN KEY ("planTypeId") REFERENCES "PlanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CurriculumDiscipline"
  ADD CONSTRAINT "CurriculumDiscipline_planTypeId_fkey"
  FOREIGN KEY ("planTypeId") REFERENCES "PlanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The composite FK makes a cross-plan area impossible while still allowing
-- academicAreaId = NULL for a discipline that is classified only by plan.
ALTER TABLE "CurriculumDiscipline"
  ADD CONSTRAINT "CurriculumDiscipline_academicAreaId_planTypeId_fkey"
  FOREIGN KEY ("academicAreaId", "planTypeId")
  REFERENCES "AcademicArea"("id", "planTypeId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubjectCurriculumMapping"
  ADD CONSTRAINT "SubjectCurriculumMapping_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubjectCurriculumMapping"
  ADD CONSTRAINT "SubjectCurriculumMapping_curriculumDisciplineId_fkey"
  FOREIGN KEY ("curriculumDisciplineId") REFERENCES "CurriculumDiscipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubjectCurriculumMapping"
  ADD CONSTRAINT "SubjectCurriculumMapping_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubjectCurriculumMapping"
  ADD CONSTRAINT "SubjectCurriculumMapping_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
