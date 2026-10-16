/**
 * Simulación del montaje: la unidad repetida en bandas × repeticiones de una manga,
 * y el rectángulo que se cobra por tinta. Puro (sin React).
 * Ejes en pulgadas: x = a lo largo de la plancha, y = alrededor del cilindro.
 */
import { rectCobradoPlancha, rectCobradoUnidad, type MedicionArte, type RectIn } from './medicion';

export interface EntradaMontaje {
  /** Largo de una unidad en la plancha (lámina). */
  lamina: number;
  /** Ancho de la funda (alrededor del cilindro). */
  anchoFunda: number;
  /** Desarrollo de la manga por repetición. */
  dev: number;
  reps: number;
  bandas: number;
  /** Arte de solo el frente de una bolsa abierta (cada celda = frente + dorso). */
  soloFrente: boolean;
  largoBolsa: number;
  dorsoImpreso: boolean;
  /** Medición en coordenadas de una unidad (con el dorso ya aplicado si corresponde). */
  medicion: MedicionArte | null;
  colores: number;
}

export interface Celda {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  banda: number;
  rep: number;
  cara: 'unidad' | 'frente' | 'dorso';
  impresa: boolean;
}

export interface Cobrado {
  tinta: string;
  rect: RectIn;
  area: number;
  /** Índice de la tinta (las de zona general no lo tienen). */
  indice?: number;
  /** La medida fue escrita a mano. */
  manual?: boolean;
}

export interface Montaje {
  plancha: { ancho: number; alto: number };
  celdas: Celda[];
  /** El desarrollo es menor que el ancho de la funda: las repeticiones se pisan. */
  traslape: boolean;
  /** Rectángulo cobrado de la zona general (o de la plancha completa sin medición). */
  general: Cobrado | null;
  /** Rectángulo cobrado de cada tinta con zona propia. */
  tintas: Cobrado[];
  /** Suma de las áreas cobradas de todos los colores. */
  areaTotal: number;
}

const area = (r: RectIn) => (r.x1 - r.x0) * (r.y1 - r.y0);

export function montaje(e: EntradaMontaje): Montaje {
  const plancha = { ancho: e.bandas * e.lamina, alto: e.reps * e.dev };

  const celdas: Celda[] = [];
  for (let banda = 0; banda < e.bandas; banda++) {
    for (let rep = 0; rep < e.reps; rep++) {
      const x = banda * e.lamina;
      const y = rep * e.dev;
      if (e.soloFrente) {
        celdas.push({ x, y, ancho: e.largoBolsa, alto: e.anchoFunda, banda, rep, cara: 'frente', impresa: true });
        celdas.push({
          x: x + e.largoBolsa,
          y,
          ancho: e.lamina - e.largoBolsa,
          alto: e.anchoFunda,
          banda,
          rep,
          cara: 'dorso',
          impresa: e.dorsoImpreso,
        });
      } else {
        celdas.push({ x, y, ancho: e.lamina, alto: e.anchoFunda, banda, rep, cara: 'unidad', impresa: true });
      }
    }
  }

  const fila = { largo: e.lamina, dev: e.dev, reps: e.reps, bandas: e.bandas };
  const cobrar = (tinta: string, r: RectIn): Cobrado => {
    const rect = e.medicion ? rectCobradoUnidad(r, fila, e.medicion.margenIn) : r;
    return { tinta, rect, area: area(rect) };
  };

  const completo: RectIn = { x0: 0, x1: plancha.ancho, y0: 0, y1: plancha.alto };
  const general = e.medicion ? cobrar('General', e.medicion.general) : { tinta: 'General', rect: completo, area: area(completo) };
  const tintas = e.medicion
    ? [
        ...e.medicion.ajustes.map((a) => cobrar(a.tinta, a.rect)),
        ...(e.medicion.zonasPlancha ?? []).map((z) => {
          const rect = rectCobradoPlancha(z.rect, fila, e.medicion!.margenIn);
          return { tinta: z.tinta, rect, area: area(rect), indice: z.indice };
        }),
        ...(e.medicion.manuales ?? []).map((mm) => {
          // Sin posición propia: se dibuja desde la esquina del rectángulo general, dentro de la plancha.
          const ancho = Math.min(Math.max(0, mm.ancho), plancha.ancho);
          const alto = Math.min(Math.max(0, mm.alto), plancha.alto);
          const x0 = Math.min(general.rect.x0, plancha.ancho - ancho);
          const y0 = Math.min(general.rect.y0, plancha.alto - alto);
          const rect = { x0, x1: x0 + ancho, y0, y1: y0 + alto };
          return { tinta: mm.tinta, rect, area: area(rect), indice: mm.indice, manual: true };
        }),
      ]
    : [];

  // Igual que areasPorColor: las tintas con zona propia ocupan los primeros colores; el resto usa la general.
  let areaTotal = 0;
  for (let i = 0; i < e.colores; i++) areaTotal += (tintas[i] ?? general).area;

  return { plancha, celdas, traslape: e.dev < e.anchoFunda - 1e-9, general, tintas, areaTotal };
}

/**
 * Celda impresa bajo un punto (pulgadas de plancha). Si las repeticiones se pisan,
 * gana la última pintada (la que se ve encima).
 */
export function celdaEnPunto(celdas: Celda[], x: number, y: number, anchoUnidad: number): Celda | undefined {
  for (let i = celdas.length - 1; i >= 0; i--) {
    const c = celdas[i];
    if (c.impresa && x >= c.x && x <= c.x + Math.min(c.ancho, anchoUnidad) && y >= c.y && y <= c.y + c.alto) return c;
  }
  return undefined;
}
