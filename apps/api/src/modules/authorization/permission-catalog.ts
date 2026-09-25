export const PERMISSION_CATALOG = [
  { code: 'institution.read', description: 'Consultar instituciones' },
  { code: 'institution.manage', description: 'Administrar instituciones' },
  { code: 'teacher.read', description: 'Consultar docentes' },
  { code: 'teacher.manage', description: 'Administrar docentes' },
  { code: 'course.read', description: 'Consultar cursos' },
  { code: 'course.manage', description: 'Administrar cursos' },
  { code: 'subject.read', description: 'Consultar materias' },
  { code: 'subject.manage', description: 'Administrar materias' },
  { code: 'teaching-assignment.read', description: 'Consultar asignaciones docentes' },
  { code: 'teaching-assignment.manage', description: 'Administrar asignaciones docentes' },
  { code: 'administration.delegate', description: 'Delegar permisos administrativos' },
  { code: 'administration.revoke', description: 'Revocar concesiones administrativas' },
  { code: 'audit.read', description: 'Consultar auditoría' },
] as const;

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]['code'];
export const PERMISSION_CODES = PERMISSION_CATALOG.map(({ code }) => code) as [
  PermissionCode,
  ...PermissionCode[],
];

export const isPermissionCode = (value: string): value is PermissionCode =>
  PERMISSION_CODES.includes(value as PermissionCode);
