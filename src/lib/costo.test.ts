import { describe, expect, test } from 'vitest';
import { calcularConfiguraciones, mangaMasCercana, validarEntrada } from './costo';
import type { MedicionArte } from './medicion';

const base = { ancho: 7.75, largo: 19, colores: 4, bandas: 2, tipo: 'funda' as const };

const snowhite = (ajustes: MedicionArte['ajustes'] = []): MedicionArte => ({
  modo: 'plancha',
  marco: { anchoIn: 38, altoIn: 15.5 },
  general: { x0: 4, x1: 34, y0: 0.25, y1: 15.25 },
  ajustes,
  margenIn: 1,
  bandasArte: 2,
  repsArte: 2,
});

describe('calcularConfiguraciones', () => {
  test('sin medición: alrededor del cilindro se cobra desarrollo × repeticiones (regla del proveedor)', () => {
    const r = calcularConfiguraciones({ ...base, medicion: null });
    expect(r).toHaveLength(8);
    expect(r[0]).toMatchObject({ manga: 404, reps: 2, exactDev: 7.75, diff: 0, estimado: false });
    expect(r[0].costoTotal).toBeCloseTo(834.024, 3); // desarrollo = alto: mismo precio que antes
    r.forEach((c) => expect(c.costoTotal).toBeCloseTo(c.exactDev * c.reps * 19 * 2 * 0.3 * 1.18 * 4, 6));
    const fila800 = r.find((c) => c.manga === 800 && c.reps === 4)!; // desarrollo 7.71 ≠ alto 7.75
    expect(fila800.area).toBeCloseTo(7.71 * 4 * 19 * 2, 6);
  });

  test('medir una impresión que cubre toda la funda nunca cuesta más que no medir; igual si desarrollo = alto', () => {
    const e = { ancho: 9.75, largo: 29, colores: 4, bandas: 1, tipo: 'funda' as const };
    const med: MedicionArte = {
      modo: 'unidad',
      marco: { anchoIn: 29, altoIn: 9.75 },
      general: { x0: 0, x1: 29, y0: 0, y1: 9.75 },
      ajustes: [],
      margenIn: 0,
    };
    const sin = calcularConfiguraciones({ ...e, medicion: null });
    const con = calcularConfiguraciones({ ...e, medicion: med });
    sin.forEach((c, i) => expect(con[i].costoTotal).toBeLessThanOrEqual(c.costoTotal + 1e-9));
    const i504 = sin.findIndex((c) => c.manga === 504 && c.reps === 2); // desarrollo 9.75 = alto
    expect(con[i504].costoTotal).toBeCloseTo(sin[i504].costoTotal, 6);
    // Con el margen de 1" el rectángulo se recorta a la plancha: también igual.
    const conMargen = calcularConfiguraciones({ ...e, medicion: { ...med, margenIn: 1 } });
    sin.forEach((c, i) => expect(conMargen[i].costoTotal).toBeCloseTo(c.costoTotal, 6));
  });

  test('Snowhite modo plancha: 702.34, exacto en la fila del arte', () => {
    const r = calcularConfiguraciones({ ...base, medicion: snowhite() });
    const fila = r.find((c) => c.manga === 404 && c.reps === 2)!;
    expect(fila.costoTotal).toBeCloseTo(702.336, 3);
    expect(fila.estimado).toBe(false);
    expect(r.filter((c) => c.reps !== 2).every((c) => c.estimado)).toBe(true);
  });

  test('Snowhite + ajuste del negro: 675.43', () => {
    const med = snowhite([{ tinta: 'Negro', rect: { x0: 6, x1: 32, y0: 1, y1: 14 } }]);
    const fila = calcularConfiguraciones({ ...base, medicion: med }).find((c) => c.manga === 404 && c.reps === 2)!;
    expect(fila.costoTotal).toBeCloseTo(675.432, 3);
  });

  test('Bananas modo unidad: 504/2 = 413.4 por color, no estimado', () => {
    const med: MedicionArte = {
      modo: 'unidad',
      marco: { anchoIn: 29, altoIn: 9.75 },
      general: { x0: 4.8, x1: 24, y0: 0.3, y1: 9.4 },
      ajustes: [],
      margenIn: 1,
    };
    const r = calcularConfiguraciones({ ancho: 9.75, largo: 29, colores: 4, bandas: 1, tipo: 'funda', medicion: med });
    const fila = r.find((c) => c.manga === 504 && c.reps === 2)!;
    expect(fila.costoTotal).toBeCloseTo(413.4 * 0.354 * 4, 3);
    expect(fila.area).toBeCloseTo(413.4, 6);
    expect(r.every((c) => !c.estimado)).toBe(true);
  });
});

