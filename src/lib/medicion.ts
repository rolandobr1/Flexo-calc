/**
 * Medición de la zona impresa sobre el arte.
 * Funciones puras: sin React ni navegador.
 *
 * Ejes: X = a lo largo de la plancha (bandas), Y = alrededor del cilindro (repeticiones).
 */

/** Rectángulo en píxeles de la imagen renderizada. */
export interface RectPx {
  izq: number;
  arr: number;
  der: number;
  aba: number;
}

/** Rectángulo en pulgadas, relativo a la esquina del marco. */
export interface RectIn {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Medidas del marco en pulgadas: anchoIn = eje X, altoIn = eje Y. */
export interface DimIn {
  anchoIn: number;
  altoIn: number;
}

export interface AjusteColor {
  tinta: string;
  rect: RectIn;
  /** Índice de la tinta (para ubicarla en pantalla). */
  indice?: number;
}

/** Medida cobrada escrita a mano para una tinta (pulgadas de plancha, margen incluido). */
export interface MedidaManual {
  tinta: string;
  ancho: number;
  alto: number;
  indice?: number;
}

export interface MedicionArte {
  modo: 'unidad' | 'plancha';
  marco: DimIn;
  general: RectIn;
  ajustes: AjusteColor[];
  /** Zonas propias de tintas sobre la composición completa (pulgadas de plancha, no se repiten). */
  zonasPlancha?: AjusteColor[];
  /** Medidas cobradas escritas a mano: reemplazan lo dibujado de esa tinta. */
  manuales?: MedidaManual[];
  margenIn: number;
  bandasArte?: number;
  repsArte?: number;
}

export interface FilaPlancha {
  largo: number;
  dev: number;
  reps: number;
  bandas: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function normalizarRect(r: RectPx): RectPx {
  return {
    izq: Math.min(r.izq, r.der),
    arr: Math.min(r.arr, r.aba),
    der: Math.max(r.izq, r.der),
    aba: Math.max(r.arr, r.aba),
  };
}

/**
 * Convierte un rectángulo en px a pulgadas relativas al marco, recortado al marco.
 * Con horizontalEsX = false, el eje X del producto corre por el vertical de la imagen.
 */
export function rectPxAIn(rect: RectPx, marco: RectPx, marcoIn: DimIn, horizontalEsX = true): RectIn {
  const r = normalizarRect(rect);
  const m = normalizarRect(marco);
  const izq = clamp(r.izq, m.izq, m.der) - m.izq;
  const der = clamp(r.der, m.izq, m.der) - m.izq;
  const arr = clamp(r.arr, m.arr, m.aba) - m.arr;
  const aba = clamp(r.aba, m.arr, m.aba) - m.arr;
  const anchoPx = m.der - m.izq;
  const altoPx = m.aba - m.arr;

  if (horizontalEsX) {
    const ex = marcoIn.anchoIn / anchoPx;
    const ey = marcoIn.altoIn / altoPx;
    return { x0: izq * ex, x1: der * ex, y0: arr * ey, y1: aba * ey };
  }
  const ex = marcoIn.anchoIn / altoPx;
  const ey = marcoIn.altoIn / anchoPx;
  return { x0: arr * ex, x1: aba * ex, y0: izq * ey, y1: der * ey };
}

export function redondearOctavo(v: number): number {
  return Math.round(v * 8) / 8;
}

/** Área del rectángulo [a0,a1]×[b0,b1] con margen, recortado por lado a [0,ancho]×[0,alto]. */
function areaConMargen(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
  ancho: number,
  alto: number,
  margen: number,
): number {
  const x0 = clamp(a0 - margen, 0, ancho);
  const x1 = clamp(a1 + margen, 0, ancho);
  const y0 = clamp(b0 - margen, 0, alto);
  const y1 = clamp(b1 + margen, 0, alto);
  return Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
}

/**
 * Spec §6.2: rectángulo que se cobra en la plancha, replicando la unidad en
 * bandas × repeticiones, con margen y recortado por lado a la plancha.
 */
export function rectCobradoUnidad(rect: RectIn, fila: FilaPlancha, margenIn: number): RectIn {
  const px = fila.bandas * fila.largo;
  const py = fila.reps * fila.dev;
  const X1 = (fila.bandas - 1) * fila.largo + rect.x1;
  const Y1 = (fila.reps - 1) * fila.dev + rect.y1;
  const x0 = clamp(rect.x0 - margenIn, 0, px);
  const x1 = clamp(X1 + margenIn, 0, px);
  const y0 = clamp(rect.y0 - margenIn, 0, py);
  const y1 = clamp(Y1 + margenIn, 0, py);
  return { x0, x1: Math.max(x0, x1), y0, y1: Math.max(y0, y1) };
}

/** Zona dibujada sobre la plancha completa: + margen, recortada a la plancha. */
export function rectCobradoPlancha(rect: RectIn, fila: FilaPlancha, margenIn: number): RectIn {
  const px = fila.bandas * fila.largo;
  const py = fila.reps * fila.dev;
  const x0 = clamp(rect.x0 - margenIn, 0, px);
  const x1 = clamp(rect.x1 + margenIn, 0, px);
  const y0 = clamp(rect.y0 - margenIn, 0, py);
  const y1 = clamp(rect.y1 + margenIn, 0, py);
  return { x0, x1: Math.max(x0, x1), y0, y1: Math.max(y0, y1) };
}

export function areaUnidad(rect: RectIn, fila: FilaPlancha, margenIn: number): number {
  const r = rectCobradoUnidad(rect, fila, margenIn);
  return (r.x1 - r.x0) * (r.y1 - r.y0);
}

/** Inversa de rectPxAIn: pulgadas relativas al marco → píxeles del arte. */
export function rectInAPx(r: RectIn, marco: RectPx, marcoIn: DimIn, horizontalEsX = true): RectPx {
  const m = normalizarRect(marco);
  const anchoPx = m.der - m.izq;
  const altoPx = m.aba - m.arr;
  if (horizontalEsX) {
    const kx = anchoPx / marcoIn.anchoIn;
    const ky = altoPx / marcoIn.altoIn;
    return { izq: m.izq + r.x0 * kx, der: m.izq + r.x1 * kx, arr: m.arr + r.y0 * ky, aba: m.arr + r.y1 * ky };
  }
  const kx = altoPx / marcoIn.anchoIn;
  const ky = anchoPx / marcoIn.altoIn;
  return { arr: m.arr + r.x0 * kx, aba: m.arr + r.x1 * kx, izq: m.izq + r.y0 * ky, der: m.izq + r.y1 * ky };
}

/** Spec §6.3: el marco ya es la plancha completa. */
export function areaPlancha(rect: RectIn, marco: DimIn, margenIn: number): number {
  return areaConMargen(rect.x0, rect.x1, rect.y0, rect.y1, marco.anchoIn, marco.altoIn, margenIn);
}

/**
 * Área por color: las tintas con zona propia ocupan los primeros índices (primero los ajustes
 * por unidad, luego las zonas sobre la plancha); el resto usa el rectángulo general.
 */
export function areasPorColor(m: MedicionArte, colores: number, fila: FilaPlancha): number[] {
  const area = (r: RectIn) =>
    m.modo === 'unidad' ? areaUnidad(r, fila, m.margenIn) : areaPlancha(r, m.marco, m.margenIn);
  const propias = [
    ...m.ajustes.map((a) => area(a.rect)),
    ...(m.zonasPlancha ?? []).map((z) => {
      const r = rectCobradoPlancha(z.rect, fila, m.margenIn);
      return (r.x1 - r.x0) * (r.y1 - r.y0);
    }),
  ];
  for (const mm of m.manuales ?? []) propias.push(areaManual(mm, fila));
  const general = area(m.general);
  return Array.from({ length: colores }, (_, i) => propias[i] ?? general);
}

/** Área de una medida manual, recortada a la plancha de la fila. */
export function areaManual(mm: Pick<MedidaManual, 'ancho' | 'alto'>, fila: FilaPlancha): number {
  const px = fila.bandas * fila.largo;
  const py = fila.reps * fila.dev;
  return clamp(mm.ancho, 0, px) * clamp(mm.alto, 0, py);
}

/**
 * Arte de solo el frente con dorso impreso: la impresión se repite en el dorso,
 * `desplazamiento` pulgadas más adelante (el largo de la bolsa).
 */
export function conDorso(m: MedicionArte, desplazamiento: number): MedicionArte {
  const extender = (r: RectIn): RectIn => ({ ...r, x1: r.x1 + desplazamiento });
  return {
    ...m,
    general: extender(m.general),
    ajustes: m.ajustes.map((a) => ({ ...a, rect: extender(a.rect) })),
  };
}
