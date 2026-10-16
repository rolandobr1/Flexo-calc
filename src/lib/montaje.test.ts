import { describe, expect, test } from 'vitest';
import { montaje } from './montaje';
import { calcularConfiguraciones, COSTO_BASE_POR_AREA, IVA } from './costo';
import type { MedicionArte } from './medicion';

const arroz: MedicionArte = {
  modo: 'unidad',
  marco: { anchoIn: 40, altoIn: 12.96 },
  general: { x0: 2.125, x1: 18.375, y0: 2.0425, y1: 10.9175 },
  ajustes: [],
  margenIn: 1,
};
const baseArroz = { lamina: 40, anchoFunda: 12.96, dev: 12.96, reps: 2, bandas: 1, soloFrente: false, largoBolsa: 20, dorsoImpreso: false, colores: 3 };

describe('montaje', () => {
  test('arroz 668/2 rep × 1 banda: 2 celdas, plancha 40 × 25.92, cobrado 18.25 × 23.835', () => {
    const m = montaje({ ...baseArroz, medicion: arroz });
    expect(m.plancha).toEqual({ ancho: 40, alto: 25.92 });
    expect(m.celdas.map((c) => [c.x, c.y, c.ancho, c.alto, c.cara])).toEqual([
      [0, 0, 40, 12.96, 'unidad'],
      [0, 12.96, 40, 12.96, 'unidad'],
    ]);
    expect(m.traslape).toBe(false);
    expect(m.general!.rect.x1 - m.general!.rect.x0).toBeCloseTo(18.25, 9);
    expect(m.general!.area).toBeCloseTo(18.25 * 23.835, 6);
    expect(m.areaTotal).toBeCloseTo(18.25 * 23.835 * 3, 6);
  });

  test('Snowhite 404/2 × 2 bandas: 4 celdas en 38 × 15.5', () => {
    const m = montaje({ ...baseArroz, lamina: 19, anchoFunda: 7.75, dev: 7.75, reps: 2, bandas: 2, medicion: null, colores: 4 });
    expect(m.plancha).toEqual({ ancho: 38, alto: 15.5 });
    expect(m.celdas.map((c) => [c.x, c.y])).toEqual([[0, 0], [0, 7.75], [19, 0], [19, 7.75]]);
    // Sin medición se cobra la plancha completa.
    expect(m.general!.rect).toEqual({ x0: 0, x1: 38, y0: 0, y1: 15.5 });
    expect(m.areaTotal).toBeCloseTo(38 * 15.5 * 4, 9);
  });

  test('traslape cuando el desarrollo es menor que el ancho de la funda', () => {
    const m = montaje({ ...baseArroz, dev: 12.5, medicion: arroz });
    expect(m.traslape).toBe(true);
    expect(m.general!.rect.y1).toBeLessThanOrEqual(m.plancha.alto);
  });

  test('arte de solo el frente: cada celda tiene frente y dorso (impreso o no)', () => {
    const con = montaje({ ...baseArroz, soloFrente: true, dorsoImpreso: true, medicion: null });
    expect(con.celdas.filter((c) => c.y === 0).map((c) => [c.x, c.ancho, c.cara, c.impresa])).toEqual([
      [0, 20, 'frente', true],
      [20, 20, 'dorso', true],
    ]);
    const sin = montaje({ ...baseArroz, soloFrente: true, dorsoImpreso: false, medicion: null });
    expect(sin.celdas.find((c) => c.cara === 'dorso')!.impresa).toBe(false);
  });

  test('tintas con zona propia aparecen por nombre y el total suma general para el resto', () => {
    const med: MedicionArte = { ...arroz, ajustes: [{ tinta: 'Negro', rect: { x0: 3, x1: 5, y0: 4, y1: 6 } }] };
    const m = montaje({ ...baseArroz, medicion: med });
    expect(m.tintas.map((t) => t.tinta)).toEqual(['Negro']);
    expect(m.areaTotal).toBeCloseTo(m.tintas[0].area + 2 * m.general!.area, 9);
  });

  test('el costo del montaje coincide con la tabla en todas las mangas', () => {
    const med: MedicionArte = { ...arroz, ajustes: [{ tinta: 'Negro', rect: { x0: 3, x1: 5, y0: 4, y1: 6 } }] };
    const filas = calcularConfiguraciones({ ancho: 12.96, largo: 40, colores: 3, bandas: 1, tipo: 'funda', medicion: med });
    for (const f of filas) {
      const m = montaje({ ...baseArroz, dev: f.exactDev, reps: f.reps, medicion: med });
      expect(m.areaTotal * COSTO_BASE_POR_AREA * IVA).toBeCloseTo(f.costoTotal, 6);
    }
  });
});

