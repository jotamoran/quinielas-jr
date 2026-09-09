import { describe, expect, it } from 'vitest';
import { normalizarNombreEquipo } from '../../api/_lib/football/equiposCache.js';

describe('normalizarNombreEquipo', () => {
  it('recorta espacios y pasa a minúsculas', () => {
    expect(normalizarNombreEquipo('  Club América  ')).toBe('club américa');
  });

  it('produce el mismo resultado sin importar mayúsculas/espacios de entrada', () => {
    expect(normalizarNombreEquipo('CRUZ AZUL')).toBe(normalizarNombreEquipo('  cruz azul  '));
  });
});
