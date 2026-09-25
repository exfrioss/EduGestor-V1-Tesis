export interface OperationContext {
  actorUserId: string;
  requestId: string;
  accountKind: 'STANDARD' | 'TECHNICAL';
}

export interface CreateInstitutionInput {
  name: string;
  technicalReason?: string;
}

export interface UpdateInstitutionInput {
  name: string;
}

export interface CreateTeacherInput {
  institutionId: string;
  displayName: string;
  account:
    | { kind: 'NEW'; login: string; password: string }
    | { kind: 'EXISTING'; userId: string };
}

export interface UpdateTeacherInput {
  displayName: string;
}

export interface CreateAcademicYearInput {
  institutionId: string;
  label: string;
  startsOn: Date;
  endsOn: Date;
  isCurrent: boolean;
}

export interface UpdateAcademicYearInput {
  label?: string;
  startsOn?: Date;
  endsOn?: Date;
  isCurrent?: boolean;
}

export interface CreateCourseInput {
  institutionId: string;
  academicYearId: string;
  grade: string;
  section: string;
  shift: string;
  btiYear?: number | null;
}

export interface UpdateCourseInput {
  academicYearId?: string;
  grade?: string;
  section?: string;
  shift?: string;
  btiYear?: number | null;
}

export interface CreateSubjectInput {
  institutionId: string;
  name: string;
}

export interface UpdateSubjectInput {
  name?: string;
}

export interface CreateTeachingAssignmentInput {
  institutionId: string;
  teacherId: string;
  courseId: string;
  subjectId: string;
}
