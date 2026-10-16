/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Table as TableIcon } from 'lucide-react';
import logoMultiform from './assets/logo-multiform.svg';
import isotipo from './assets/isotipo-multiform.svg';
import { alternativas, calcularConfiguraciones, validarEntrada } from './lib/costo';
import { bandasSugeridas, largoDelMarco, largoEnPlancha } from './lib/funda';
import { conDorso } from './lib/medicion';
import type { ArteCargado } from './services/cargarArte';
import { aMedicion, estadoInicial, marcoDesdeFunda, medidorReducer } from './components/medidorEstado';
import BarraPasos, { type InfoPaso, type PasoId } from './components/BarraPasos';
import BarraNavegacion, { presionable, type AccionNav } from './components/BarraNavegacion';
import PasoFunda, { type DatosFunda } from './components/PasoFunda';
import PasoArte from './components/PasoArte';
import PasoMontaje from './components/PasoMontaje';
import PasoResultados from './components/PasoResultados';
import TablaMangas from './components/TablaMangas';
import type { Unidad } from './lib/unidades';

const DATOS_VACIOS: DatosFunda = {
  tipo: 'funda',
  medidaManga: '',
  largo: '',
  bandas: '',
  colores: '',
  largoEs: 'bolsa',
  dorsoImpreso: true,
};

