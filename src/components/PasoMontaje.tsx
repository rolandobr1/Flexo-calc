/**
 * Paso ③: simulación del montaje y zonas de tintas marcadas sobre la plancha.
 */
import React, { useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import { AlertTriangle, Pencil, RotateCcw, Star } from 'lucide-react';
import type { Configuration } from '../lib/costo';
import type { MedicionArte } from '../lib/medicion';
import { montaje } from '../lib/montaje';
import type { ArteCargado } from '../services/cargarArte';
import { tintasVisibles, unidadDeArte, type AccionMedidor, type EstadoMedidor } from './medidorEstado';
import type { DatosFunda } from './PasoFunda';
import VisorMontaje, { COLORES_RECT, zonaEnUnidad } from './VisorMontaje';
import { presionable } from './BarraNavegacion';

interface Props {
  arte: ArteCargado;
  estado: EstadoMedidor;
  dispatch: Dispatch<AccionMedidor>;
  datos: DatosFunda;
  /** Largo de una unidad en la plancha (lámina). */
  lamina: number;
  /** Medición en coordenadas de una unidad, con el dorso aplicado si corresponde. */
  medicion: MedicionArte | null;
  /** Recomendada primero, luego las alternativas de la comparativa. */
  opciones: Configuration[];
  elegida: Configuration | null;
  onElegir: (id: string) => void;

}

const pulg = (v: number) => `${v.toFixed(2)}"`;
const dinero = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PasoMontaje({
  arte,
  estado: s,
  dispatch,
  datos,
  lamina,
  medicion,
  opciones,
  elegida,
  onElegir,

}: Props) {
  const unidad = unidadDeArte(s);
  const colores = parseInt(datos.colores) || 0;
  const bolsaAbierta = datos.tipo === 'funda' && datos.largoEs === 'bolsa';
  const soloFrente = bolsaAbierta && s.soloFrente && s.modo === 'unidad';

  const mon = useMemo(
    () =>
      elegida && unidad
        ? montaje({
            lamina,
            anchoFunda: parseFloat(datos.medidaManga),
            dev: elegida.exactDev,
            reps: elegida.reps,
            bandas: elegida.bands,
            soloFrente,
            largoBolsa: parseFloat(datos.largo),
            dorsoImpreso: datos.dorsoImpreso,
            medicion,
            colores,
          })
        : null,
    [elegida, unidad?.px.izq, unidad?.px.der, lamina, datos, soloFrente, medicion, colores],
  );

  const tintas = tintasVisibles(s);
  const activa = s.tintaActiva;
  const tinta = activa !== null ? tintas[activa] : null;
  const propia = !!tinta?.propia;
  const editable = activa === null ? 'general' : propia ? 'plancha' : null;

  if (!unidad || !mon || !elegida) {
    return (
      <section className="bg-white rounded-3xl border border-neutral-200 p-6 text-sm text-neutral-500">
        Completa la Funda y marca el arte para ver el montaje.
      </section>
    );
  }

  const zonaGeneral = zonaEnUnidad(s.generalPx, unidad, s.horizontalEsX);
  // La zona propia de una tinta está en pulgadas de plancha (una sola, no se repite).
  const enPlancha = activa !== null && propia;
  const zona = enPlancha ? tinta!.zona : zonaGeneral;
  // Rectángulo cobrado de cada tinta con zona propia o medida manual (las demás usan la general).
  const cobradoDe = (i: number) => mon.tintas.find((c) => c.indice === i);
  const cobradoTinta = activa !== null ? cobradoDe(activa) : undefined;
  const cobrado = cobradoTinta?.manual || enPlancha ? cobradoTinta?.rect ?? null : mon.general?.rect ?? null;
  const color = activa !== null && propia ? COLORES_RECT.tinta : COLORES_RECT.general;

  /** propia = zona dibujada (se cobra); marcar = eligió zona propia pero aún no la dibuja. */
  type EstadoZona = 'general' | 'propia' | 'marcar' | 'manual';
  const estadoZona = (i: number): EstadoZona => {
    const t = tintas[i];
    if (t?.manual) return 'manual';
    return t?.propia ? (t.zona ? 'propia' : 'marcar') : 'general';
  };
  const ETIQUETA: Record<EstadoZona, { txt: string; cls: string }> = {
    propia: { txt: 'propia', cls: 'bg-amber-100 text-amber-700' },
    marcar: { txt: 'por marcar', cls: 'border border-dashed border-amber-300 text-amber-600' },
    general: { txt: 'general', cls: 'bg-neutral-200 text-neutral-500' },
    manual: { txt: 'manual', cls: 'bg-sky-100 text-sky-700' },
  };

  const pestana = (id: number | null, nombre: string, zonaEstado: EstadoZona | null) => {
    const esPropia = zonaEstado === 'propia';
    const sel = s.tintaActiva === id;
    return (
      <button
        key={id ?? 'general'}
        onClick={() => dispatch({ t: 'TINTA_ACTIVA', i: id })}
        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out flex items-center gap-2 ${
          sel ? 'bg-white border-brand-300 shadow text-neutral-900' : 'bg-neutral-50 border-transparent text-neutral-500 hover:bg-neutral-100'
        }`}
      >
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: id === null ? COLORES_RECT.general.trazo : esPropia ? COLORES_RECT.tinta.trazo : '#d4d4d4' }}
        />
        {nombre}
        {zonaEstado && (
          <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded-full ${ETIQUETA[zonaEstado].cls}`}>
            {ETIQUETA[zonaEstado].txt}
          </span>
        )}
      </button>
    );
  };

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
      <div className="p-6 space-y-5">
        {/* Manga a simular */}
        <div className="space-y-2">
          <p className="text-xs font-black text-neutral-500 uppercase tracking-wider">Manga a simular</p>
          <div className="flex flex-wrap gap-2">
            {opciones.map((o, i) => (
              <button
                key={o.id}
                onClick={() => onElegir(o.id)}
                aria-pressed={o.id === elegida.id}
                className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${presionable} ${
                  o.id === elegida.id
                    ? 'bg-white text-brand-700 border-brand-400 ring-2 ring-brand-100 shadow-sm'
                    : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {i === 0 && <Star className="w-3.5 h-3.5" />}
                {o.manga} mm · {o.reps} rep · {o.exactDev.toFixed(3)}"
                <span className={o.id === elegida.id ? 'text-brand-500' : 'text-neutral-400'}>{dinero(o.costoTotal)}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-600">
            Plancha: <b>{pulg(mon.plancha.ancho)}</b> a lo largo ({elegida.bands} banda(s) × lámina {pulg(lamina)}) ×{' '}
            <b>{pulg(mon.plancha.alto)}</b> alrededor ({elegida.reps} rep × {elegida.exactDev.toFixed(3)}")
          </p>
          {mon.traslape && (
            <p className="text-xs font-bold text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> El desarrollo ({elegida.exactDev.toFixed(3)}") es menor que el ancho de la
              funda ({datos.medidaManga}"): las repeticiones se pisan.
            </p>
          )}
        </div>

        {/* Tintas */}
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Zonas por tinta">
          {pestana(null, 'General', null)}
          {tintas.map((t, i) => pestana(i, t.nombre || `Tinta ${i + 1}`, estadoZona(i)))}
          <label className="ml-auto flex items-center gap-2 text-xs font-bold text-neutral-600">
            Margen por lado <span className="text-[9px] uppercase text-neutral-400">opcional</span>
            <input
              type="number"
              step="0.125"
              min="0"
              value={s.margenIn}
              onChange={(e) => dispatch({ t: 'MARGEN', margenIn: parseFloat(e.target.value) || 0 })}
              className="w-16 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1"
            />
            pulg
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-2">
            <p className="text-xs font-bold text-neutral-600">
              {activa === null
                ? 'Encierra la impresión de una copia o de toda la plancha: se ajusta a cada copia y se repite en todas.'
                : tinta?.manual
                  ? `"${tinta.nombre}" se cobra con la medida escrita a mano (rectángulo punteado).`
                  : propia
                  ? `Arrastra sobre la plancha la zona que ocupa "${tinta?.nombre}" en la composición completa (no se repite).`
                  : `"${tinta?.nombre}" usa la zona general. Activa "Zona propia" para marcar la suya.`}
            </p>
            <VisorMontaje
              arte={arte}
              estado={s}
              dispatch={dispatch}
              unidad={unidad}
              montaje={mon}
              editable={editable}
              zona={zona}
              enPlancha={enPlancha}
              onZonaPlancha={(rect) => activa !== null && dispatch({ t: 'ZONA_TINTA', i: activa, rect })}
              cobrado={zona ? cobrado : null}
              color={color}
            />
          </div>

          <div className="space-y-3">
            {tinta && activa !== null && (
              <>
                <label className="block text-xs font-bold text-neutral-600">
                  Nombre de la tinta
                  <span className="relative block mt-1">
                    <input
                      value={tinta.nombre}
                      onChange={(e) => dispatch({ t: 'NOMBRE_TINTA', i: activa, nombre: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      placeholder={`Tinta ${activa + 1}`}
                      className="w-full pl-3 pr-9 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                    <Pencil className="w-3.5 h-3.5 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </span>
                </label>
                <div className="flex bg-neutral-100 rounded-xl p-1 text-xs">
                  {[true, false].map((p) => (
                    <button
                      key={String(p)}
                      onClick={() => dispatch({ t: 'ZONA_PROPIA', i: activa, propia: p })}
                      aria-pressed={tinta.propia === p}
                      className={`flex-1 px-3 py-1.5 rounded-lg font-bold ${presionable} ${
                        tinta.propia === p ? 'bg-white shadow text-brand-700' : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      {p ? 'Zona propia' : 'Usa zona general'}
                    </button>
                  ))}
                </div>
                {tinta.manual && (
                  <p className="text-[11px] text-sky-700">
                    Se cobra la medida escrita a mano ({pulg(tinta.manual.ancho)} × {pulg(tinta.manual.alto)}). Dibujar una zona la reemplaza.
                  </p>
                )}
                {propia && !tinta.zona && !tinta.manual && (
                  <p className="text-[11px] text-neutral-500">
                    Arrastra sobre la plancha para marcarla. Mientras no la marques, se cobra la zona general.
                  </p>
                )}
              </>
            )}

            <div className="rounded-2xl border border-neutral-200 divide-y divide-neutral-100 text-xs">
              <p className="px-3 py-2 font-black text-neutral-500 uppercase tracking-wider">Área cobrada por tinta</p>
              {!medicion && (
                <p className="px-3 py-2 text-neutral-400">Sin zona marcada: se cobra la plancha completa.</p>
              )}
              {Array.from({ length: colores }, (_, i) => {
                const t = tintas[i];
                const c = cobradoDe(i) ?? mon.general;
                const ancho = c ? c.rect.x1 - c.rect.x0 : 0;
                const alto = c ? c.rect.y1 - c.rect.y0 : 0;
                const fijar = (m: { ancho: number; alto: number }) => dispatch({ t: 'MEDIDA_MANUAL', i, manual: m });
                return (
                  <div key={i} className="px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        aria-label={`Nombre de la tinta ${i + 1}`}
                        value={t?.nombre ?? ''}
                        placeholder={`Tinta ${i + 1}`}
                        onChange={(e) => dispatch({ t: 'NOMBRE_TINTA', i, nombre: e.target.value })}
                        onFocus={(e) => e.target.select()}
                        title="Clic para cambiar el nombre"
                        className="min-w-0 flex-1 -ml-1.5 px-1.5 py-1 rounded-md font-bold text-neutral-700 bg-transparent border border-transparent hover:border-neutral-200 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                      />
                      {t?.manual && (
                        <button
                          onClick={() => dispatch({ t: 'MEDIDA_MANUAL', i, manual: null })}
                          title="Volver a la medida dibujada"
                          className={`shrink-0 flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded-full ${presionable}`}
                        >
                          <RotateCcw className="w-3 h-3" /> manual
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-600">
                      <Medida
                        etiqueta={`Largo cobrado de ${t?.nombre || `Tinta ${i + 1}`} (a lo largo)`}
                        valor={ancho}
                        manual={!!t?.manual}
                        onFijar={(v) => fijar({ ancho: v, alto })}
                      />
                      <span className="text-neutral-400">×</span>
                      <Medida
                        etiqueta={`Alto cobrado de ${t?.nombre || `Tinta ${i + 1}`} (alrededor)`}
                        valor={alto}
                        manual={!!t?.manual}
                        onFijar={(v) => fijar({ ancho, alto: v })}
                      />
                      <span className="text-[10px] text-neutral-400">pulg</span>
                      <span className="ml-auto shrink-0 whitespace-nowrap font-mono text-neutral-500">
                        {c ? `${c.area.toFixed(1)} pulg²` : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-3 py-3 bg-emerald-50">
                <span className="font-black text-emerald-800">Costo con {elegida.manga} mm</span>
                <span className="font-black text-emerald-800 text-sm">{dinero(elegida.costoTotal)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

/** Medida editable: se confirma con Enter o al salir del campo; Esc la deja como estaba. */
function Medida({
  etiqueta,
  valor,
  manual,
  onFijar,
}: {
  etiqueta: string;
  valor: number;
  manual: boolean;
  onFijar: (v: number) => void;
}) {
  const fmt = (v: number) => String(+v.toFixed(3));
  const [txt, setTxt] = useState(fmt(valor));
  const [editando, setEditando] = useState(false);
  const cancelar = useRef(false);
  useEffect(() => {
    if (!editando) setTxt(fmt(valor));
  }, [valor, editando]);

  const confirmar = () => {
    setEditando(false);
    if (cancelar.current) {
      cancelar.current = false;
      setTxt(fmt(valor));
      return;
    }
    const v = parseFloat(txt.replace(',', '.'));
    if (v > 0 && Math.abs(v - valor) > 0.0005) onFijar(v);
    else setTxt(fmt(valor));
  };

  return (
    <input
      aria-label={etiqueta}
      title="Clic para escribir la medida a mano"
      inputMode="decimal"
      value={txt}
      onFocus={(e) => {
        setEditando(true);
        e.target.select();
      }}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          cancelar.current = true;
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`w-16 px-1.5 py-1 rounded-md font-mono text-right tabular-nums outline-none border focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${
        manual ? 'bg-sky-50 border-sky-200 text-sky-800' : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
      }`}
    />
  );
}
