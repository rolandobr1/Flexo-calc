/**
 * Selección de mangas Comexi F2 ML y costo de planchas.
 * Funciones puras (extraídas de App.tsx).
 */
import { areaPlancha, areasPorColor, type MedicionArte } from './medicion';

export const MANGA_DATABASE = [
  { mm: 384, rollos: [15.0, 7.5, 5.0, 3.75], fundas: [14.875, 7.375, 4.875, 3.625] },
  { mm: 404, rollos: [15.75, 7.875, 5.25, 3.93], fundas: [15.625, 7.75, 5.125, 3.81] },
  { mm: 434, rollos: [17.0, 8.5, 5.66, 4.25], fundas: [16.875, 8.375, 5.54, 4.125] },
  { mm: 454, rollos: [17.75, 8.875, 5.91, 4.43], fundas: [17.625, 8.75, 5.79, 4.31] },
  { mm: 474, rollos: [18.5, 9.25, 6.16, 4.625], fundas: [18.375, 9.125, 6.04, 4.5] },
  { mm: 494, rollos: [19.32, 9.66, 6.44, 4.83], fundas: [19.2, 9.53, 6.315, 4.7] },
  { mm: 504, rollos: [19.75, 9.875, 6.58, 4.93], fundas: [19.625, 9.75, 6.45, 4.81] },
  { mm: 534, rollos: [20.875, 10.43, 6.95, 5.21], fundas: [20.75, 10.31, 6.83, 5.09] },
  { mm: 554, rollos: [21.68, 10.84, 7.22, 5.42], fundas: [21.55, 10.71, 7.1, 5.29] },
  { mm: 584, rollos: [22.875, 11.43, 7.62, 5.71], fundas: [22.75, 11.3, 7.5, 5.59] },
  { mm: 594, rollos: [23.26, 11.63, 7.75, 5.81], fundas: [23.13, 11.5, 7.628, 5.69] },
  { mm: 628, rollos: [24.59, 12.25, 8.19, 6.14], fundas: [24.47, 12.17, 8.07, 6.0] },
  { mm: 648, rollos: [25.38, 12.625, 8.46, 6.34], fundas: [25.26, 12.56, 8.335, 6.22] },
  { mm: 668, rollos: [26.17, 13.08, 8.72, 6.54], fundas: [26.05, 12.96, 8.59, 6.41] },
  { mm: 708, rollos: [27.75, 13.875, 9.25, 6.93], fundas: [27.625, 13.75, 9.125, 6.81] },
  { mm: 800, rollos: [31.375, 15.68, 10.45, 7.84], fundas: [31.25, 15.55, 10.33, 7.71] },
  { mm: 850, rollos: [33.34, 16.687, 11.11, 8.33], fundas: [33.25, 16.55, 10.98, 8.21] },
  { mm: 915, rollos: [35.9, 17.95, 11.96, 8.97], fundas: [35.77, 17.825, 11.84, 8.85] },
  { mm: 980, rollos: [38.45, 19.22, 12.81, 9.61], fundas: [38.33, 19.1, 12.69, 9.48] },
  { mm: 1060, rollos: [41.6, 20.8, 13.86, 10.4], fundas: [41.48, 20.675, 13.74, 10.27] },
  { mm: 1105, rollos: [43.375, 21.687, 14.45, 10.84], fundas: [43.25, 21.56, 14.33, 10.71] },
  { mm: 1170, rollos: [45.875, 22.937, 15.29, 11.46], fundas: [45.75, 22.81, 15.16, 11.34] },
];

export const MAX_PLATE_LENGTH = 50;
export const COSTO_BASE_POR_AREA = 0.3;
export const IVA = 1.18;

export interface Configuration {
  manga: number;
  reps: number;
  exactDev: number;
  type: 'funda' | 'rollo';
  bands: number;
  /** Área cobrada por color (promedio si hay ajustes), en pulg². */
  area: number;
  costoTotal: number;
  id: string;
  /** Diferencia absoluta respecto al ancho pedido. */
  diff: number;
  /** true = desarrollo >= ancho pedido. */
  isAbove: boolean;
  /** true = cálculo proporcional (modo plancha en una fila distinta a la del arte). */
  estimado: boolean;
}

export interface EntradaCalculo {
  ancho: number;
  largo: number;
  colores: number;
  bandas: number;
  tipo: 'funda' | 'rollo';
  medicion: MedicionArte | null;
}

