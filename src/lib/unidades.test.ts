import { describe, expect, test } from 'vitest';
import { aPulgadas, desdePulgadas, mostrarMedida, mismaMedida } from './unidades';

describe('unidades de medida (pulg / mm)', () => {
  test('en pulgadas el texto pasa tal cual', () => {
    expect(aPulgadas('9.75', 'pulg')).toBe('9.75');
    expect(desdePulgadas('9.75', 'pulg')).toBe('9.75');
  });

  test('mm → pulg: 247.65 mm = 9.75"; 508 mm = 20"', () => {
    expect(aPulgadas('247.65', 'mm')).toBe('9.75');
    expect(aPulgadas('508', 'mm')).toBe('20');
  });

  test('pulg → mm con 2 decimales como máximo', () => {
    expect(desdePulgadas('9.75', 'mm')).toBe('247.65');
    expect(desdePulgadas('7.628', 'mm')).toBe('193.75');
    expect(desdePulgadas('20', 'mm')).toBe('508');
  });

  test('vacío o texto a medio escribir no se rompe', () => {
    expect(aPulgadas('', 'mm')).toBe('');
    expect(desdePulgadas('', 'mm')).toBe('');
    expect(aPulgadas('-', 'mm')).toBe('-');
    expect(aPulgadas('12,5', 'mm')).toBe(aPulgadas('12.5', 'mm'));
  });

  test('ida y vuelta conserva la medida', () => {
    for (const v of ['9.75', '7.628', '12.96', '19', '0.125']) {
      expect(parseFloat(aPulgadas(desdePulgadas(v, 'mm'), 'mm'))).toBeCloseTo(parseFloat(v), 3);
    }
  });

  test('mismaMedida compara el texto escrito con el valor guardado en pulgadas', () => {
    expect(mismaMedida('247.65', '9.75', 'mm')).toBe(true);
    expect(mismaMedida('247.', '9.72441', 'mm')).toBe(true);
    expect(mismaMedida('250', '9.75', 'mm')).toBe(false);
    expect(mismaMedida('', '', 'mm')).toBe(true);
  });

  test('mostrarMedida', () => {
    expect(mostrarMedida(9.75, 'pulg')).toBe('9.75"');
    expect(mostrarMedida(9.75, 'mm')).toBe('247.65 mm');
    expect(mostrarMedida(50, 'mm')).toBe('1270 mm');
  });
});
