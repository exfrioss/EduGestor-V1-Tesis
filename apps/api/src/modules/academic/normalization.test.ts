import { describe, expect, it } from 'vitest';
import { normalizeComparableText, normalizeDisplayText } from './normalization.js';

describe('normalización académica', () => {
  it('conserva una etiqueta legible y colapsa espacios', () => {
    expect(normalizeDisplayText('  Primer   Curso  ')).toBe('Primer Curso');
  });

  it('genera una representación comparable sin acentos ni diferencias de mayúsculas', () => {
    expect(normalizeComparableText('  Matemática   Aplicada ')).toBe('matematica aplicada');
  });
});