describe('validarEntrada', () => {
  test('mensajes actuales', () => {
    expect(validarEntrada({ ...base, colores: 9, medicion: null })).toBe('El número máximo de colores permitido es 8.');
    expect(validarEntrada({ ...base, colores: NaN, medicion: null })).toBe(
      'Por favor complete todos los campos con valores numéricos.',
    );
    expect(validarEntrada({ ...base, largo: 30, medicion: null })).toBe(
      'La combinación de Largo (30") y Bandas (2) excede el límite de 50". Total: 60.00"',
    );
    expect(validarEntrada({ ...base, medicion: null })).toBeNull();
  });

  test('más ajustes por color que colores', () => {
    const r = { x0: 0, x1: 1, y0: 0, y1: 1 };
    const med: MedicionArte = {
      modo: 'unidad',
      marco: { anchoIn: 29, altoIn: 9.75 },
      general: r,
      ajustes: [
        { tinta: 'A', rect: r },
        { tinta: 'B', rect: r },
      ],
      margenIn: 1,
    };
    expect(validarEntrada({ ...base, colores: 1, medicion: med })).toBe('Hay más ajustes por color que colores.');
  });
});

describe('mangaMasCercana (el alto de la funda define la manga)', () => {
  test('Bananas 9.75 → 504 / 2 rep; Snowhite 7.75 → 404 / 2 rep', () => {
    expect(mangaMasCercana(9.75, 'funda')).toEqual({ manga: 504, reps: 2, dev: 9.75 });
    expect(mangaMasCercana(7.75, 'funda')).toEqual({ manga: 404, reps: 2, dev: 7.75 });
  });

  test('coincide con la primera fila de la tabla', () => {
    for (const tipo of ['funda', 'rollo'] as const) {
      for (const alto of [3.7, 7.75, 9.75, 12.3, 19]) {
        const fila = calcularConfiguraciones({ ancho: alto, largo: 10, colores: 1, bandas: 1, tipo, medicion: null })[0];
        expect(mangaMasCercana(alto, tipo)).toEqual({ manga: fila.manga, reps: fila.reps, dev: fila.exactDev });
      }
    }
  });

  test('alto inválido → null', () => {
    expect(mangaMasCercana(0, 'funda')).toBeNull();
    expect(mangaMasCercana(NaN, 'funda')).toBeNull();
  });
});

describe('comparativa: 2 por debajo y 2 por encima, sin la exacta', () => {
  test('ancho 7.75 (exacta 404/2): 4 alternativas, ninguna exacta, ordenadas por desarrollo', async () => {
    const { alternativas } = await import('./costo');
    const r = calcularConfiguraciones({ ...base, medicion: null });
    const alt = alternativas(r, 7.75);
    expect(alt).toHaveLength(4);
    expect(alt.some((c) => c.exactDev === 7.75)).toBe(false);
    expect(alt.filter((c) => c.exactDev < 7.75)).toHaveLength(2);
    expect(alt.filter((c) => c.exactDev > 7.75)).toHaveLength(2);
    expect(alt.map((c) => c.exactDev)).toEqual([...alt.map((c) => c.exactDev)].sort((a, b) => a - b));
    // las más cercanas de cada lado
    expect(alt.map((c) => c.exactDev)).toEqual([7.628, 7.71, 8.07, 8.21]);
  });

  test('sin exacta: la mejor opción (tarjeta) tampoco se repite en la tabla', async () => {
    const { alternativas } = await import('./costo');
    const r = calcularConfiguraciones({ ...base, ancho: 9.6, medicion: null });
    const alt = alternativas(r, 9.6);
    expect(alt).toHaveLength(4);
    expect(alt.some((c) => c.id === r[0].id)).toBe(false);
    expect(alt.filter((c) => c.exactDev < 9.6)).toHaveLength(2);
    expect(alt.filter((c) => c.exactDev > 9.6)).toHaveLength(2);
  });
});
