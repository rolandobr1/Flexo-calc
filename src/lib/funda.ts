/**
 * Reglas del tamaño de la funda en la plancha.
 * Las fundas se imprimen abiertas: frente + dorso lado a lado, luego se cortan y sellan.
 */
import { MAX_PLATE_LENGTH } from './costo';

export type LargoEs = 'bolsa' | 'lamina';

/** Largo que ocupa una unidad a lo largo de la plancha (el refile no cuenta). */
export function largoEnPlancha(tipo: 'funda' | 'rollo', largo: number, largoEs: LargoEs): number {
  return tipo === 'funda' && largoEs === 'bolsa' ? largo * 2 : largo;
}

/** Bandas que caben en la plancha de 50" (null si el largo no es válido o no cabe). */
export function bandasSugeridas(largoPlancha: number): number | null {
  if (!(largoPlancha > 0) || largoPlancha > MAX_PLATE_LENGTH) return null;
  return Math.floor(MAX_PLATE_LENGTH / largoPlancha);
}

/**
 * Largo del marco que se dibuja en el arte: la lámina completa, o solo la bolsa
 * cuando el arte muestra únicamente el frente.
 */
export function largoDelMarco(tipo: 'funda' | 'rollo', largo: number, largoEs: LargoEs, soloFrente: boolean): number {
  if (tipo === 'funda' && largoEs === 'bolsa' && soloFrente) return largo;
  return largoEnPlancha(tipo, largo, largoEs);
}

/**
 * ¿El marco dibujado sobre el arte es una sola cara de la bolsa o la lámina completa (frente + dorso)?
 * Se compara su proporción (a lo largo ÷ alrededor) con la de una cara (largo ÷ ancho) y la de la
 * lámina (2 × largo ÷ ancho). null si no se distingue con claridad o faltan datos.
 */
export function carasSegunMarco(
  anchoPx: number,
  altoPx: number,
  horizontalEsX: boolean,
  largoBolsa: number,
  anchoFunda: number,
): 'frente' | 'lamina' | null {
  if (!(anchoPx > 0) || !(altoPx > 0) || !(largoBolsa > 0) || !(anchoFunda > 0)) return null;
  const alLargo = horizontalEsX ? anchoPx : altoPx;
  const alrededor = horizontalEsX ? altoPx : anchoPx;
  const medida = alLargo / alrededor;
  const dFrente = Math.abs(Math.log(medida / (largoBolsa / anchoFunda)));
  const dLamina = Math.abs(Math.log(medida / ((2 * largoBolsa) / anchoFunda)));
  const TOLERANCIA = 0.25; // ~28 %: las dos opciones están a un factor 2 (ln 2 ≈ 0.69) una de otra
  if (Math.min(dFrente, dLamina) > TOLERANCIA) return null;
  return dFrente < dLamina ? 'frente' : 'lamina';
}
