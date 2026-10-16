/**
 * Estado del medidor de arte: reducer puro (sin React).
 */
import { normalizarRect, rectPxAIn, redondearOctavo, type DimIn, type MedicionArte, type RectIn, type RectPx } from '../lib/medicion';

export type Objetivo = 'marco' | 'general';

/** Una tinta por color; sin zona propia usa el rectángulo general. */
export interface Tinta {
  nombre: string;
  propia: boolean;
  /** Zona propia sobre la composición completa, en pulgadas de plancha (no se repite). */
  zona: RectIn | null;
  /** Medida cobrada escrita a mano (pulgadas, margen incluido); reemplaza lo dibujado. */
  manual?: { ancho: number; alto: number };
}
/** ai = arriba-izquierda, ad = arriba-derecha, bi = abajo-izquierda, bd = abajo-derecha. */
export type Esquina = 'ai' | 'ad' | 'bi' | 'bd';

export interface EstadoMedidor {
  modo: 'unidad' | 'plancha';
  /** El arte muestra solo el frente de la funda (no la lámina completa). */
  soloFrente: boolean;
  paso: 'marco' | 'impresion';
  horizontalEsX: boolean;
  margenIn: number;
  marcoPx: RectPx | null;
  marcoIn: DimIn | null;
  marcoConfirmado: boolean;
  generalPx: RectPx | null;
  /** Tintas guardadas; solo las primeras `nTintas` están visibles y cuentan. */
  tintas: Tinta[];
  nTintas: number;
  /** null = pestaña General. */
  tintaActiva: number | null;
  /** Pulgadas por píxel si el arte es un PDF a escala. */
  escalaPdf: number | null;
  /** Medidas del marco tal como se ven/escriben en el paso ② (antes de confirmar). */
  marcoTxt: { ancho: string; alto: string };
  bandasArte: number;
  repsArte: number;
}

export type AccionMedidor =
  | { t: 'NUEVO_ARTE' }
  | { t: 'MODO'; modo: 'unidad' | 'plancha' }
  | { t: 'SOLO_FRENTE'; soloFrente: boolean; conservarMarco?: boolean }
  | { t: 'ORIENTACION'; horizontalEsX: boolean }
  | { t: 'DIBUJAR'; rect: RectPx }
  | { t: 'MOVER'; obj: Objetivo; dx: number; dy: number }
  | { t: 'REDIMENSIONAR'; obj: Objetivo; esquina: Esquina; x: number; y: number }
  | { t: 'BORRAR'; obj: Objetivo }
  | { t: 'CONFIRMAR_MARCO'; dim: DimIn }
  | { t: 'EDITAR_MARCO' }
  | { t: 'SINCRONIZAR_TINTAS'; n: number }
  | { t: 'NOMBRE_TINTA'; i: number; nombre: string }
  | { t: 'NOMBRES_TINTAS'; nombres: string[] }
  | { t: 'ZONA_PROPIA'; i: number; propia: boolean }
  | { t: 'TINTA_ACTIVA'; i: number | null }
  | { t: 'ZONA_TINTA'; i: number; rect: RectIn }
  | { t: 'MEDIDA_MANUAL'; i: number; manual: { ancho: number; alto: number } | null }
  | { t: 'ESCALA_PDF'; pulgadasPorPx: number | null }
  | { t: 'MARCO_TXT'; ancho: string; alto: string }
  | { t: 'REINICIAR' }
  | { t: 'MARGEN'; margenIn: number }
  | { t: 'ARTE_GRID'; bandasArte: number; repsArte: number };

export const estadoInicial: EstadoMedidor = {
  modo: 'unidad',
  soloFrente: false,
  paso: 'marco',
  horizontalEsX: true,
  margenIn: 1,
  marcoPx: null,
  marcoIn: null,
  marcoConfirmado: false,
  generalPx: null,
  tintas: [],
  nTintas: 0,
  tintaActiva: null,
  escalaPdf: null,
  marcoTxt: { ancho: '', alto: '' },
  bandasArte: 1,
  repsArte: 1,
};

/** Tamaño mínimo (px) para aceptar un rectángulo dibujado. */
const MIN_PX = 4;

