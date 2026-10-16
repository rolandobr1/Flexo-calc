/**
 * Paso ②: subir el arte y marcar la funda (o la plancha completa).
 * El tamaño viene del paso ①; la confirmación se hace con el botón principal de la barra inferior.
 */
import React, { useEffect, useRef, useState, type Dispatch } from 'react';
import { AlertCircle, CheckCircle2, ClipboardPaste, Loader2, Lock, Upload, X } from 'lucide-react';
import { archivoDelPortapapeles, cargarArte, TIPOS_ACEPTADOS, validarArchivo, type ArteCargado } from '../services/cargarArte';
import { presionable } from './BarraNavegacion';
import { difiereMedida, marcoDesdeFunda, type AccionMedidor, type EstadoMedidor } from './medidorEstado';
import { carasSegunMarco, largoDelMarco, largoEnPlancha } from '../lib/funda';
import type { DatosFunda } from './PasoFunda';
import VisorArte from './VisorArte';

interface Props {
  arte: ArteCargado | null;
  archivo: File | null;
  estado: EstadoMedidor;
  dispatch: Dispatch<AccionMedidor>;
  /** Datos del paso ①: única fuente del tamaño de la funda (aquí no se pueden cambiar). */
  datos: DatosFunda;
  onArte: (arte: ArteCargado | null, archivo: File | null) => void;
  onIrFunda: () => void;
}

const pulg = (v: number) => `${v.toFixed(3).replace(/\.?0+$/, '')}"`;
const inputCls = 'mt-1 w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm';