describe('celda bajo el puntero', () => {
  test('I2: con traslape gana la copia pintada encima (la última)', async () => {
    const { celdaEnPunto } = await import('./montaje');
    const m = montaje({ ...baseArroz, anchoFunda: 13, dev: 12.5, medicion: null });
    // y = 12.7 está dentro de la rep 1 (0→13) y de la rep 2 (12.5→25.5): se ve la rep 2.
    expect(celdaEnPunto(m.celdas, 5, 12.7, 40)!.rep).toBe(1);
    expect(celdaEnPunto(m.celdas, 5, 3, 40)!.rep).toBe(0);
    expect(celdaEnPunto(m.celdas, 41, 3, 40)).toBeUndefined();
  });

  test('las caras sin impresión no reciben dibujos', async () => {
    const { celdaEnPunto } = await import('./montaje');
    const m = montaje({ ...baseArroz, soloFrente: true, dorsoImpreso: false, medicion: null });
    expect(celdaEnPunto(m.celdas, 30, 3, 20)).toBeUndefined();
    expect(celdaEnPunto(m.celdas, 5, 3, 20)!.cara).toBe('frente');
  });
});

describe('zonas propias en la plancha', () => {
  test('Snowhite: Negro solo en la esquina inferior derecha → 16 × 8.5; total = Negro + 3 × general', () => {
    const med: MedicionArte = {
      modo: 'unidad',
      marco: { anchoIn: 19, altoIn: 7.75 },
      general: { x0: 4, x1: 15, y0: 0.25, y1: 7.5 },
      ajustes: [],
      zonasPlancha: [{ tinta: 'Negro', rect: { x0: 20, x1: 34, y0: 8, y1: 15 } }],
      margenIn: 1,
    };
    const m = montaje({ ...baseArroz, lamina: 19, anchoFunda: 7.75, dev: 7.75, reps: 2, bandas: 2, colores: 4, medicion: med });
    expect(m.tintas).toEqual([{ tinta: 'Negro', rect: { x0: 19, x1: 35, y0: 7, y1: 15.5 }, area: 136 }]);
    expect(m.areaTotal).toBeCloseTo(136 + 3 * 496, 9);
    const filas = calcularConfiguraciones({ ancho: 7.75, largo: 19, colores: 4, bandas: 2, tipo: 'funda', medicion: med });
    const f = filas.find((c) => c.manga === 404 && c.reps === 2)!;
    expect(m.areaTotal * COSTO_BASE_POR_AREA * IVA).toBeCloseTo(f.costoTotal, 6); // $574.90
    expect(f.costoTotal).toBeCloseTo((136 + 3 * 496) * 0.354, 6);
  });
});

describe('medida manual del área cobrada', () => {
  const conManual = (manuales: NonNullable<MedicionArte['manuales']>): MedicionArte => ({ ...arroz, manuales });

  test('reemplaza el área de esa tinta en el montaje y en el costo; el resto usa la general', () => {
    const m = montaje({ ...baseArroz, medicion: conManual([{ tinta: 'Negro', ancho: 10, alto: 5, indice: 2 }]) });
    const negro = m.tintas.find((t) => t.indice === 2)!;
    expect(negro.manual).toBe(true);
    expect(negro.area).toBeCloseTo(50, 9);
    expect(m.areaTotal).toBeCloseTo(18.25 * 23.835 * 2 + 50, 6);

    const fila = calcularConfiguraciones({ ancho: 12.96, largo: 40, bandas: 1, colores: 3, tipo: 'funda', medicion: conManual([{ tinta: 'Negro', ancho: 10, alto: 5, indice: 2 }]) })
      .find((c) => c.exactDev === 12.96 && c.reps === 2)!;
    expect(fila.costoTotal).toBeCloseTo((18.25 * 23.835 * 2 + 50) * COSTO_BASE_POR_AREA * IVA, 6);
  });

  test('si es mayor que la plancha se recorta a la plancha', () => {
    const m = montaje({ ...baseArroz, medicion: conManual([{ tinta: 'A', ancho: 60, alto: 99, indice: 0 }]) });
    const a = m.tintas.find((t) => t.indice === 0)!;
    expect(a.area).toBeCloseTo(40 * 25.92, 9);
    expect(a.rect.x1).toBeLessThanOrEqual(40);
    expect(a.rect.y1).toBeLessThanOrEqual(25.92);
  });
});
