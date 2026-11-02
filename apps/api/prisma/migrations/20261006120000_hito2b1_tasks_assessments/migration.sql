-- CreateEnum
CREATE TYPE "ActivityBankKind" AS ENUM ('TASK', 'INSTRUMENT');

-- CreateEnum
CREATE TYPE "ScoringKind" AS ENUM ('ORDINARIA', 'FUERA_DE_ESCALA');

-- CreateEnum
CREATE TYPE "AssessmentResultStatus" AS ENUM ('PENDIENTE', 'EVALUADO');

-- CreateTable
CREATE TABLE "ActivityBankItem" (
    "id" UUID NOT NULL,
    "ownerTeacherId" UUID NOT NULL,
    "kind" "ActivityBankKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instrumentContent" TEXT,
    "scoringKind" "ScoringKind" NOT NULL,
    "suggestedMaxPoints" DECIMAL(12,4),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ActivityBankItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "teachingAssignmentId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "maxPoints" DECIMAL(12,4) NOT NULL,
    "scoringKind" "ScoringKind" NOT NULL,
    "sourceBankItemId" UUID,
    "sourceTaskId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" UUID NOT NULL,
    "teachingAssignmentId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskId" UUID,
    "sourceBankItemId" UUID,
    "sourceAssessmentId" UUID,
    "instrumentContent" TEXT,
    "standaloneMaxPoints" DECIMAL(12,4),
    "standaloneScoringKind" "ScoringKind",
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentResult" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "status" "AssessmentResultStatus" NOT NULL,
    "earnedPoints" DECIMAL(12,4),
    "evaluatedAt" TIMESTAMPTZ(3),
    "evaluatedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityBankItem_ownerTeacherId_kind_idx" ON "ActivityBankItem"("ownerTeacherId", "kind");

-- CreateIndex
CREATE INDEX "Task_teachingAssignmentId_createdAt_idx" ON "Task"("teachingAssignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_sourceBankItemId_idx" ON "Task"("sourceBankItemId");

-- CreateIndex
CREATE INDEX "Task_sourceTaskId_idx" ON "Task"("sourceTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_taskId_key" ON "Assessment"("taskId");

-- CreateIndex
CREATE INDEX "Assessment_teachingAssignmentId_createdAt_idx" ON "Assessment"("teachingAssignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "Assessment_sourceBankItemId_idx" ON "Assessment"("sourceBankItemId");

-- CreateIndex
CREATE INDEX "Assessment_sourceAssessmentId_idx" ON "Assessment"("sourceAssessmentId");

-- CreateIndex
CREATE INDEX "AssessmentResult_enrollmentId_assessmentId_idx" ON "AssessmentResult"("enrollmentId", "assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentResult_assessmentId_status_idx" ON "AssessmentResult"("assessmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentResult_assessmentId_enrollmentId_key" ON "AssessmentResult"("assessmentId", "enrollmentId");

-- AddForeignKey
ALTER TABLE "ActivityBankItem" ADD CONSTRAINT "ActivityBankItem_ownerTeacherId_fkey" FOREIGN KEY ("ownerTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_sourceBankItemId_fkey" FOREIGN KEY ("sourceBankItemId") REFERENCES "ActivityBankItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_sourceBankItemId_fkey" FOREIGN KEY ("sourceBankItemId") REFERENCES "ActivityBankItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_sourceAssessmentId_fkey" FOREIGN KEY ("sourceAssessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActivityBankItem" ADD CONSTRAINT "ActivityBankItem_suggestedMaxPoints_check"
  CHECK ("suggestedMaxPoints" IS NULL OR "suggestedMaxPoints" >= 0);
ALTER TABLE "Task" ADD CONSTRAINT "Task_maxPoints_check" CHECK ("maxPoints" >= 0);
ALTER TABLE "Task" ADD CONSTRAINT "Task_source_not_self_check"
  CHECK ("sourceTaskId" IS NULL OR "sourceTaskId" <> "id");
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_standalone_fields_check"
  CHECK (("taskId" IS NULL AND "standaloneMaxPoints" IS NOT NULL AND "standaloneMaxPoints" >= 0 AND "standaloneScoringKind" IS NOT NULL)
      OR ("taskId" IS NOT NULL AND "standaloneMaxPoints" IS NULL AND "standaloneScoringKind" IS NULL));
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_source_not_self_check"
  CHECK ("sourceAssessmentId" IS NULL OR "sourceAssessmentId" <> "id");
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_status_fields_check"
  CHECK (("status" = 'PENDIENTE' AND "earnedPoints" IS NULL AND "evaluatedAt" IS NULL AND "evaluatedById" IS NULL)
      OR ("status" = 'EVALUADO' AND "earnedPoints" IS NOT NULL AND "earnedPoints" >= 0 AND "evaluatedAt" IS NOT NULL AND "evaluatedById" IS NOT NULL));

CREATE FUNCTION validate_assessment_task_context() RETURNS trigger AS $$
BEGIN
  IF NEW."taskId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Task" t WHERE t."id" = NEW."taskId"
      AND t."teachingAssignmentId" = NEW."teachingAssignmentId"
  ) THEN
    RAISE EXCEPTION 'Assessment and Task assignment mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Assessment_task_context_trigger"
BEFORE INSERT OR UPDATE OF "taskId", "teachingAssignmentId" ON "Assessment"
FOR EACH ROW EXECUTE FUNCTION validate_assessment_task_context();

CREATE FUNCTION validate_assessment_result_context() RETURNS trigger AS $$
DECLARE
  effective_max DECIMAL(12,4);
BEGIN
  SELECT CASE WHEN a."taskId" IS NULL THEN a."standaloneMaxPoints" ELSE t."maxPoints" END
    INTO effective_max
    FROM "Assessment" a
    JOIN "TeachingAssignment" ta ON ta."id" = a."teachingAssignmentId"
    LEFT JOIN "Task" t ON t."id" = a."taskId"
    JOIN "Course" c ON c."id" = ta."courseId"
    JOIN "Enrollment" e ON e."id" = NEW."enrollmentId"
      AND e."courseId" = c."id" AND e."academicYearId" = c."academicYearId"
    WHERE a."id" = NEW."assessmentId";
  IF effective_max IS NULL THEN
    RAISE EXCEPTION 'AssessmentResult enrollment context mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW."status" = 'EVALUADO' AND NEW."earnedPoints" > effective_max THEN
    RAISE EXCEPTION 'AssessmentResult exceeds activity maximum' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AssessmentResult_context_trigger"
BEFORE INSERT OR UPDATE OF "assessmentId", "enrollmentId", "status", "earnedPoints" ON "AssessmentResult"
FOR EACH ROW EXECUTE FUNCTION validate_assessment_result_context();

CREATE FUNCTION prevent_task_reinterpretation() RETURNS trigger AS $$
BEGIN
  IF NEW."teachingAssignmentId" IS DISTINCT FROM OLD."teachingAssignmentId" THEN
    RAISE EXCEPTION 'Task assignment is immutable' USING ERRCODE = '23514';
  END IF;
  IF (NEW."maxPoints", NEW."scoringKind") IS DISTINCT FROM (OLD."maxPoints", OLD."scoringKind")
     AND EXISTS (SELECT 1 FROM "Assessment" a JOIN "AssessmentResult" r ON r."assessmentId" = a."id" WHERE a."taskId" = OLD."id") THEN
    RAISE EXCEPTION 'Task scoring with results is immutable in 2B-1' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Task_no_reinterpretation_trigger"
BEFORE UPDATE OF "teachingAssignmentId", "maxPoints", "scoringKind" ON "Task"
FOR EACH ROW EXECUTE FUNCTION prevent_task_reinterpretation();

CREATE FUNCTION prevent_assessment_reinterpretation() RETURNS trigger AS $$
BEGIN
  IF NEW."teachingAssignmentId" IS DISTINCT FROM OLD."teachingAssignmentId" THEN
    RAISE EXCEPTION 'Assessment assignment is immutable' USING ERRCODE = '23514';
  END IF;
  IF (NEW."taskId", NEW."standaloneMaxPoints", NEW."standaloneScoringKind")
     IS DISTINCT FROM (OLD."taskId", OLD."standaloneMaxPoints", OLD."standaloneScoringKind")
     AND EXISTS (SELECT 1 FROM "AssessmentResult" WHERE "assessmentId" = OLD."id") THEN
    RAISE EXCEPTION 'Assessment scoring with results is immutable in 2B-1' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Assessment_no_reinterpretation_trigger"
BEFORE UPDATE OF "teachingAssignmentId", "taskId", "standaloneMaxPoints", "standaloneScoringKind" ON "Assessment"
FOR EACH ROW EXECUTE FUNCTION prevent_assessment_reinterpretation();

CREATE FUNCTION prevent_result_reassignment() RETURNS trigger AS $$
BEGIN
  IF (NEW."assessmentId", NEW."enrollmentId") IS DISTINCT FROM (OLD."assessmentId", OLD."enrollmentId") THEN
    RAISE EXCEPTION 'AssessmentResult context is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AssessmentResult_immutable_context_trigger"
BEFORE UPDATE OF "assessmentId", "enrollmentId" ON "AssessmentResult"
FOR EACH ROW EXECUTE FUNCTION prevent_result_reassignment();

