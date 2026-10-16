import { describe, expect, test } from 'vitest';
import {
  areaPlancha,
  areasPorColor,
  areaUnidad,
  normalizarRect,
  rectPxAIn,
  conDorso,
  rectCobradoUnidad,
  rectCobradoPlancha,
  rectInAPx,
  redondearOctavo,
  type MedicionArte,
} from './medicion';

const bananas = { x0: 4.8, x1: 24.0, y0: 0.3, y1: 9.4 };
const snow = { x0: 4.0, x1: 34.0, y0: 0.25, y1: 15.25 };

describe('áreas de plancha', () => {
  test('Bananas unidad 504/2 reps/1 banda', () => {
    expect(areaUnidad(bananas, { largo: 29, dev: 9.75, reps: 2, bandas: 1 }, 1)).toBeCloseTo(21.2 * 19.5, 6);
  });

  test('Snowhite plancha completa', () => {
    expect(areaPlancha(snow, { anchoIn: 38, altoIn: 15.5 }, 1)).toBeCloseTo(32 * 15.5, 6);
  });

  test('recorte por lado: a 0.25" del borde crece solo 0.25"', () => {
    expect(areaPlancha({ x0: 0.25, x1: 10, y0: 5, y1: 6 }, { anchoIn: 20, altoIn: 20 }, 1)).toBeCloseTo(11 * 3, 6);
  });

  test('réplica con 2 bandas', () => {
    expect(areaUnidad(bananas, { largo: 29, dev: 9.75, reps: 2, bandas: 2 }, 1)).toBeCloseTo((54 - 3.8) * 19.5, 6);
  });

  test('desarrollo menor que la impresión: nunca supera la plancha', () => {
    const f = { largo: 29, dev: 7.0, reps: 2, bandas: 1 };
    expect(areaUnidad(bananas, f, 1)).toBeLessThanOrEqual(29 * 14.0);
  });
});

describe('conversión de rectángulos', () => {
  test('normalizarRect invierte arrastre al revés', () => {
    expect(normalizarRect({ izq: 100, arr: 80, der: 10, aba: 5 })).toEqual({ izq: 10, arr: 5, der: 100, aba: 80 });
  });

  test('rectPxAIn recorta al marco y convierte', () => {
    const marco = { izq: 100, arr: 100, der: 1100, aba: 600 };
    expect(rectPxAIn({ izq: 50, arr: 200, der: 600, aba: 700 }, marco, { anchoIn: 20, altoIn: 10 })).toEqual({
      x0: 0,
      x1: 10,
      y0: 2,
      y1: 10,
    });
  });

  test('rectPxAIn con vertical = X intercambia ejes', () => {
    const marco = { izq: 0, arr: 0, der: 500, aba: 1000 };
    expect(rectPxAIn({ izq: 0, arr: 500, der: 250, aba: 1000 }, marco, { anchoIn: 20, altoIn: 10 }, false)).toEqual({
      x0: 10,
      x1: 20,
      y0: 0,
      y1: 5,
    });
  });

  test('redondearOctavo', () => {
    expect(redondearOctavo(28.98)).toBe(29);
    expect(redondearOctavo(9.74)).toBe(9.75);
  });
});

describe('áreas por color', () => {
  test('ajuste para un color, general para el resto', () => {
    const m: MedicionArte = {
      modo: 'plancha',
      marco: { anchoIn: 38, altoIn: 15.5 },
      general: snow,
      ajustes: [{ tinta: 'Negro', rect: { x0: 6, x1: 32, y0: 1, y1: 14 } }],
      margenIn: 1,
      bandasArte: 2,
      repsArte: 2,
    };
    const a = areasPorColor(m, 4, { largo: 19, dev: 7.75, reps: 2, bandas: 2 });
    expect(a).toHaveLength(4);
    expect(a[0]).toBeCloseTo(28 * 15, 6);
    expect(a.slice(1).every((v) => Math.abs(v - 496) < 1e-6)).toBe(true);
  });
});