const muyChico = (r: RectPx) => r.der - r.izq < MIN_PX || r.aba - r.arr < MIN_PX;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function recortar(r: RectPx, m: RectPx | null): RectPx {
  const n = normalizarRect(r);
  if (!m) return n;
  return {
    izq: clamp(n.izq, m.izq, m.der),
    arr: clamp(n.arr, m.arr, m.aba),
    der: clamp(n.der, m.izq, m.der),
    aba: clamp(n.aba, m.arr, m.aba),
  };
}

const fmt = (v: number) => String(+v.toFixed(3));

/** Campos que se reinician cuando el marco deja de ser válido y hay que redibujarlo. */
const sinMarco = {
  marcoPx: null,
  marcoIn: null,
  marcoConfirmado: false,
  paso: 'marco' as const,
  marcoTxt: { ancho: '', alto: '' },
};

export function tintasVisibles(s: EstadoMedidor): Tinta[] {
  return s.tintas.slice(0, s.nTintas);
}

/** En PDF a escala, las medidas propuestas siguen al marco mientras no esté confirmado. */
function conMedidaPdf(s: EstadoMedidor): EstadoMedidor {
  if (!s.escalaPdf || !s.marcoPx || s.marcoConfirmado) return s;
  const d = medidaMarcoPdf(s.marcoPx, s.escalaPdf, s.horizontalEsX);
  return { ...s, marcoTxt: { ancho: fmt(d.anchoIn), alto: fmt(d.altoIn) } };
}

function leer(s: EstadoMedidor, obj: Objetivo): RectPx | null {
  if (obj === 'marco') return s.marcoPx;
  return s.generalPx;
}

function escribir(s: EstadoMedidor, obj: Objetivo, rect: RectPx | null): EstadoMedidor {
  if (obj === 'marco') return conMedidaPdf({ ...s, marcoPx: rect, marcoConfirmado: false, paso: 'marco' });
  return { ...s, generalPx: rect };
}

function mover(r: RectPx, dx: number, dy: number, m: RectPx | null): RectPx {
  const w = r.der - r.izq;
  const h = r.aba - r.arr;
  let izq = r.izq + dx;
  let arr = r.arr + dy;
  if (m) {
    izq = clamp(izq, m.izq, m.der - w);
    arr = clamp(arr, m.arr, m.aba - h);
  }
  return { izq, arr, der: izq + w, aba: arr + h };
}

