CREATE TABLE "GradingScale" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "minimumGrade" DECIMAL(18,6) NOT NULL,
    "maximumGrade" DECIMAL(18,6) NOT NULL,
    "conversionDefinition" JSONB NOT NULL,
    "roundingDefinition" JSONB NOT NULL,
    "lockedAt" TIMESTAMPTZ(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "GradingScale_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GradingScale_version_bounds_check" CHECK ("version" > 0 AND "minimumGrade" <= "maximumGrade")
);

CREATE UNIQUE INDEX "GradingScale_institutionId_name_version_key" ON "GradingScale"("institutionId", "name", "version");
CREATE UNIQUE INDEX "GradingScale_id_institutionId_key" ON "GradingScale"("id", "institutionId");
CREATE INDEX "GradingScale_institutionId_name_version_idx" ON "GradingScale"("institutionId", "name", "version");
ALTER TABLE "GradingScale" ADD CONSTRAINT "GradingScale_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradingScale" ADD CONSTRAINT "GradingScale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeachingAssignment" ADD COLUMN "gradingScaleId" UUID;
CREATE INDEX "TeachingAssignment_gradingScaleId_idx" ON "TeachingAssignment"("gradingScaleId");
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_gradingScaleId_institutionId_fkey" FOREIGN KEY ("gradingScaleId", "institutionId") REFERENCES "GradingScale"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_used_grading_scale_update() RETURNS trigger AS $$
BEGIN
  IF OLD."lockedAt" IS NOT NULL AND NEW."lockedAt" IS DISTINCT FROM OLD."lockedAt" THEN
    RAISE EXCEPTION 'Grading scale lock is permanent' USING ERRCODE = '23514';
  END IF;
  IF OLD."lockedAt" IS NOT NULL OR EXISTS (SELECT 1 FROM "TeachingAssignment" WHERE "gradingScaleId" = OLD."id") THEN
    IF (NEW."institutionId", NEW."name", NEW."version", NEW."minimumGrade", NEW."maximumGrade", NEW."conversionDefinition", NEW."roundingDefinition", NEW."createdById")
       IS DISTINCT FROM
       (OLD."institutionId", OLD."name", OLD."version", OLD."minimumGrade", OLD."maximumGrade", OLD."conversionDefinition", OLD."roundingDefinition", OLD."createdById") THEN
      RAISE EXCEPTION 'Used grading scale is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "GradingScale_immutable_when_used_trigger" BEFORE UPDATE ON "GradingScale"
FOR EACH ROW EXECUTE FUNCTION prevent_used_grading_scale_update();

CREATE FUNCTION lock_applied_grading_scale() RETURNS trigger AS $$
BEGIN
  IF NEW."gradingScaleId" IS NOT NULL THEN
    UPDATE "GradingScale" SET "lockedAt" = COALESCE("lockedAt", CURRENT_TIMESTAMP)
    WHERE "id" = NEW."gradingScaleId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "TeachingAssignment_lock_grading_scale_trigger" AFTER INSERT OR UPDATE OF "gradingScaleId" ON "TeachingAssignment"
FOR EACH ROW EXECUTE FUNCTION lock_applied_grading_scale();

-- 2B-1 blocked all maximum changes with results. In 2B-2 the confirmed API
-- marks only its current transaction and resource; scoring kind and context
-- remain protected independently of that mark.
CREATE OR REPLACE FUNCTION prevent_task_reinterpretation() RETURNS trigger AS $$
BEGIN
  IF NEW."teachingAssignmentId" IS DISTINCT FROM OLD."teachingAssignmentId" THEN
    RAISE EXCEPTION 'Task assignment is immutable' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM "Assessment" a JOIN "AssessmentResult" r ON r."assessmentId" = a."id" WHERE a."taskId" = OLD."id") THEN
    IF NEW."scoringKind" IS DISTINCT FROM OLD."scoringKind" THEN
      RAISE EXCEPTION 'Task scoring kind with results is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW."maxPoints" IS DISTINCT FROM OLD."maxPoints"
       AND current_setting('edugestor.confirmed_max_change', true) IS DISTINCT FROM OLD."id"::text THEN
      RAISE EXCEPTION 'Task maximum change requires confirmation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_assessment_reinterpretation() RETURNS trigger AS $$
BEGIN
  IF NEW."teachingAssignmentId" IS DISTINCT FROM OLD."teachingAssignmentId" THEN
    RAISE EXCEPTION 'Assessment assignment is immutable' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM "AssessmentResult" WHERE "assessmentId" = OLD."id") THEN
    IF (NEW."taskId", NEW."standaloneScoringKind") IS DISTINCT FROM (OLD."taskId", OLD."standaloneScoringKind") THEN
      RAISE EXCEPTION 'Assessment scoring context with results is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW."standaloneMaxPoints" IS DISTINCT FROM OLD."standaloneMaxPoints"
       AND current_setting('edugestor.confirmed_max_change', true) IS DISTINCT FROM OLD."id"::text THEN
      RAISE EXCEPTION 'Assessment maximum change requires confirmation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
