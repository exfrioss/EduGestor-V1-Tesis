export type AccountKind = 'STANDARD' | 'TECHNICAL';

export interface SessionUser {
  id: string;
  login: string;
  accountKind: AccountKind;
  teacher: { id: string; displayName: string; isActive: boolean } | null;
}

export interface SessionResponse {
  user: SessionUser;
  session: { expiresAt: string };
}

export interface Institution {
  id: string;
  name: string;
  isActive: boolean;
  disabledAt: string | null;
  rowVersion: number;
}

export interface Teacher {
  id: string;
  userId: string;
  displayName: string;
  isActive: boolean;
  disabledAt: string | null;
  rowVersion: number;
  user: { id: string; login: string; isActive: boolean };
  institutions: Array<{ id: string; institutionId: string; endedAt: string | null }>;
}

export interface AcademicYear {
  id: string;
  institutionId: string;
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  rowVersion: number;
}

export interface Course {
  id: string;
  institutionId: string;
  academicYearId: string;
  grade: string;
  section: string;
  shift: string;
  btiYear: number | null;
  isActive: boolean;
  disabledAt: string | null;
  rowVersion: number;
  academicYear: AcademicYear;
}

export interface Subject {
  id: string;
  institutionId: string;
  name: string;
  isActive: boolean;
  disabledAt: string | null;
  rowVersion: number;
}

export interface TeachingAssignment {
  id: string;
  teacherId: string;
  institutionId: string;
  courseId: string;
  subjectId: string;
  endedAt: string | null;
  rowVersion: number;
  teacher: Pick<Teacher, 'id' | 'displayName' | 'userId' | 'isActive'>;
  institution: Pick<Institution, 'id' | 'name' | 'isActive'>;
  course: Course;
  subject: Subject;
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; requestId?: string; details?: unknown };
}
