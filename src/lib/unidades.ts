/**
 * Unidad de las medidas que se escriben en el paso ①.
 * Internamente la app trabaja siempre en pulgadas (las mangas y la plancha se miden en pulgadas);
 * aquí solo se convierte lo que se escribe y lo que se muestra.
 */
export type Unidad = 'pulg' | 'mm';

export const MM_POR_PULGADA = 25.4;

const numero = (txt: string) => parseFloat(txt.replace(',', '.'));
const limpio = (v: number, decimales: number) => String(+v.toFixed(decimales));

/** Texto escrito en `unidad` → texto en pulgadas (lo que guarda la app). */
export function aPulgadas(txt: string, unidad: Unidad): string {
  if (unidad === 'pulg') return txt;
  const v = numero(txt);
  if (!Number.isFinite(v)) return txt; // vacío o a medio escribir: se deja tal cual
  return limpio(v / MM_POR_PULGADA, 6);
}

/** Texto en pulgadas → texto para mostrar en `unidad`. */
export function desdePulgadas(pulg: string, unidad: Unidad): string {
  if (unidad === 'pulg') return pulg;
  const v = numero(pulg);
  if (!Number.isFinite(v)) return pulg;
  return limpio(v * MM_POR_PULGADA, 2);
}

/** El texto escrito corresponde al valor guardado (para no reescribir lo que el usuario teclea). */
export function mismaMedida(txt: string, pulg: string, unidad: Unidad): boolean {
  const a = numero(aPulgadas(txt, unidad));
  const b = numero(pulg);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return txt.trim() === '' && pulg.trim() === '';
  return Math.abs(a - b) < 1e-4;
}

/** Medida en pulgadas mostrada en la unidad elegida: 9.75" o 247.65 mm. */
export function mostrarMedida(pulg: number, unidad: Unidad, decimalesPulg = 3): string {
  return unidad === 'mm' ? `${limpio(pulg * MM_POR_PULGADA, 2)} mm` : `${limpio(pulg, decimalesPulg)}"`;
}
