-- Course_academic_year_institution_fkey already exists in the initial migration.
CREATE TABLE "Student" (
  "id" UUID NOT NULL,
  "givenNames" TEXT NOT NULL,
  "familyNames" TEXT NOT NULL,
  "nationalId" TEXT,
  "nationalIdNormalized" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "disabledAt" TIMESTAMPTZ(3),
  "disabledById" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "Student_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Student_nationalId_pair_check" CHECK (
    ("nationalId" IS NULL AND "nationalIdNormalized" IS NULL) OR
    ("nationalId" IS NOT NULL AND "nationalIdNormalized" IS NOT NULL)
  ),
  CONSTRAINT "Student_active_state_check" CHECK (
    ("isActive" AND "disabledAt" IS NULL) OR
    (NOT "isActive" AND "disabledAt" IS NOT NULL)
  ),
  CONSTRAINT "Student_disabledById_fkey" FOREIGN KEY ("disabledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Student_nationalIdNormalized_key" ON "Student"("nationalIdNormalized");
CREATE INDEX "Student_familyNames_givenNames_idx" ON "Student"("familyNames", "givenNames");
CREATE INDEX "Student_disabledById_idx" ON "Student"("disabledById");

CREATE TABLE "Enrollment" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "courseId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Enrollment_course_year_fkey" FOREIGN KEY ("courseId", "academicYearId") REFERENCES "Course"("id", "academicYearId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "Enrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Enrollment_studentId_courseId_academicYearId_key" ON "Enrollment"("studentId", "courseId", "academicYearId");
CREATE INDEX "Enrollment_courseId_academicYearId_idx" ON "Enrollment"("courseId", "academicYearId");
CREATE INDEX "Enrollment_studentId_academicYearId_idx" ON "Enrollment"("studentId", "academicYearId");

CREATE FUNCTION prevent_enrollment_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Enrollment is immutable' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Enrollment_immutable_trigger"
BEFORE UPDATE OR DELETE ON "Enrollment"
FOR EACH ROW EXECUTE FUNCTION prevent_enrollment_mutation();