export function validarEntrada(e: EntradaCalculo): string | null {
  const { ancho, largo, colores, bandas } = e;
  if ([ancho, largo, colores, bandas].some((v) => isNaN(v))) {
    return 'Por favor complete todos los campos con valores numéricos.';
  }
  if (ancho <= 0 || largo <= 0 || colores <= 0 || bandas <= 0) {
    return 'Los valores deben ser mayores a cero.';
  }
  if (colores > 8) return 'El número máximo de colores permitido es 8.';
  if (largo > MAX_PLATE_LENGTH) return `El largo no puede exceder las ${MAX_PLATE_LENGTH} pulgadas.`;
  const total = largo * bandas;
  if (total > MAX_PLATE_LENGTH + 0.1) {
    return `La combinación de Largo (${largo}") y Bandas (${bandas}) excede el límite de ${MAX_PLATE_LENGTH}". Total: ${total.toFixed(2)}"`;
  }
  const propias = e.medicion ? e.medicion.ajustes.length + (e.medicion.zonasPlancha?.length ?? 0) + (e.medicion.manuales?.length ?? 0) : 0;
  if (e.medicion && propias > colores) {
    return 'Hay más ajustes por color que colores.';
  }
  return null;
}

/** Áreas por color de una fila y si el resultado es estimado. */
function areasFila(e: EntradaCalculo, dev: number, reps: number): { areas: number[]; estimado: boolean } {
  const { ancho, largo, bandas, colores } = e;
  const m = e.medicion!;
  const areaCompleta = dev * reps * (largo * bandas);

  const fila = { largo, dev, reps, bandas };
  if (m.modo === 'unidad') return { areas: areasPorColor(m, colores, fila), estimado: false };

  const areaMarco = m.marco.anchoIn * m.marco.altoIn;
  const areas = Array.from({ length: colores }, (_, i) => {
    const rect = m.ajustes[i]?.rect ?? m.general;
    return areaCompleta * (areaPlancha(rect, m.marco, m.margenIn) / areaMarco);
  });
  return { areas, estimado: reps !== m.repsArte || bandas !== m.bandasArte };
}

export function calcularConfiguraciones(e: EntradaCalculo): Configuration[] {
  const todas: Configuration[] = [];

  MANGA_DATABASE.forEach((item) => {
    const devs = e.tipo === 'funda' ? item.fundas : item.rollos;
    devs.forEach((dev, idx) => {
      const reps = idx + 1;
      let area: number;
      let costoTotal: number;
      let estimado = false;
      if (!e.medicion) {
        // Alrededor del cilindro se cobra el desarrollo de la manga × repeticiones (regla del proveedor).
        area = dev * reps * (e.largo * e.bandas);
        costoTotal = area * COSTO_BASE_POR_AREA * IVA * e.colores;
      } else {
        const r = areasFila(e, dev, reps);
        const suma = r.areas.reduce((a, b) => a + b, 0);
        area = suma / e.colores;
        costoTotal = suma * COSTO_BASE_POR_AREA * IVA;
        estimado = r.estimado;
      }
      todas.push({
        manga: item.mm,
        reps,
        exactDev: dev,
        type: e.tipo,
        bands: e.bandas,
        area,
        costoTotal,
        id: `${item.mm}-${reps}-${e.tipo}`,
        diff: Math.abs(e.ancho - dev),
        isAbove: dev >= e.ancho,
        estimado,
      });
    });
  });

  const cercanas = (above: boolean) =>
    todas
      .filter((c) => c.isAbove === above)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 4);

  return [...cercanas(true), ...cercanas(false)].sort((a, b) => a.diff - b.diff);
}

/**
 * Manga más cercana al alto de la funda (o distancia entre marquillas).
 * Misma regla que la primera fila de calcularConfiguraciones: menor diferencia;
 * en empate gana la que queda por encima.
 */
export function mangaMasCercana(alto: number, tipo: 'funda' | 'rollo'): { manga: number; reps: number; dev: number } | null {
  if (!(alto > 0)) return null;
  let mejor: { manga: number; reps: number; dev: number; diff: number; above: boolean } | null = null;
  for (const item of MANGA_DATABASE) {
    (tipo === 'funda' ? item.fundas : item.rollos).forEach((dev, idx) => {
      const diff = Math.abs(alto - dev);
      const above = dev >= alto;
      if (!mejor || diff < mejor.diff || (diff === mejor.diff && above && !mejor.above)) {
        mejor = { manga: item.mm, reps: idx + 1, dev, diff, above };
      }
    });
  }
  const m = mejor as { manga: number; reps: number; dev: number } | null;
  return m && { manga: m.manga, reps: m.reps, dev: m.dev };
}

/**
 * Alternativas para la tabla comparativa: las 2 más cercanas por debajo y las 2 más
 * cercanas por encima del ancho pedido, sin la exacta ni la mejor opción (que va en la tarjeta).
 * Ordenadas de menor a mayor desarrollo.
 */
export function alternativas(resultados: Configuration[], ancho: number): Configuration[] {
  const mejor = resultados[0]?.id;
  const resto = resultados.filter((c) => c.id !== mejor && c.exactDev !== ancho);
  const lado = (abajo: boolean) =>
    resto
      .filter((c) => (abajo ? c.exactDev < ancho : c.exactDev > ancho))
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 2);
  return [...lado(true), ...lado(false)].sort((a, b) => a.exactDev - b.exactDev);
}