describe('arte de solo el frente con dorso impreso', () => {
  const m: MedicionArte = {
    modo: 'unidad',
    marco: { anchoIn: 20, altoIn: 12.96 },
    general: { x0: 2.125, x1: 18.375, y0: 2.0425, y1: 10.9175 },
    ajustes: [{ tinta: 'Negro', rect: { x0: 3, x1: 5, y0: 4, y1: 6 } }],
    margenIn: 1,
  };

  test('conDorso extiende las zonas hasta el dorso (frente + desplazamiento)', () => {
    const d = conDorso(m, 20);
    expect(d.general).toEqual({ x0: 2.125, x1: 38.375, y0: 2.0425, y1: 10.9175 });
    expect(d.ajustes[0].rect).toEqual({ x0: 3, x1: 25, y0: 4, y1: 6 });
  });

  test('sin dorso: arroz 668/2 rep, lámina 40" → 18.25" × 23.835"', () => {
    expect(areaUnidad(m.general, { largo: 40, dev: 12.96, reps: 2, bandas: 1 }, 1)).toBeCloseTo(18.25 * 23.835, 6);
  });

  test('con dorso: 38.25" a lo largo (hasta el borde de la lámina de 40")', () => {
    const d = conDorso(m, 20);
    expect(areaUnidad(d.general, { largo: 40, dev: 12.96, reps: 2, bandas: 1 }, 1)).toBeCloseTo(38.25 * 23.835, 6);
  });
});

describe('rectángulo cobrado y conversión inversa', () => {
  test('rectCobradoUnidad Bananas = 3.8→25 × 0→19.5 y su área = areaUnidad', () => {
    const fila = { largo: 29, dev: 9.75, reps: 2, bandas: 1 };
    const r = rectCobradoUnidad(bananas, fila, 1);
    expect(r.x0).toBeCloseTo(3.8, 9); expect(r.x1).toBeCloseTo(25, 9);
    expect(r.y0).toBeCloseTo(0, 9); expect(r.y1).toBeCloseTo(19.5, 9);
    expect((r.x1 - r.x0) * (r.y1 - r.y0)).toBeCloseTo(areaUnidad(bananas, fila, 1), 9);
  });

  test('rectInAPx es la inversa de rectPxAIn (horizontal y vertical)', () => {
    const marco = { izq: 100, arr: 50, der: 1100, aba: 550 };
    const dim = { anchoIn: 20, altoIn: 10 };
    const rin = { x0: 2, x1: 7.5, y0: 1.25, y1: 9 };
    for (const h of [true, false]) {
      const dimH = h ? dim : { anchoIn: 10, altoIn: 20 };
      const vuelta = rectPxAIn(rectInAPx(rin, marco, dimH, h), marco, dimH, h);
      expect(vuelta.x0).toBeCloseTo(rin.x0, 9); expect(vuelta.x1).toBeCloseTo(rin.x1, 9);
      expect(vuelta.y0).toBeCloseTo(rin.y0, 9); expect(vuelta.y1).toBeCloseTo(rin.y1, 9);
    }
  });
});

describe('zona propia sobre la composición completa (no se repite)', () => {
  const fila = { largo: 19, dev: 7.75, reps: 2, bandas: 2 }; // plancha 38 × 15.5
  test('rectCobradoPlancha: zona + margen, recortada a la plancha', () => {
    expect(rectCobradoPlancha({ x0: 20, x1: 34, y0: 8, y1: 15 }, fila, 1)).toEqual({ x0: 19, x1: 35, y0: 7, y1: 15.5 });
  });

  test('areasPorColor: la zona de plancha cuenta tal cual, el resto usa la general replicada', () => {
    const m: MedicionArte = {
      modo: 'unidad',
      marco: { anchoIn: 19, altoIn: 7.75 },
      general: { x0: 4, x1: 15, y0: 0.25, y1: 7.5 },
      ajustes: [],
      zonasPlancha: [{ tinta: 'Negro', rect: { x0: 20, x1: 34, y0: 8, y1: 15 } }],
      margenIn: 1,
    };
    const a = areasPorColor(m, 4, fila);
    expect(a[0]).toBeCloseTo(16 * 8.5, 9);
    expect(a.slice(1).every((v) => Math.abs(v - 32 * 15.5) < 1e-9)).toBe(true);
  });

  test('conDorso no mueve las zonas de plancha', () => {
    const m: MedicionArte = {
      modo: 'unidad',
      marco: { anchoIn: 20, altoIn: 12.96 },
      general: { x0: 2, x1: 18, y0: 2, y1: 10 },
      ajustes: [],
      zonasPlancha: [{ tinta: 'Negro', rect: { x0: 3, x1: 5, y0: 4, y1: 6 } }],
      margenIn: 1,
    };
    expect(conDorso(m, 20).zonasPlancha).toEqual(m.zonasPlancha);
  });
});