export function medidorReducer(s: EstadoMedidor, a: AccionMedidor): EstadoMedidor {
  switch (a.t) {
    case 'NUEVO_ARTE':
      return {
        ...estadoInicial,
        modo: s.modo,
        // Cada arte decide si muestra solo el frente: no se hereda del trabajo anterior.
        soloFrente: false,
        horizontalEsX: s.horizontalEsX,
        margenIn: s.margenIn,
        bandasArte: s.bandasArte,
        repsArte: s.repsArte,
        tintas: s.tintas.map((t) => ({ nombre: t.nombre, propia: true, zona: null })),
        nTintas: s.nTintas,
      };
    case 'REINICIAR':
      return estadoInicial;
    case 'ESCALA_PDF':
      return conMedidaPdf({ ...s, escalaPdf: a.pulgadasPorPx });
    case 'MARCO_TXT':
      return { ...s, marcoTxt: { ancho: a.ancho, alto: a.alto } };
    case 'MODO':
      if (a.modo === s.modo) return s;
      // El marco y la unidad cambian: se borran el marco y las zonas (se vuelven a marcar en el montaje).
      return {
        ...s,
        modo: a.modo,
        ...sinMarco,
        generalPx: null,
        tintas: s.tintas.map((t) => ({ nombre: t.nombre, propia: true, zona: null })),
      };
    case 'SOLO_FRENTE':
      if (a.soloFrente === s.soloFrente) return s;
      // Corrección sugerida por la proporción del marco: el marco dibujado ya es el correcto.
      if (a.conservarMarco) return { ...s, soloFrente: a.soloFrente, marcoConfirmado: false, paso: 'marco' };
      // El marco abarcaba otra zona (lámina vs. frente): se borra para redibujarlo.
      return { ...s, soloFrente: a.soloFrente, ...sinMarco };
    case 'ORIENTACION':
      return conMedidaPdf({ ...s, horizontalEsX: a.horizontalEsX, marcoConfirmado: false, paso: 'marco' });
    case 'MARGEN':
      return { ...s, margenIn: Math.max(0, a.margenIn) };
    case 'ARTE_GRID':
      return { ...s, bandasArte: a.bandasArte, repsArte: a.repsArte };

    case 'DIBUJAR': {
      const n = normalizarRect(a.rect);
      if (muyChico(n)) return s;
      if (s.paso === 'marco') return conMedidaPdf({ ...s, marcoPx: n, marcoConfirmado: false });
      const rect = recortar(n, s.marcoPx);
      if (muyChico(rect)) return s;
      return { ...s, generalPx: rect };
    }

    case 'MOVER': {
      const r = leer(s, a.obj);
      if (!r) return s;
      return escribir(s, a.obj, mover(r, a.dx, a.dy, a.obj === 'marco' ? null : s.marcoPx));
    }

    case 'REDIMENSIONAR': {
      const r = leer(s, a.obj);
      if (!r) return s;
      const nuevo = { ...r };
      if (a.esquina[0] === 'a') nuevo.arr = a.y;
      else nuevo.aba = a.y;
      if (a.esquina[1] === 'i') nuevo.izq = a.x;
      else nuevo.der = a.x;
      const rect = recortar(nuevo, a.obj === 'marco' ? null : s.marcoPx);
      if (muyChico(rect)) return s;
      return escribir(s, a.obj, rect);
    }

    case 'BORRAR': {
      if (a.obj === 'marco') return { ...s, marcoPx: null, marcoIn: null, marcoConfirmado: false, paso: 'marco' };
      return { ...s, generalPx: null };
    }

    case 'CONFIRMAR_MARCO':
      if (!s.marcoPx) return s;
      return {
        ...s,
        marcoIn: a.dim,
        marcoConfirmado: true,
        paso: 'impresion',
        marcoTxt: { ancho: fmt(a.dim.anchoIn), alto: fmt(a.dim.altoIn) },
      };
    case 'EDITAR_MARCO':
      return { ...s, marcoConfirmado: false, paso: 'marco' };

    case 'SINCRONIZAR_TINTAS': {
      const n = Math.max(0, Math.floor(a.n) || 0);
      if (n === s.nTintas && s.tintas.length >= n) return s;
      // Las tintas de más se guardan ocultas: bajar y volver a subir no pierde nombres ni zonas.
      const largo = Math.max(n, s.tintas.length);
      const tintas = Array.from({ length: largo }, (_, i) => s.tintas[i] ?? { nombre: `Tinta ${i + 1}`, propia: true, zona: null });
      const tintaActiva = s.tintaActiva !== null && s.tintaActiva < n ? s.tintaActiva : null;
      return { ...s, tintas, nTintas: n, tintaActiva };
    }
    case 'NOMBRE_TINTA':
      return { ...s, tintas: s.tintas.map((t, j) => (j === a.i ? { ...t, nombre: a.nombre } : t)) };
    case 'NOMBRES_TINTAS':
      return {
        ...s,
        tintas: Array.from({ length: Math.max(s.tintas.length, a.nombres.length) }, (_, j) => {
          const t = s.tintas[j] ?? { nombre: `Tinta ${j + 1}`, propia: true, zona: null };
          return a.nombres[j] ? { ...t, nombre: a.nombres[j] } : t;
        }),
      };
    case 'ZONA_PROPIA':
      return {
        ...s,
        tintas: s.tintas.map((t, j) => (j === a.i ? { ...t, propia: a.propia, zona: a.propia ? t.zona : null } : t)),
      };
    case 'TINTA_ACTIVA':
      return { ...s, tintaActiva: a.i !== null && a.i < s.nTintas ? a.i : null };
    case 'ZONA_TINTA': {
      const z = a.rect;
      const n = { x0: Math.min(z.x0, z.x1), x1: Math.max(z.x0, z.x1), y0: Math.min(z.y0, z.y1), y1: Math.max(z.y0, z.y1) };
      if (n.x1 - n.x0 < 0.05 || n.y1 - n.y0 < 0.05 || !s.tintas[a.i]) return s;
      return { ...s, tintas: s.tintas.map((t, j) => (j === a.i ? { nombre: t.nombre, propia: true, zona: n } : t)) };
    }
    case 'MEDIDA_MANUAL': {
      const t = s.tintas[a.i];
      if (!t) return s;
      if (a.manual === null) {
        const { manual: _quitar, ...resto } = t;
        return { ...s, tintas: s.tintas.map((x, j) => (j === a.i ? resto : x)) };
      }
      const { ancho, alto } = a.manual;
      if (!(ancho > 0) || !(alto > 0)) return s;
      return { ...s, tintas: s.tintas.map((x, j) => (j === a.i ? { ...x, manual: { ancho, alto } } : x)) };
    }

  }
}

