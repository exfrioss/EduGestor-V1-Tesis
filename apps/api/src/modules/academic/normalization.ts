export const normalizeDisplayText = (value: string): string => value.trim().replace(/\s+/g, ' ');

export const normalizeComparableText = (value: string): string =>
  normalizeDisplayText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-PY');
