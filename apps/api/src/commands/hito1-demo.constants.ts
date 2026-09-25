export const HITO1_DEMO_IDS = {
  adminUser: '10000000-0000-4000-8000-000000000001',
  teacherOneUser: '10000000-0000-4000-8000-000000000002',
  teacherTwoUser: '10000000-0000-4000-8000-000000000003',
  institution: '20000000-0000-4000-8000-000000000001',
  teacherOne: '30000000-0000-4000-8000-000000000001',
  teacherTwo: '30000000-0000-4000-8000-000000000002',
  teacherOneInstitution: '40000000-0000-4000-8000-000000000001',
  teacherTwoInstitution: '40000000-0000-4000-8000-000000000002',
  academicYear: '50000000-0000-4000-8000-000000000001',
  course: '60000000-0000-4000-8000-000000000001',
  subject: '70000000-0000-4000-8000-000000000001',
  teacherOneAssignment: '80000000-0000-4000-8000-000000000001',
  teacherTwoAssignment: '80000000-0000-4000-8000-000000000002',
  institutionScope: '90000000-0000-4000-8000-000000000001',
  administratorRole: 'a0000000-0000-4000-8000-000000000001',
  administratorAssignment: 'b0000000-0000-4000-8000-000000000001',
} as const;

export const HITO1_DEMO_DATA = {
  institutionName: 'Colegio Horizonte Demo',
  academicYearLabel: '2026',
  startsOn: new Date('2026-02-01T00:00:00.000Z'),
  endsOn: new Date('2026-11-30T00:00:00.000Z'),
  grade: '1.º BTI',
  section: 'A',
  shift: 'Mañana',
  subjectName: 'Programación I',
  teacherOneName: 'Ana Docente Demo',
  teacherTwoName: 'Bruno Docente Demo',
} as const;

export const demoPermissionGrantId = (index: number): string =>
  `c0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
