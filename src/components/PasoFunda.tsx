import React, { useEffect, useState } from 'react';
import { mangaMasCercana } from '../lib/costo';
import { presionable } from './BarraNavegacion';
import { bandasSugeridas, largoEnPlancha, type LargoEs } from '../lib/funda';
import { aPulgadas, desdePulgadas, mismaMedida, mostrarMedida, type Unidad } from '../lib/unidades';

export interface DatosFunda {
  tipo: 'funda' | 'rollo';
  /** Ancho de funda (fundas) o distancia entre marquillas (rollos): define la manga. */
  medidaManga: string;
  largo: string;
  bandas: string;
  colores: string;
  /** Fundas: el largo escrito es el de la bolsa (lámina = frente + dorso) o la lámina completa. */
  largoEs: LargoEs;
  /** Fundas: el dorso lleva impresión. */
  dorsoImpreso: boolean;
}

interface Props {
  datos: DatosFunda;
  onCambio: (c: Partial<DatosFunda>) => void;
  onLargo: (v: string) => void;
  error: string | null;
  /** Unidad en que se escriben las medidas (la app guarda siempre pulgadas). */
  unidad: Unidad;
  onUnidad: (u: Unidad) => void;
}

/** Texto del campo en la unidad elegida, sincronizado con el valor guardado en pulgadas. */
function useTextoEnUnidad(pulg: string, unidad: Unidad, alCambiar: (pulg: string) => void) {
  const [txt, setTxt] = useState(() => desdePulgadas(pulg, unidad));
  // Si cambia la unidad o el valor desde fuera (p. ej. "Nuevo trabajo"), se reescribe;
  // si es el mismo valor que se está tecleando, se deja como está.
  useEffect(() => {
    setTxt((t) => (mismaMedida(t, pulg, unidad) ? t : desdePulgadas(pulg, unidad)));
  }, [pulg, unidad]);
  const cambiar = (v: string) => {
    setTxt(v);
    alCambiar(aPulgadas(v, unidad));
  };
  return [txt, cambiar] as const;
}

/** Campo numérico: etiqueta, una línea de ayuda y el input, siempre con la misma altura. */
function Campo({
  id,
  etiqueta,
  ayuda,
  destacada = false,
  unidad,
  value,
  onChange,
  ...resto
}: {
  id: string;
  etiqueta: string;
  ayuda: string;
  destacada?: boolean;
  unidad?: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange'>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-neutral-800">
        {etiqueta}
      </label>
      <p
        className={`mt-0.5 mb-2 text-xs truncate ${destacada ? 'font-bold text-brand-600' : 'text-neutral-500'}`}
        title={ayuda}
      >
        {ayuda}
      </p>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-14 px-4 ${unidad ? 'pr-14' : ''} text-lg tabular-nums rounded-2xl border outline-none transition-[background-color,border-color,box-shadow] duration-150 ease-out focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
            destacada ? 'bg-brand-50/40 border-brand-200' : 'bg-neutral-50 border-neutral-200'
          }`}
          {...resto}
        />
        {unidad && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
            {unidad}
          </span>
        )}
      </div>
    </div>
  );
}

/** Interruptor segmentado con título y una nota debajo. */
function Segmentado<T extends string | boolean>({
  titulo,
  opciones,
  valor,
  onCambio,
  nota,
}: {
  titulo: string;
  opciones: [T, string][];
  valor: T;
  onCambio: (v: T) => void;
  nota: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-neutral-600">{titulo}</p>
      <div className="grid grid-cols-2 bg-neutral-200/70 rounded-xl p-1 gap-1 text-xs">
        {opciones.map(([v, t]) => (
          <button
            key={String(v)}
            onClick={() => onCambio(v)}
            aria-pressed={valor === v}
            className={`h-9 px-3 rounded-lg font-bold whitespace-nowrap ${presionable} ${
              valor === v ? 'bg-white text-brand-700 shadow' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-neutral-500">{nota}</p>
    </div>
  );
}

