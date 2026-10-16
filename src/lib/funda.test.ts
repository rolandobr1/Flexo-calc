import { describe, expect, test } from 'vitest';
import { bandasSugeridas, largoEnPlancha, carasSegunMarco } from './funda';

test('funda con largo de bolsa: la lámina es frente + dorso (×2)', () => {
  expect(largoEnPlancha('funda', 20, 'bolsa')).toBe(40);
  expect(largoEnPlancha('funda', 20, 'lamina')).toBe(20);
});

test('rollos no se duplican', () => {
  expect(largoEnPlancha('rollo', 27.32, 'bolsa')).toBe(27.32);
});

test('bandas: bolsa de 20" → lámina 40" → 1 banda; lámina de 20" → 2 bandas', () => {
  expect(bandasSugeridas(largoEnPlancha('funda', 20, 'bolsa'))).toBe(1);
  expect(bandasSugeridas(largoEnPlancha('funda', 20, 'lamina'))).toBe(2);
  expect(bandasSugeridas(NaN)).toBeNull();
  expect(bandasSugeridas(60)).toBeNull();
});

test('largo del marco: lámina completa salvo que el arte muestre solo el frente', async () => {
  const { largoDelMarco } = await import('./funda');
  expect(largoDelMarco('funda', 20, 'bolsa', false)).toBe(40);
  expect(largoDelMarco('funda', 20, 'bolsa', true)).toBe(20);
  expect(largoDelMarco('funda', 29, 'lamina', true)).toBe(29);
  expect(largoDelMarco('rollo', 27.32, 'bolsa', true)).toBe(27.32);
});

describe('carasSegunMarco: ¿el marco es una cara o la lámina completa?', () => {
  // Suavechon: bolsa 10" (lámina 20") × ancho 8.375"; marco dibujado 2200 × 923 px
  test('marco de la lámina completa → "lamina"', () => {
    expect(carasSegunMarco(2200, 923, true, 10, 8.375)).toBe('lamina');
  });
  test('marco de una sola cara → "frente"', () => {
    expect(carasSegunMarco(1100, 923, true, 10, 8.375)).toBe('frente');
  });
  test('orientación vertical: se usan los ejes transpuestos', () => {
    expect(carasSegunMarco(923, 2200, false, 10, 8.375)).toBe('lamina');
    expect(carasSegunMarco(923, 1100, false, 10, 8.375)).toBe('frente');
  });
  test('si no se distingue claramente (a medio camino) o faltan datos → null', () => {
    expect(carasSegunMarco(1650, 923, true, 10, 8.375)).toBeNull();
    expect(carasSegunMarco(0, 923, true, 10, 8.375)).toBeNull();
    expect(carasSegunMarco(2200, 923, true, NaN, 8.375)).toBeNull();
  });
});