export default function PasoArte({
  arte,
  archivo,
  estado: s,
  dispatch,
  datos,
  onArte,
  onIrFunda,
}: Props) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [sobreZona, setSobreZona] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tipo = datos.tipo;
  // El tamaño del marco sale del paso ① (no se edita aquí).
  const bolsaAbierta = tipo === 'funda' && datos.largoEs === 'bolsa';
  const largoMarco =
    s.modo === 'unidad'
      ? largoDelMarco(tipo, parseFloat(datos.largo), datos.largoEs, s.soloFrente)
      : largoEnPlancha(tipo, parseFloat(datos.largo), datos.largoEs);
  const dims = marcoDesdeFunda(s.modo, largoMarco, parseFloat(datos.medidaManga), s.bandasArte, s.repsArte);
  // En un PDF a escala, la medida del dibujo sirve solo para avisar si no coincide con ①.
  const medidaPdf =
    arte?.pulgadasPorPx && s.marcoTxt.ancho && s.marcoTxt.alto
      ? { anchoIn: parseFloat(s.marcoTxt.ancho), altoIn: parseFloat(s.marcoTxt.alto) }
      : null;
  const noCoincide = !!(dims && medidaPdf && !s.marcoConfirmado && difiereMedida(dims, medidaPdf));
  // Bolsa abierta: la proporción del marco dice si el arte es una cara o la lámina completa.
  const caras =
    bolsaAbierta && s.modo === 'unidad' && s.marcoPx && !s.marcoConfirmado
      ? carasSegunMarco(
          Math.abs(s.marcoPx.der - s.marcoPx.izq),
          Math.abs(s.marcoPx.aba - s.marcoPx.arr),
          s.horizontalEsX,
          parseFloat(datos.largo),
          parseFloat(datos.medidaManga),
        )
      : null;
  const carasNoCoinciden = caras !== null && (caras === 'frente') !== s.soloFrente;

  const abrir = async (file: File, pagina = 1) => {
    setError('');
    const err = validarArchivo(file);
    if (err) {
      setError(err);
      return;
    }
    setCargando(true);
    try {
      const a = await cargarArte(file, pagina);
      onArte(a, file);
      dispatch({ t: 'NUEVO_ARTE' });
      dispatch({ t: 'ESCALA_PDF', pulgadasPorPx: a.pulgadasPorPx });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el archivo.');
    } finally {
      setCargando(false);
    }
  };

  // Ctrl+V: pegar una imagen del portapapeles mientras no haya arte cargado.
  const abrirRef = useRef(abrir);
  abrirRef.current = abrir;
  useEffect(() => {
    if (arte) return;
    const onPaste = (e: ClipboardEvent) => {
      const f = archivoDelPortapapeles(e.clipboardData);
      if (f) {
        e.preventDefault();
        abrirRef.current(f);
        return;
      }
      // Pegar texto en un campo sigue funcionando normal.
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable="true"]')) return;
      setError('El portapapeles no tiene una imagen. Copia la imagen (o haz una captura) y vuelve a pegar.');
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [arte]);

  const quitar = () => {
    onArte(null, null);
    setError('');
    dispatch({ t: 'NUEVO_ARTE' });
    if (inputRef.current) inputRef.current.value = '';
  };

  const ejeX = s.horizontalEsX ? 'horizontal' : 'vertical';
  const ejeY = s.horizontalEsX ? 'vertical' : 'horizontal';
  const etiquetaManga = tipo === 'funda' ? 'Ancho de funda' : 'Distancia entre marquillas';
  const etiquetaLargo = tipo === 'funda' ? 'Largo de funda' : 'Ancho del rollo';
  const unidadTxt = tipo === 'funda' ? 'una funda' : 'una unidad del rollo';

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
      <div className="p-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100 text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs font-bold">{error}</p>
          </div>
        )}

        {!arte ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setSobreZona(true);
            }}
            onDragLeave={() => setSobreZona(false)}
            onDrop={(e) => {
              e.preventDefault();
              setSobreZona(false);
              const f = e.dataTransfer.files[0];
              if (f) abrir(f);
            }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out ${
              sobreZona ? 'border-brand-400 bg-brand-50' : 'border-neutral-200 hover:border-brand-300 hover:bg-brand-50/50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={TIPOS_ACEPTADOS.join(',')}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) abrir(f);
              }}
            />
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-neutral-100">
                {cargando ? (
                  <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 text-neutral-400" />
                )}
              </div>
              <p className="font-bold text-neutral-700">
                {cargando ? 'Abriendo arte...' : 'Arrastra el arte aquí o haz clic para subir'}
              </p>
              {!cargando && (
                <p className="flex items-center gap-1.5 text-xs font-bold text-neutral-500">
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  o pega una imagen copiada con{' '}
                  <kbd className="px-1.5 py-0.5 rounded-md border border-neutral-300 bg-white font-sans text-[11px] text-neutral-700 shadow-[0_1px_0_#d4d4d4]">
                    Ctrl
                  </kbd>
                  +
                  <kbd className="px-1.5 py-0.5 rounded-md border border-neutral-300 bg-white font-sans text-[11px] text-neutral-700 shadow-[0_1px_0_#d4d4d4]">
                    V
                  </kbd>
                </p>
              )}
              <p className="text-xs text-neutral-400">PDF (máx. 50MB) · JPG, PNG, WEBP (máx. 20MB) · Este paso es opcional</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex bg-neutral-100 rounded-xl p-1">
                {(['unidad', 'plancha'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => dispatch({ t: 'MODO', modo: m })}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out ${
                      s.modo === m ? 'bg-white shadow text-brand-700' : 'text-neutral-500'
                    }`}
                  >
                    {m === 'unidad' ? (tipo === 'funda' ? 'El arte es una funda' : 'El arte es una unidad') : 'El arte es la plancha completa'}
                  </button>
                ))}
              </div>
              {bolsaAbierta && s.modo === 'unidad' && (
                <div className="flex bg-neutral-100 rounded-xl p-1">
                  {([
                    [false, 'Muestra frente y dorso'],
                    [true, 'Muestra solo el frente'],
                  ] as const).map(([v, t]) => (
                    <button
                      key={String(v)}
                      onClick={() => dispatch({ t: 'SOLO_FRENTE', soloFrente: v })}
                      aria-pressed={s.soloFrente === v}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out ${
                        s.soloFrente === v ? 'bg-white shadow text-brand-700' : 'text-neutral-500'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 font-bold text-neutral-600">
                A lo largo de la plancha:
                <select
                  value={s.horizontalEsX ? 'h' : 'v'}
                  onChange={(e) => dispatch({ t: 'ORIENTACION', horizontalEsX: e.target.value === 'h' })}
                  className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1"
                >
                  <option value="h">Horizontal</option>
                  <option value="v">Vertical</option>
                </select>
              </label>
              {arte.paginas > 1 && archivo && (
                <label className="flex items-center gap-2 font-bold text-neutral-600">
                  Página:
                  <select
                    value={arte.pagina}
                    onChange={(e) => abrir(archivo, parseInt(e.target.value))}
                    className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1"
                  >
                    {Array.from({ length: arte.paginas }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={quitar}
                  title="Quitar arte"
                  className="p-1.5 border border-neutral-200 rounded-lg text-neutral-500 hover:text-red-500 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {carasNoCoinciden && (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="flex-1 min-w-[14rem] font-bold text-amber-900">
                  {caras === 'lamina'
                    ? 'El marco que dibujaste tiene la forma de la lámina completa (frente y dorso), pero está marcado "Muestra solo el frente". Así la impresión se calcularía de más.'
                    : 'El marco que dibujaste tiene la forma de una sola cara, pero está marcado "Muestra frente y dorso".'}
                </span>
                <button
                  onClick={() => dispatch({ t: 'SOLO_FRENTE', soloFrente: caras === 'frente', conservarMarco: true })}
                  className={`px-3 py-1.5 rounded-lg font-bold text-amber-900 bg-white border border-amber-300 hover:border-amber-400 ${presionable}`}
                >
                  Cambiar a "{caras === 'lamina' ? 'Muestra frente y dorso' : 'Muestra solo el frente'}"
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-2">
                <p className="text-xs font-bold text-neutral-600">
                  {s.marcoConfirmado
                    ? 'Funda marcada. Para cambiarla, usa "Editar marco".'
                    : `Arrastra un rectángulo sobre ${
                        s.modo === 'plancha'
                          ? 'la plancha completa'
                          : bolsaAbierta
                            ? s.soloFrente
                              ? 'el frente de la bolsa'
                              : 'la lámina completa (frente y dorso)'
                            : unidadTxt + ' completa'
                      }`}
                </p>
                <VisorArte
                  arte={arte}
                  estado={s}
                  dispatch={dispatch}
                  editable={s.marcoConfirmado ? null : 'marco'}
                  vista="marco"
                  soloLectura={s.marcoConfirmado}
                />
              </div>

              <div className="space-y-3">
                {!s.marcoConfirmado ? (
                  <>
                    <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1">
                      <p className="text-xs font-black text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Tamaño desde Funda
                      </p>
                      {dims ? (
                        <p className="text-sm font-bold text-neutral-800 font-mono">
                          {pulg(dims.anchoIn)} × {pulg(dims.altoIn)}
                        </p>
                      ) : (
                        <p className="text-xs font-bold text-red-600">Completa el tamaño en el paso Funda.</p>
                      )}
                      <p className="text-[11px] text-neutral-500">
                        {bolsaAbierta && s.modo === 'unidad'
                          ? s.soloFrente
                            ? `Frente de la bolsa (a lo largo, ${ejeX})${datos.dorsoImpreso ? '; el dorso impreso se agrega solo' : '; dorso sin impresión'}`
                            : `Lámina frente + dorso (a lo largo, ${ejeX})`
                          : `${etiquetaLargo} (a lo largo, ${ejeX})`}{' '}
                        × {etiquetaManga} (alrededor, {ejeY})
                        {s.modo === 'plancha' && ' × bandas y repeticiones del arte'}. Solo se cambia en Funda.
                      </p>
                      <button onClick={onIrFunda} className="text-[11px] font-bold text-brand-600 hover:underline">
                        Ir a Funda
                      </button>
                    </div>
                    {s.modo === 'plancha' && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-bold text-neutral-600">
                          Bandas en el arte
                          <input
                            type="number"
                            min="1"
                            value={s.bandasArte}
                            onChange={(e) =>
                              dispatch({ t: 'ARTE_GRID', bandasArte: parseInt(e.target.value) || 0, repsArte: s.repsArte })
                            }
                            className={inputCls}
                          />
                        </label>
                        <label className="block text-xs font-bold text-neutral-600">
                          Repeticiones en el arte
                          <input
                            type="number"
                            min="1"
                            value={s.repsArte}
                            onChange={(e) =>
                              dispatch({ t: 'ARTE_GRID', bandasArte: s.bandasArte, repsArte: parseInt(e.target.value) || 0 })
                            }
                            className={inputCls}
                          />
                        </label>
                      </div>
                    )}
                    {medidaPdf && (
                      <p className={`text-[11px] ${noCoincide ? 'font-bold text-amber-700' : 'text-neutral-400'}`}>
                        {noCoincide ? '⚠ ' : ''}El dibujo en el PDF mide {pulg(medidaPdf.anchoIn)} × {pulg(medidaPdf.altoIn)}
                        {noCoincide
                          ? '; no coincide con el tamaño de Funda. Revisa el marco o el tamaño en Funda (se usa el de Funda).'
                          : ', coincide con Funda.'}
                      </p>
                    )}
                    <p className="text-[11px] text-neutral-500">
                      {s.marcoPx
                        ? 'Marco dibujado. Usa “Confirmar marco y seguir” abajo.'
                        : 'Dibuja el marco sobre el arte; luego “Confirmar marco y seguir” abajo.'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-2">
                      <p className="text-xs font-black text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Marco confirmado
                        {s.marcoIn && ` · ${pulg(s.marcoIn.anchoIn)} × ${pulg(s.marcoIn.altoIn)}`}
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        Tamaño tomado de Funda. Si lo cambias allá, el marco se ajusta solo.
                      </p>
                    </div>
                    <button
                      onClick={() => dispatch({ t: 'EDITAR_MARCO' })}
                      className={`text-xs font-bold text-neutral-700 bg-white border border-neutral-200 hover:border-neutral-300 px-3 py-2 rounded-lg ${presionable}`}
                    >
                      Editar marco
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </section>
  );
}