export default function PasoFunda({ datos, onCambio, onLargo, error, unidad, onUnidad }: Props) {
  const [txtManga, setTxtManga] = useTextoEnUnidad(datos.medidaManga, unidad, (v) => onCambio({ medidaManga: v }));
  const [txtLargo, setTxtLargo] = useTextoEnUnidad(datos.largo, unidad, onLargo);
  const med = (pulg: number, dec = 3) => mostrarMedida(pulg, unidad, dec);
  const enMm = unidad === 'mm';
  const manga = mangaMasCercana(parseFloat(datos.medidaManga), datos.tipo);
  const lamina = largoEnPlancha(datos.tipo, parseFloat(datos.largo), datos.largoEs);
  const bandasMax = bandasSugeridas(lamina);
  const etiquetaManga = datos.tipo === 'funda' ? 'Ancho de funda' : 'Distancia entre marquillas';
  const etiquetaLargo = datos.tipo === 'funda' ? 'Largo de funda' : 'Ancho del rollo';

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
      <div className="p-4 bg-neutral-50 border-b border-neutral-200">
        <div className="flex flex-wrap gap-3">
        <div className="flex flex-1 min-w-[16rem] bg-neutral-200/70 rounded-xl p-1 gap-1">
        {(['funda', 'rollo'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onCambio({ tipo: t })}
            aria-pressed={datos.tipo === t}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold ${presionable} ${
              datos.tipo === t ? 'bg-white text-brand-700 shadow' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {t === 'rollo' ? 'Rollos / Láminas' : 'Fundas'}
          </button>
        ))}
        </div>
        <div className="flex bg-neutral-200/70 rounded-xl p-1 gap-1" role="group" aria-label="Unidad de medida">
          {(['pulg', 'mm'] as const).map((u) => (
            <button
              key={u}
              onClick={() => onUnidad(u)}
              aria-pressed={unidad === u}
              title={u === 'pulg' ? 'Escribir las medidas en pulgadas' : 'Escribir las medidas en milímetros'}
              className={`w-16 py-2 rounded-lg text-sm font-bold ${presionable} ${
                unidad === u ? 'bg-white text-brand-700 shadow' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <Campo
            id="medida-manga"
            etiqueta={etiquetaManga}
            ayuda="Define la manga · alrededor del cilindro"
            destacada
            unidad={unidad}
            step={enMm ? '0.01' : '0.001'}
            placeholder={enMm ? 'Ej. 247.65' : 'Ej. 9.75'}
            value={txtManga}
            onChange={setTxtManga}
          />
          <Campo
            id="largo"
            etiqueta={etiquetaLargo}
            ayuda={
              datos.tipo === 'funda' && datos.largoEs === 'bolsa'
                ? 'Tamaño de la bolsa (una cara)'
                : `A lo largo de la plancha · máx. ${med(50, 0)}`
            }
            unidad={unidad}
            step={enMm ? '0.01' : '0.001'}
            placeholder={enMm ? 'Ej. 736.6' : 'Ej. 29'}
            value={txtLargo}
            onChange={setTxtLargo}
          />

          {/* Manga más cercana: misma altura que la fila de Bandas / Colores */}
          <div
            aria-live="polite"
            className={`rounded-2xl px-5 py-4 border flex flex-col justify-center ${
              manga ? 'bg-brand-50 border-brand-100' : 'bg-neutral-50 border-dashed border-neutral-200'
            }`}
          >
            {manga ? (
              <>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Manga más cercana</span>
                <span className="mt-1 text-brand-950">
                  <span className="font-black text-2xl tabular-nums">{manga.manga} mm</span>
                  <span className="font-bold tabular-nums"> · {manga.reps} rep · {med(manga.dev)}</span>
                </span>
              </>
            ) : (
              <span className="text-sm text-neutral-400">
                Escribe {datos.tipo === 'funda' ? 'el' : 'la'} {etiquetaManga.toLowerCase()} para ver la manga más cercana.
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Campo
              id="bandas"
              etiqueta="Bandas"
              ayuda={bandasMax ? `Caben hasta ${bandasMax}` : 'A lo largo de la plancha'}
              placeholder="Cant."
              min="1"
              value={datos.bandas}
              onChange={(v) => onCambio({ bandas: v })}
            />
            <Campo
              id="colores"
              etiqueta="Colores"
              ayuda="De 1 a 8"
              placeholder="1 – 8"
              min="1"
              max="8"
              value={datos.colores}
              onChange={(v) => onCambio({ colores: v })}
            />
          </div>
        </div>

        {datos.tipo === 'funda' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
            <Segmentado
              titulo="El largo escrito es:"
              opciones={[
                ['bolsa', 'Bolsa (frente + dorso)'],
                ['lamina', 'Lámina completa'],
              ]}
              valor={datos.largoEs}
              onCambio={(v) => onCambio({ largoEs: v })}
              nota={
                lamina > 0 ? (
                  <span className="font-bold text-brand-700">
                    Lámina en plancha: {med(lamina)}
                    {datos.largoEs === 'bolsa' &&
                      ` (${med(parseFloat(datos.largo))} frente + ${med(parseFloat(datos.largo))} dorso)`} →{' '}
                    {bandasMax === null ? `no cabe en ${med(50, 0)}` : `máx. ${bandasMax} banda(s)`}
                  </span>
                ) : (
                  'Con bolsa, la lámina en plancha es el doble del largo.'
                )
              }
            />
            {datos.largoEs === 'bolsa' && (
              <Segmentado
                titulo="¿El dorso lleva impresión?"
                opciones={[
                  [true, 'Sí, dorso impreso'],
                  [false, 'No, solo el frente'],
                ]}
                valor={datos.dorsoImpreso}
                onCambio={(v) => onCambio({ dorsoImpreso: v })}
                nota="Se usa cuando el arte muestra solo el frente: la impresión se repite en el dorso."
              />
            )}
          </div>
        )}

        {error && (datos.medidaManga || datos.largo || datos.colores) && (
          <p className="text-xs font-bold text-amber-700">Para seguir: {error}</p>
        )}

      </div>
    </section>
  );
}
