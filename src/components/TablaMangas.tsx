/**
 * Tabla de mangas Comexi F2 ML: desarrollo por repetición, en pulgadas.
 * Muestra un solo tipo a la vez (Rollo o Funda) y resalta la manga más cercana a la medida buscada.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X } from 'lucide-react';
import { MANGA_DATABASE, mangaMasCercana } from '../lib/costo';
import { presionable } from './BarraNavegacion';

type Tipo = 'funda' | 'rollo';

interface Props {
  abierta: boolean;
  onCerrar: () => void;
  /** Tipo y medida del paso ①, para abrir la tabla ya enfocada. */
  tipoInicial: Tipo;
  medidaInicial: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function TablaMangas({ abierta, onCerrar, tipoInicial, medidaInicial }: Props) {
  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const [medida, setMedida] = useState(medidaInicial);
  const celdaRef = useRef<HTMLTableCellElement>(null);

  // Cada vez que se abre, parte de lo escrito en ①.
  useEffect(() => {
    if (abierta) {
      setTipo(tipoInicial);
      setMedida(medidaInicial);
    }
  }, [abierta, tipoInicial, medidaInicial]);

  useEffect(() => {
    if (!abierta) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierta, onCerrar]);

  const cercana = mangaMasCercana(parseFloat(medida), tipo);

  // Lleva la celda resaltada a la vista sin animar (se usa al escribir).
  useEffect(() => {
    if (abierta && cercana) celdaRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [abierta, cercana?.manga, cercana?.reps, tipo]);

  const etiquetaMedida = tipo === 'funda' ? 'Ancho de funda' : 'Distancia entre marquillas';

  return (
    <AnimatePresence>
      {abierta && (
        <motion.div
          key="fondo"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } }}
          exit={{ opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } }}
          onClick={onCerrar}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-tabla-mangas"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, transform: 'scale(0.96)' }}
            animate={{ opacity: 1, transform: 'scale(1)', transition: { duration: 0.2, ease: EASE_OUT } }}
            exit={{ opacity: 0, transform: 'scale(0.98)', transition: { duration: 0.15, ease: EASE_OUT } }}
            className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Encabezado */}
            <div className="px-6 pt-5 pb-4 border-b border-neutral-200 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="titulo-tabla-mangas" className="font-bold text-neutral-900 text-lg leading-tight">
                    Tabla de mangas
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Comexi F2 ML · desarrollo por repetición, en pulgadas
                  </p>
                </div>
                <button
                  onClick={onCerrar}
                  aria-label="Cerrar"
                  className={`p-2 -mr-2 rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 ${presionable}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-neutral-200/70 rounded-xl p-1 gap-1 text-sm">
                  {(['funda', 'rollo'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTipo(t)}
                      aria-pressed={tipo === t}
                      className={`px-4 py-1.5 rounded-lg font-bold ${presionable} ${
                        tipo === t ? 'bg-white text-brand-700 shadow' : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      {t === 'funda' ? 'Fundas' : 'Rollos'}
                    </button>
                  ))}
                </div>
                <label className="flex-1 min-w-[12rem] relative">
                  <span className="sr-only">Buscar por {etiquetaMedida.toLowerCase()}</span>
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.001"
                    inputMode="decimal"
                    value={medida}
                    onChange={(e) => setMedida(e.target.value)}
                    placeholder={`${etiquetaMedida} (pulg)`}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </label>
              </div>

              <p className="text-xs h-4 text-neutral-600" aria-live="polite">
                {cercana ? (
                  <>
                    Más cercana: <b className="text-neutral-900">{cercana.manga} mm</b> · {cercana.reps} rep ·{' '}
                    <b className="text-neutral-900 tabular-nums">{cercana.dev.toFixed(3)}"</b>
                  </>
                ) : (
                  <span className="text-neutral-400">Escribe una medida para encontrar la manga más cercana.</span>
                )}
              </p>
            </div>

            {/* Tabla */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="text-[11px] uppercase tracking-wider text-neutral-500 shadow-[inset_0_-1px_0_#e5e5e5]">
                    <th scope="col" className="py-3 pl-6 pr-3 text-left font-bold">
                      Manga
                    </th>
                    {[1, 2, 3, 4].map((n) => (
                      <th key={n} scope="col" className="py-3 pl-3 pr-5 text-right font-bold last:pr-8">
                        {n} rep
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MANGA_DATABASE.map((m) => {
                    const filaActiva = cercana?.manga === m.mm;
                    const devs = tipo === 'funda' ? m.fundas : m.rollos;
                    return (
                      <tr
                        key={m.mm}
                        className={`border-b border-neutral-100 last:border-0 ${
                          filaActiva ? 'bg-brand-50/60' : 'even:bg-neutral-50/70 hover:bg-neutral-100/70'
                        }`}
                      >
                        <th scope="row" className="py-2.5 pl-6 pr-3 text-left font-bold text-neutral-900 whitespace-nowrap">
                          {m.mm} <span className="font-normal text-neutral-400 text-xs">mm</span>
                        </th>
                        {devs.map((d, i) => {
                          const activa = filaActiva && cercana?.reps === i + 1;
                          return (
                            <td
                              key={i}
                              ref={activa ? celdaRef : undefined}
                              className="py-1.5 px-3 text-right last:pr-6"
                            >
                              <span
                                className={`inline-block px-2 py-1 rounded-lg ${
                                  activa ? 'bg-brand-600 text-white font-bold' : 'text-neutral-700'
                                }`}
                              >
                                {d.toFixed(3)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-200 text-[11px] text-neutral-500">
              {tipo === 'funda'
                ? 'Fundas: el desarrollo se compara con el ancho de funda.'
                : 'Rollos: el desarrollo se compara con la distancia entre marquillas.'}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