export default function App() {
  const [paso, setPaso] = useState<PasoId>('funda');
  const [datos, setDatos] = useState<DatosFunda>(DATOS_VACIOS);
  const [arte, setArte] = useState<ArteCargado | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [estado, dispatch] = useReducer(medidorReducer, estadoInicial);
  const [showTableModal, setShowTableModal] = useState(false);
  // Unidad en que se escriben las medidas en ①; se recuerda en este navegador.
  const [unidad, setUnidadEstado] = useState<Unidad>(() => {
    try {
      return localStorage.getItem('flexocalc.unidad') === 'mm' ? 'mm' : 'pulg';
    } catch {
      return 'pulg';
    }
  });
  const setUnidad = (u: Unidad) => {
    setUnidadEstado(u);
    try {
      localStorage.setItem('flexocalc.unidad', u);
    } catch {
      /* sin almacenamiento: se usa solo en esta sesión */
    }
  };
  const cerrarTabla = useCallback(() => setShowTableModal(false), []);

  // Largo que ocupa una unidad en la plancha: en fundas abiertas, frente + dorso.
  const largoPlancha = largoEnPlancha(datos.tipo, parseFloat(datos.largo), datos.largoEs);
  const bolsaAbierta = datos.tipo === 'funda' && datos.largoEs === 'bolsa';
  const medicionBase = aMedicion(estado);
  // Arte de solo el frente con dorso impreso: la impresión se repite en el dorso.
  const medicion =
    medicionBase && bolsaAbierta && estado.soloFrente && estado.modo === 'unidad' && datos.dorsoImpreso
      ? conDorso(medicionBase, parseFloat(datos.largo))
      : medicionBase;
  const colores = parseInt(datos.colores) || 0;

  // Una pestaña de tinta por cada color.
  useEffect(() => {
    dispatch({ t: 'SINCRONIZAR_TINTAS', n: Math.min(colores, 8) });
  }, [colores]);

  // Sin marco confirmado no hay paso de impresión.
  useEffect(() => {
    if (paso === 'montaje' && (!estado.marcoConfirmado || !arte)) setPaso('arte');
  }, [paso, estado.marcoConfirmado, arte]);

  // El tamaño de la funda solo se define en ①: si cambia, el marco confirmado se ajusta solo.
  const dimsFunda = marcoDesdeFunda(
    estado.modo,
    estado.modo === 'unidad'
      ? largoDelMarco(datos.tipo, parseFloat(datos.largo), datos.largoEs, estado.soloFrente)
      : largoPlancha,
    parseFloat(datos.medidaManga),
    estado.bandasArte,
    estado.repsArte,
  );
  useEffect(() => {
    const m = estado.marcoIn;
    if (estado.marcoConfirmado && dimsFunda && m && (dimsFunda.anchoIn !== m.anchoIn || dimsFunda.altoIn !== m.altoIn)) {
      dispatch({ t: 'CONFIRMAR_MARCO', dim: dimsFunda });
    }
  }, [dimsFunda?.anchoIn, dimsFunda?.altoIn, estado.marcoConfirmado, estado.marcoIn]);

  /** Bandas sugeridas según la lámina (frente + dorso en fundas abiertas). */
  const sugerirBandas = (d: DatosFunda): string => {
    const b = bandasSugeridas(largoEnPlancha(d.tipo, parseFloat(d.largo), d.largoEs));
    return b === null ? '' : String(b);
  };

  const cambiar = (c: Partial<DatosFunda>) =>
    setDatos((d) => {
      const nuevo = { ...d, ...c };
      // Si cambia el tipo o cómo se interpreta el largo, cambian las bandas que caben.
      if ((c.tipo !== undefined && c.tipo !== d.tipo) || (c.largoEs !== undefined && c.largoEs !== d.largoEs)) {
        nuevo.bandas = sugerirBandas(nuevo);
      }
      return nuevo;
    });

  /** Al cambiar el largo se sugieren las bandas que caben en 50". */
  const cambiarLargo = (v: string) => setDatos((d) => ({ ...d, largo: v, bandas: sugerirBandas({ ...d, largo: v }) }));

  const limpiar = () => {
    setDatos(DATOS_VACIOS);
    setArte(null);
    setArchivo(null);
    dispatch({ t: 'REINICIAR' });
    setPaso('funda');
  };

  const errorFunda = validarEntrada({
    ancho: parseFloat(datos.medidaManga),
    largo: largoPlancha,
    colores,
    bandas: parseInt(datos.bandas),
    tipo: datos.tipo,
    medicion: null,
  });

  // Mangas para el montaje: la recomendada y las 4 alternativas de la comparativa.
  const [mangaElegida, setMangaElegida] = useState<string | null>(null);
  // Si cambia el tamaño o el tipo, vuelve a simularse la manga recomendada.
  useEffect(() => {
    setMangaElegida(null);
  }, [datos.medidaManga, datos.largo, datos.largoEs, datos.bandas, datos.tipo]);
  const configuraciones = useMemo(() => {
    if (errorFunda) return [];
    return calcularConfiguraciones({
      ancho: parseFloat(datos.medidaManga),
      largo: largoPlancha,
      colores,
      bandas: parseInt(datos.bandas),
      tipo: datos.tipo,
      medicion,
    });
  }, [errorFunda, datos, largoPlancha, colores, medicion]);
  const opciones = configuraciones.length
    ? [configuraciones[0], ...alternativas(configuraciones, parseFloat(datos.medidaManga))]
    : [];
  const elegida = opciones.find((o) => o.id === mangaElegida) ?? opciones[0] ?? null;

  const pasos: InfoPaso[] = [
    { id: 'funda', titulo: 'Funda', completo: !errorFunda, disponible: true },
    { id: 'arte', titulo: 'Arte', completo: estado.marcoConfirmado && !!arte, disponible: !errorFunda },
    { id: 'montaje', titulo: 'Montaje', completo: !!medicion, disponible: !errorFunda && estado.marcoConfirmado && !!arte },
    { id: 'resultados', titulo: 'Resultados', completo: false, disponible: !errorFunda },
  ];

  // Navegación: un solo botón principal por paso, siempre en el mismo lugar (barra inferior).
  const marcoDibujado = !!estado.marcoPx && !!dimsFunda && !!arte;
  const irResultados: AccionNav = { label: 'Omitir arte → Resultados', onClick: () => setPaso('resultados'), disabled: !!errorFunda };
  const nav: { atras?: AccionNav; atajo?: AccionNav; principal?: AccionNav } =
    paso === 'funda'
      ? {
          principal: { label: 'Siguiente: Arte', onClick: () => setPaso('arte'), disabled: !!errorFunda, pista: errorFunda ?? undefined },
          atajo: medicion ? { label: 'Ver resultados', onClick: () => setPaso('resultados'), disabled: !!errorFunda } : irResultados,
        }
      : paso === 'arte'
        ? {
            atras: { label: 'Funda', onClick: () => setPaso('funda') },
            atajo: estado.marcoConfirmado ? undefined : irResultados,
            principal: estado.marcoConfirmado
              ? { label: 'Siguiente: Montaje', onClick: () => setPaso('montaje') }
              : {
                  label: 'Confirmar marco y seguir',
                  disabled: !marcoDibujado,
                  pista: !arte ? 'Sube o pega el arte (o usa "Omitir arte")' : 'Dibuja el marco sobre el arte',
                  onClick: () => {
                    if (!dimsFunda) return;
                    dispatch({ t: 'CONFIRMAR_MARCO', dim: dimsFunda });
                    setPaso('montaje');
                  },
                },
          }
        : paso === 'montaje'
          ? {
              atras: { label: 'Arte', onClick: () => setPaso('arte') },
              principal: { label: 'Siguiente: Resultados', onClick: () => setPaso('resultados') },
            }
          : {
              atras: estado.marcoConfirmado && arte
                ? { label: 'Montaje', onClick: () => setPaso('montaje') }
                : { label: 'Funda', onClick: () => setPaso('funda') },
            };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans p-4 md:p-8 pb-32 md:pb-32">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[16rem] flex items-center gap-4">
            <img src={logoMultiform} alt="Plásticos Multiform" className="h-11 sm:h-12 w-auto shrink-0" />
            <div className="h-10 w-px bg-neutral-200" aria-hidden="true" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl leading-tight">FlexoCalc Pro</h1>
              <p className="text-marca-gris text-xs sm:text-sm">Costos y selección de mangas Comexi F2 ML</p>
            </div>
          </div>
          <button
            onClick={limpiar}
            className={`text-xs font-bold text-neutral-400 hover:text-red-600 px-3 py-2 rounded-full ${presionable}`}
            title="Borra el tamaño, el arte y las zonas"
          >
            Nuevo trabajo
          </button>
          <button
            onClick={() => setShowTableModal(true)}
            className={`flex items-center gap-2 text-sm font-bold text-neutral-700 bg-white border border-neutral-200 hover:border-neutral-300 px-4 py-2 rounded-full ${presionable}`}
          >
            <TableIcon className="w-4 h-4" />
            Tabla de mangas
          </button>
        </header>

        <BarraPasos pasos={pasos} activo={paso} onIr={setPaso} />

        {paso === 'funda' && (
          <PasoFunda
            datos={datos}
            onCambio={cambiar}
            onLargo={cambiarLargo}
            error={errorFunda}
            unidad={unidad}
            onUnidad={setUnidad}
          />
        )}

        {paso === 'arte' && (
          <PasoArte
            arte={arte}
            archivo={archivo}
            estado={estado}
            dispatch={dispatch}
            datos={datos}
            onArte={(a, f) => {
              setArte(a);
              setArchivo(f);
            }}
            onIrFunda={() => setPaso('funda')}
          />
        )}

        {paso === 'montaje' && arte && (
          <PasoMontaje
            arte={arte}
            estado={estado}
            dispatch={dispatch}
            datos={datos}
            lamina={largoPlancha}
            medicion={medicion}
            opciones={opciones}
            elegida={elegida}
            onElegir={setMangaElegida}
          />
        )}

        {paso === 'resultados' && (
          <PasoResultados
            datos={datos}
            medicion={medicion}
            onIrFunda={() => setPaso('funda')}
          />
        )}
      </div>

      <BarraNavegacion {...nav} />

      <footer className="mt-10 flex items-center justify-center gap-2 text-[11px] font-bold text-neutral-400">
        <img src={isotipo} alt="" className="w-4 h-4" />
        Plásticos Multiform · Departamento de Artes
      </footer>

      <TablaMangas
        abierta={showTableModal}
        onCerrar={cerrarTabla}
        tipoInicial="funda"
        medidaInicial={datos.tipo === 'funda' ? datos.medidaManga : ''}
      />
    </div>
  );
}
