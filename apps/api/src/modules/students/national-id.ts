import { AppError } from '../../errors/app-error.js';

/** Cédula paraguaya: se conserva el texto presentado y la clave decimal sin separadores. */
export const normalizeNationalId = (value: string | null | undefined): { nationalId: string | null; nationalIdNormalized: string | null } => {
  if (value === null || value === undefined) return { nationalId: null, nationalIdNormalized: null };
  const nationalId = value.trim();
  if (!nationalId || !/^[0-9.\-\s]+$/.test(nationalId)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Cédula inválida');
  }
  const nationalIdNormalized = nationalId.replace(/[^0-9]/g, '');
  if (!nationalIdNormalized) throw new AppError(400, 'VALIDATION_ERROR', 'Cédula inválida');
  return { nationalId, nationalIdNormalized };
};
