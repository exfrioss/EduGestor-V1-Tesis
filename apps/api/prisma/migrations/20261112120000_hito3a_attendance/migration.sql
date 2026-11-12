CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENTE', 'AUSENTE', 'LLEGADA_TARDIA', 'SALIDA_ANTICIPADA');

CREATE TABLE "AttendanceSession" (
  "id" UUID NOT NULL,
  "teachingAssignmentId" UUID NOT NULL,
  "classDate" DATE NOT NULL,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceSession_rowVersion_check" CHECK ("rowVersion" > 0),
  CONSTRAINT "AttendanceSession_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "AttendanceSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- A class may have multiple independent sessions on the same date.
CREATE INDEX "AttendanceSession_teachingAssignmentId_classDate_idx"
  ON "AttendanceSession"("teachingAssignmentId", "classDate");

CREATE TABLE "AttendanceRecord" (
  "id" UUID NOT NULL,
  "attendanceSessionId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "isJustified" BOOLEAN NOT NULL DEFAULT false,
  "justificationObservation" TEXT,
  "observation" TEXT,
  "recordedById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceRecord_justification_check" CHECK ("isJustified" OR "justificationObservation" IS NULL),
  CONSTRAINT "AttendanceRecord_rowVersion_check" CHECK ("rowVersion" > 0),
  CONSTRAINT "AttendanceRecord_attendanceSessionId_fkey" FOREIGN KEY ("attendanceSessionId") REFERENCES "AttendanceSession"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "AttendanceRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "AttendanceRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "AttendanceRecord_attendanceSessionId_enrollmentId_key"
  ON "AttendanceRecord"("attendanceSessionId", "enrollmentId");
CREATE INDEX "AttendanceRecord_enrollmentId_attendanceSessionId_idx"
  ON "AttendanceRecord"("enrollmentId", "attendanceSessionId");

CREATE FUNCTION prevent_attendance_session_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AttendanceSession cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF (NEW."teachingAssignmentId", NEW."classDate", NEW."createdById", NEW."createdAt")
     IS DISTINCT FROM (OLD."teachingAssignmentId", OLD."classDate", OLD."createdById", OLD."createdAt") THEN
    RAISE EXCEPTION 'AttendanceSession context is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AttendanceSession_immutable_trigger"
BEFORE UPDATE OR DELETE ON "AttendanceSession"
FOR EACH ROW EXECUTE FUNCTION prevent_attendance_session_mutation();

CREATE FUNCTION validate_attendance_record() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AttendanceRecord cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND
     (NEW."attendanceSessionId", NEW."enrollmentId", NEW."recordedById", NEW."createdAt")
     IS DISTINCT FROM
     (OLD."attendanceSessionId", OLD."enrollmentId", OLD."recordedById", OLD."createdAt") THEN
    RAISE EXCEPTION 'AttendanceRecord context and creator are immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "AttendanceSession" s
    JOIN "TeachingAssignment" a ON a."id" = s."teachingAssignmentId"
    JOIN "Course" c ON c."id" = a."courseId"
    JOIN "Enrollment" e ON e."id" = NEW."enrollmentId"
      AND e."courseId" = c."id" AND e."academicYearId" = c."academicYearId"
    WHERE s."id" = NEW."attendanceSessionId"
  ) THEN
    RAISE EXCEPTION 'AttendanceRecord enrollment context mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AttendanceRecord_context_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "AttendanceRecord"
FOR EACH ROW EXECUTE FUNCTION validate_attendance_record();

-- The pre-existing Course/AcademicYear and Enrollment/Course composite FKs
-- already protect their contexts. Preserve the assignment once sessions exist.
CREATE FUNCTION prevent_attendance_assignment_reinterpretation() RETURNS trigger AS $$
BEGIN
  IF (NEW."teacherId", NEW."institutionId", NEW."courseId", NEW."subjectId")
     IS DISTINCT FROM (OLD."teacherId", OLD."institutionId", OLD."courseId", OLD."subjectId")
     AND EXISTS (SELECT 1 FROM "AttendanceSession" WHERE "teachingAssignmentId" = OLD."id") THEN
    RAISE EXCEPTION 'Attendance assignment context is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "TeachingAssignment_attendance_context_trigger"
BEFORE UPDATE OF "teacherId", "institutionId", "courseId", "subjectId" ON "TeachingAssignment"
FOR EACH ROW EXECUTE FUNCTION prevent_attendance_assignment_reinterpretation();
