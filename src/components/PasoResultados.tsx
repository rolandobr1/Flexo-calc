/**
 * Paso ④: resultados calculados automáticamente con los datos actuales
 * (nunca quedan resultados viejos).
 */
import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Table as TableIcon } from 'lucide-react';
import { alternativas, calcularConfiguraciones, validarEntrada } from '../lib/costo';
import { largoEnPlancha } from '../lib/funda';
import type { MedicionArte } from '../lib/medicion';
import type { DatosFunda } from './PasoFunda';

interface Props {
  datos: DatosFunda;
  medicion: MedicionArte | null;
  onIrFunda: () => void;
}

export default function PasoResultados({ datos, medicion, onIrFunda }: Props) {
  const calculo = useMemo(() => {
    const entrada = {
      ancho: parseFloat(datos.medidaManga),
      largo: largoEnPlancha(datos.tipo, parseFloat(datos.largo), datos.largoEs),
      colores: parseInt(datos.colores),
      bandas: parseInt(datos.bandas),
      tipo: datos.tipo,
      medicion,
    };
    const error = validarEntrada(entrada);
    if (error) return { error, results: null };
    const results = calcularConfiguraciones(entrada);
    if (results.length === 0) return { error: `No existen mangas cercanas sugeridas para ${entrada.ancho}".`, results: null };
    return { error: null, results };
  }, [datos, medicion]);

  const { error, results } = calculo;
  const largoPlancha = largoEnPlancha(datos.tipo, parseFloat(datos.largo), datos.largoEs);
  const bestOption = results ? results[0] : null;
  const tabla = results ? alternativas(results, parseFloat(datos.medidaManga)) : [];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-neutral-200 px-4 py-3 text-sm">
        <span className="font-bold text-neutral-700">
          {datos.tipo === 'funda'
            ? `Funda: ancho ${datos.medidaManga || '—'}" × largo ${datos.largo || '—'}"${
                datos.largoEs === 'bolsa' && datos.largo ? ` (lámina ${+(parseFloat(datos.largo) * 2).toFixed(3)}", dorso ${datos.dorsoImpreso ? 'impreso' : 'sin impresión'})` : ''
              }`
            : `Rollo: marquillas ${datos.medidaManga || '—'}" × ancho ${datos.largo || '—'}"`}{' '}
          · {datos.bandas || '—'} banda(s) ·{' '}
          {datos.colores || '—'} colores ·{' '}
          {medicion ? `zona medida (margen ${medicion.margenIn}")` : 'área completa (sin medición)'}
        </span>
        <button onClick={onIrFunda} className="ml-auto text-xs font-bold text-brand-600 hover:underline">
          Editar tamaño en Funda
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {results && bestOption && (
        <>
              {/* Mejor opción: el montaje (bandas × repeticiones) junto al precio */}
              <div className="bg-emerald-600 rounded-3xl shadow-xl p-6 sm:p-8 text-white">
                <div className="flex items-center gap-2 bg-white/20 w-fit px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" />
                  Mejor Opción Recomendada
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 lg:gap-10 items-center">
                  {/* Montaje */}
                  <div className="flex flex-wrap items-center gap-5 sm:gap-8">
                    <EsquemaMontaje bandas={bestOption.bands} reps={bestOption.reps} />
                    <div className="flex items-end gap-3 sm:gap-5" aria-label={`${bestOption.bands} bandas por ${bestOption.reps} repeticiones`}>
                      <Cifra valor={bestOption.bands} etiqueta={bestOption.bands === 1 ? 'banda' : 'bandas'} nota="a lo largo" />
                      <span className="text-4xl sm:text-5xl font-black text-emerald-200 pb-7">×</span>
                      <Cifra valor={bestOption.reps} etiqueta={bestOption.reps === 1 ? 'repetición' : 'repeticiones'} nota="alrededor" />
                    </div>
                  </div>

                  {/* Precio */}
                  <div className="lg:text-right lg:border-l lg:border-white/20 lg:pl-10">
                    <h3 className="text-4xl sm:text-5xl font-black tabular-nums">
                      ${bestOption.costoTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <p className="text-emerald-100">Costo total · {datos.colores} colores</p>
                    {medicion && (
                      <p className="text-emerald-100 text-sm opacity-90">
                        Área cobrada: {bestOption.area.toFixed(1)} pulg² por color
                        {bestOption.estimado && ' (estimado)'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-white/20 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <Dato etiqueta="Manga" valor={`${bestOption.manga} mm`} />
                  <Dato etiqueta="Desarrollo" valor={`${bestOption.exactDev.toFixed(3)}"`} />
                  <Dato
                    etiqueta="Plancha"
                    valor={`${+(bestOption.bands * largoPlancha).toFixed(2)}" × ${+(bestOption.reps * bestOption.exactDev).toFixed(2)}"`}
                  />
                  <Dato etiqueta="Unidades por vuelta" valor={String(bestOption.bands * bestOption.reps)} />
                </div>
              </div>

        {/* Comparison Table */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-neutral-700">
                  <TableIcon className="w-5 h-5" />
                  <h2 className="text-xl font-bold tracking-tight">Comparativa de Opciones</h2>
                  <span className="text-xs text-neutral-400 font-normal ml-1">
                    — 2 por debajo y 2 por encima de {datos.medidaManga}" (la mejor opción está arriba)
                  </span>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200">
                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Manga (mm)</th>
                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-neutral-800">Bandas × Rep.</th>
                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Desarrollo</th>
                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Diferencia</th>
                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-neutral-500">Costo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {tabla.map((item) => {
                        const signedDiff = item.exactDev - parseFloat(datos.medidaManga);
                        const diffLabel = signedDiff === 0
                          ? 'Exacto'
                          : `${signedDiff > 0 ? '+' : ''}${signedDiff.toFixed(3)}"`;
                        const diffColor = signedDiff > 0
                          ? 'text-sky-700 bg-sky-50'
                          : signedDiff < 0
                            ? 'text-rose-600 bg-rose-50'
                            : 'text-emerald-600 bg-emerald-50';

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-neutral-50 transition-colors"
                          >
                            <td className="px-5 py-4 font-bold text-neutral-900">{item.manga}</td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="inline-flex items-baseline gap-1.5 font-black text-neutral-900 text-lg tabular-nums">
                                {item.bands}
                                <span className="text-xs font-bold text-neutral-400">×</span>
                                {item.reps}
                              </span>
                              <span className="ml-2 text-xs text-neutral-500">
                                {item.bands} banda{item.bands === 1 ? '' : 's'} · {item.reps} rep
                              </span>
                            </td>
                            <td className="px-5 py-4 font-mono font-bold text-neutral-800">{item.exactDev.toFixed(3)}"</td>
                            <td className="px-5 py-4">
                              <span className={`text-xs font-black px-2 py-0.5 rounded-full font-mono ${diffColor}`}>
                                {diffLabel}
                              </span>
                            </td>
                            <td className="px-5 py-4 font-bold text-brand-600 whitespace-nowrap">
                              ${item.costoTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              {item.estimado && (
                                <span
                                  className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 uppercase"
                                  title="El arte tiene otra cantidad de repeticiones/bandas: costo proporcional"
                                >
                                  estimado
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-neutral-400 text-center italic">
                  * Precios calculados con Coste Base: 0.3, IVA: 18% y configuraciones optimizadas para 50".
                  {medicion && ` Área de impresión medida en el arte, margen ${medicion.margenIn}" por lado.`}
                  {' Azul = por encima · Rojo = por debajo del valor ingresado.'}
                </p>
              </section>
        </>
      )}
    </div>
  );
}

/** Número grande con su etiqueta (bandas / repeticiones). */
function Cifra({ valor, etiqueta, nota }: { valor: number; etiqueta: string; nota: string }) {
  return (
    <div className="text-center">
      <p className="text-6xl sm:text-7xl font-black leading-none tabular-nums">{valor}</p>
      <p className="mt-1 text-sm font-bold uppercase tracking-wider">{etiqueta}</p>
      <p className="text-xs text-emerald-100">{nota}</p>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <p>
      <span className="text-emerald-100">{etiqueta}: </span>
      <span className="font-bold tabular-nums">{valor}</span>
    </p>
  );
}

/** Esquema de la plancha: columnas = bandas (a lo largo), filas = repeticiones (alrededor). */
function EsquemaMontaje({ bandas, reps }: { bandas: number; reps: number }) {
  const b = Math.max(1, Math.min(bandas, 8));
  const r = Math.max(1, Math.min(reps, 8));
  const celda = Math.min(28, 112 / Math.max(b, r));
  return (
    <div aria-hidden="true" className="p-2 rounded-xl bg-white/10 ring-1 ring-white/20">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${b}, ${celda * 1.6}px)` }}>
        {Array.from({ length: b * r }, (_, i) => (
          <div key={i} className="rounded-[4px] bg-white/85" style={{ height: celda }} />
        ))}
      </div>
    </div>
  );
}