/**
 * Marco de UNA unidad (px del arte y pulgadas). Si el arte es la plancha completa,
 * es la primera unidad (arriba a la izquierda): marco ÷ bandas y repeticiones del arte.
 */
export function unidadDeArte(s: EstadoMedidor): { px: RectPx; dim: DimIn } | null {
  if (!s.marcoConfirmado || !s.marcoPx || !s.marcoIn) return null;
  const m = normalizarRect(s.marcoPx);
  if (s.modo === 'unidad') return { px: m, dim: s.marcoIn };
  const b = Math.max(1, s.bandasArte);
  const r = Math.max(1, s.repsArte);
  const anchoPx = m.der - m.izq;
  const altoPx = m.aba - m.arr;
  // Eje X (bandas) = horizontal de la imagen salvo que la orientación sea vertical.
  const w = s.horizontalEsX ? anchoPx / b : anchoPx / r;
  const h = s.horizontalEsX ? altoPx / r : altoPx / b;
  return {
    px: { izq: m.izq, arr: m.arr, der: m.izq + w, aba: m.arr + h },
    dim: { anchoIn: s.marcoIn.anchoIn / b, altoIn: s.marcoIn.altoIn / r },
  };
}

/**
 * Medición en coordenadas de una unidad. Las zonas se dibujan sobre una unidad
 * (en el montaje), así que el costo es exacto para cualquier manga.
 */
export function aMedicion(s: EstadoMedidor): MedicionArte | null {
  const u = unidadDeArte(s);
  if (!u) return null;
  const visibles = tintasVisibles(s);
  const manuales = visibles.flatMap((t, indice) =>
    t.manual ? [{ tinta: t.nombre, ancho: t.manual.ancho, alto: t.manual.alto, indice }] : [],
  );
  const zonasPlancha = visibles.flatMap((t, indice) =>
    !t.manual && t.propia && t.zona ? [{ tinta: t.nombre, rect: t.zona, indice }] : [],
  );
  if (!s.generalPx && zonasPlancha.length === 0 && manuales.length === 0) return null;
  // Sin zona general, el resto de las tintas cubre la unidad completa.
  const general = s.generalPx
    ? rectPxAIn(s.generalPx, u.px, u.dim, s.horizontalEsX)
    : { x0: 0, x1: u.dim.anchoIn, y0: 0, y1: u.dim.altoIn };
  return {
    modo: 'unidad',
    marco: u.dim,
    general,
    ajustes: [],
    zonasPlancha,
    ...(manuales.length ? { manuales } : {}),
    margenIn: s.margenIn,
  };
}

/** Medida del marco en un PDF a escala, redondeada a 1/8". anchoIn = eje X del producto. */
export function medidaMarcoPdf(marcoPx: RectPx, pulgadasPorPx: number, horizontalEsX: boolean): DimIn {
  const n = normalizarRect(marcoPx);
  const h = (n.der - n.izq) * pulgadasPorPx;
  const v = (n.aba - n.arr) * pulgadasPorPx;
  return horizontalEsX
    ? { anchoIn: redondearOctavo(h), altoIn: redondearOctavo(v) }
    : { anchoIn: redondearOctavo(v), altoIn: redondearOctavo(h) };
}

/**
 * Medidas del marco a partir del paso ① (la única fuente del tamaño de la funda).
 * anchoIn = a lo largo de la plancha, altoIn = alrededor del cilindro.
 */
export function marcoDesdeFunda(
  modo: 'unidad' | 'plancha',
  largo: number,
  anchoManga: number,
  bandasArte: number,
  repsArte: number,
): DimIn | null {
  if (!(largo > 0) || !(anchoManga > 0)) return null;
  if (modo === 'unidad') return { anchoIn: largo, altoIn: anchoManga };
  if (!(bandasArte > 0) || !(repsArte > 0)) return null;
  return { anchoIn: largo * bandasArte, altoIn: anchoManga * repsArte };
}

/** true si alguna medida difiere más de 1/8". */
export function difiereMedida(a: DimIn, b: DimIn): boolean {
  const tol = 0.125 + 1e-9;
  return Math.abs(a.anchoIn - b.anchoIn) > tol || Math.abs(a.altoIn - b.altoIn) > tol;
}
