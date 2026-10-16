/**
 * Plancha simulada a escala (pulgadas): la unidad del arte repetida en bandas × repeticiones,
 * las zonas de la tinta seleccionada y el rectángulo que se cobra.
 * Dibujar o ajustar una zona en cualquier celda la aplica a la unidad (y se repite en todas).
 */
import React, { useEffect, useRef, useState, type Dispatch } from 'react';
import { rectInAPx, rectPxAIn, type DimIn, type RectIn, type RectPx } from '../lib/medicion';
import { celdaEnPunto, type Celda, type Montaje } from '../lib/montaje';
import type { ArteCargado } from '../services/cargarArte';
import type { AccionMedidor, EstadoMedidor } from './medidorEstado';
import { COLORES_RECT } from './VisorArte';

interface Props {
  arte: ArteCargado;
  estado: EstadoMedidor;
  dispatch: Dispatch<AccionMedidor>;
  /** Marco de una unidad en px del arte y en pulgadas. */
  unidad: { px: RectPx; dim: DimIn };
  montaje: Montaje;
  /**
   * Qué se edita: 'general' = zona de la unidad (se repite en cada copia);
   * 'plancha' = zona propia de una tinta sobre la composición completa (no se repite);
   * null = solo lectura.
   */
  editable: 'general' | 'plancha' | null;
  /** Zona a mostrar: en coordenadas de la unidad, o de la plancha si `enPlancha`. */
  zona: RectIn | null;
  /** La zona está en pulgadas de plancha (una sola, no se repite). */
  enPlancha: boolean;
  /** Guarda una zona sobre la plancha completa (modo 'plancha'). */
  onZonaPlancha?: (r: RectIn) => void;
  /** Rectángulo cobrado de la zona mostrada (en pulgadas de plancha). */
  cobrado: RectIn | null;
  color: { trazo: string; relleno: string };
}

type Esq = 'ai' | 'ad' | 'bi' | 'bd';
type Arrastre =
  | { tipo: 'dibujar'; origen: { x: number; y: number }; x0: number; y0: number; x1: number; y1: number }
  | { tipo: 'mover'; x: number; y: number; base: RectIn; dx: number; dy: number }
  /** dx/dy: distancia de la esquina al puntero al empezar (la manija está fuera de la esquina). */
  | { tipo: 'esquina'; esq: Esq; base: RectIn; x: number; y: number; dx: number; dy: number };

const PAD = 1.2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const norm = (r: RectIn): RectIn => ({
  x0: Math.min(r.x0, r.x1),
  x1: Math.max(r.x0, r.x1),
  y0: Math.min(r.y0, r.y1),
  y1: Math.max(r.y0, r.y1),
});

export default function VisorMontaje({
  arte,
  estado: s,
  dispatch,
  unidad,
  montaje: m,
  editable,
  zona,
  enPlancha,
  onZonaPlancha,
  cobrado,
  color,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [k, setK] = useState(0.05); // pulgadas por px de pantalla
  const W = m.plancha.ancho;
  const H = m.plancha.alto;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const obs = new ResizeObserver(() => {
      const w = svg.getBoundingClientRect().width;
      if (w > 0) setK((W + 2 * PAD) / w);
    });
    obs.observe(svg);
    return () => obs.disconnect();
  }, [W]);

  const h = s.horizontalEsX;
  const u = unidad;
  const anchoU = u.dim.anchoIn;
  const altoU = u.dim.altoIn;
  // Celdas donde se puede dibujar (impresas). El dorso usa las mismas coordenadas que el frente.
  const imprimibles = m.celdas.filter((c) => c.impresa);
  const primera = imprimibles[0];
  // Sistema de coordenadas de la zona que se edita: la unidad (desde la primera copia) o la plancha.
  const origen = enPlancha ? { x: 0, y: 0 } : { x: primera?.x ?? 0, y: primera?.y ?? 0 };
  const limW = enPlancha ? W : anchoU;
  const limH = enPlancha ? H : altoU;

  const punto = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };

  const celdaEn = (x: number, y: number) => celdaEnPunto(m.celdas, x, y, anchoU);

  /** Guarda la zona editada: en la plancha (tinta) o en la unidad como px del arte (general). */
  const guardar = (r: RectIn) => {
    const n = norm(r);
    const z = { x0: clamp(n.x0, 0, limW), x1: clamp(n.x1, 0, limW), y0: clamp(n.y0, 0, limH), y1: clamp(n.y1, 0, limH) };
    if (enPlancha) onZonaPlancha?.(z);
    else dispatch({ t: 'DIBUJAR', rect: rectInAPx(z, u.px, u.dim, h) });
  };

  const iniciar = (e: React.PointerEvent, a: Arrastre) => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    terminado.current = false;
    setArrastre(a);
  };

  const onDown = (e: React.PointerEvent) => {
    if (!editable) return;
    const p = punto(e);
    if (enPlancha) {
      if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) return; // fuera de la plancha
      iniciar(e, { tipo: 'dibujar', origen: { x: 0, y: 0 }, x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      return;
    }
    const celda = celdaEn(p.x, p.y);
    if (!celda) return; // fuera de toda celda impresa: se ignora
    iniciar(e, { tipo: 'dibujar', origen: { x: celda.x, y: celda.y }, x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };

  const onMove = (e: React.PointerEvent) => {
    if (!arrastre) return;
    // Sin botón presionado: el navegador perdió el "soltar" (p. ej. se soltó fuera de la ventana).
    // Se cierra el rectángulo donde iba, en vez de seguir al mouse hasta el borde.
    if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
      onUp();
      return;
    }
    const p = punto(e);
    if (arrastre.tipo === 'dibujar') setArrastre({ ...arrastre, x1: p.x, y1: p.y });
    else if (arrastre.tipo === 'mover') setArrastre({ ...arrastre, dx: p.x - arrastre.x, dy: p.y - arrastre.y });
    else setArrastre({ ...arrastre, x: p.x, y: p.y });
  };

  const vistaPrevia = (): RectIn | null => {
    if (!arrastre) return null;
    if (arrastre.tipo === 'mover') {
      const b = arrastre.base;
      const w = b.x1 - b.x0;
      const hh = b.y1 - b.y0;
      const x0 = clamp(b.x0 + arrastre.dx, 0, limW - w);
      const y0 = clamp(b.y0 + arrastre.dy, 0, limH - hh);
      return { x0, x1: x0 + w, y0, y1: y0 + hh };
    }
    if (arrastre.tipo === 'esquina') {
      const b = { ...arrastre.base };
      const lx = clamp(arrastre.x + arrastre.dx - origen.x, 0, limW);
      const ly = clamp(arrastre.y + arrastre.dy - origen.y, 0, limH);
      if (arrastre.esq[0] === 'a') b.y0 = ly;
      else b.y1 = ly;
      if (arrastre.esq[1] === 'i') b.x0 = lx;
      else b.x1 = lx;
      return norm(b);
    }
    return null;
  };

  const terminado = useRef(false);
  const onUp = () => {
    if (!arrastre || terminado.current) return;
    terminado.current = true;
    if (arrastre?.tipo === 'dibujar' && !enPlancha) {
      // El rectángulo puede abarcar varias copias (p. ej. toda la impresión de la plancha):
      // el inicio se mide en la copia donde está la esquina superior izquierda y el final en la
      // copia donde está la esquina inferior derecha. Así, encerrar toda la plancha da la misma
      // zona por copia que dibujar sobre una sola.
      const minX = clamp(Math.min(arrastre.x0, arrastre.x1), 0, W);
      const maxX = clamp(Math.max(arrastre.x0, arrastre.x1), 0, W);
      const minY = clamp(Math.min(arrastre.y0, arrastre.y1), 0, H);
      const maxY = clamp(Math.max(arrastre.y0, arrastre.y1), 0, H);
      const o = arrastre.origen;
      const ini = celdaEn(minX, minY) ?? { x: o.x, y: o.y };
      const fin = celdaEn(maxX, maxY) ?? { x: o.x, y: o.y };
      guardar({ x0: minX - ini.x, x1: maxX - fin.x, y0: minY - ini.y, y1: maxY - fin.y });
    } else if (arrastre?.tipo === 'dibujar') {
      const o = arrastre.origen;
      guardar({ x0: arrastre.x0 - o.x, x1: arrastre.x1 - o.x, y0: arrastre.y0 - o.y, y1: arrastre.y1 - o.y });
    } else if (arrastre && !(arrastre.tipo === 'mover' && arrastre.dx === 0 && arrastre.dy === 0)) {
      const r = vistaPrevia();
      if (r) guardar(r);
    }
    setArrastre(null);
  };

  // Transformación del arte (px) a pulgadas de plancha para una celda.
  const transformar = (c: Celda) => {
    const wpx = u.px.der - u.px.izq;
    const hpx = u.px.aba - u.px.arr;
    if (h) {
      const sx = anchoU / wpx;
      const sy = altoU / hpx;
      return `matrix(${sx},0,0,${sy},${c.x - u.px.izq * sx},${c.y - u.px.arr * sy})`;
    }
    const kx = anchoU / hpx;
    const ky = altoU / wpx;
    return `matrix(0,${ky},${kx},0,${c.x - u.px.arr * kx},${c.y - u.px.izq * ky})`;
  };

  const zonaVista = vistaPrevia() ?? zona;
  const trazo = k * 2;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-100 overflow-hidden select-none touch-none">
      <svg
        ref={svgRef}
        viewBox={`${-PAD} ${-PAD} ${W + 2 * PAD} ${H + 2 * PAD}`}
        className={`w-full h-auto block [&_text]:pointer-events-none ${editable ? 'cursor-crosshair' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => onUp()}
        onLostPointerCapture={() => onUp()}
        onDragStart={(e) => e.preventDefault()}
        aria-label="Simulación de la plancha"
      >
        <defs>
          {m.celdas.map((c, i) => (
            <clipPath key={i} id={`celda-${i}`}>
              <rect x={c.x} y={c.y} width={c.ancho} height={c.alto} />
            </clipPath>
          ))}
        </defs>

        <rect x={0} y={0} width={W} height={H} fill="#fff" stroke="#334155" strokeWidth={trazo * 1.5} />

        {m.celdas.map((c, i) =>
          c.impresa ? (
            <g key={i} clipPath={`url(#celda-${i})`}>
              <image
                href={arte.dataUrl}
                width={arte.anchoPx}
                height={arte.altoPx}
                transform={transformar(c)}
                preserveAspectRatio="none"
                pointerEvents="none"
              />
            </g>
          ) : (
            <g key={i}>
              <rect x={c.x} y={c.y} width={c.ancho} height={c.alto} fill="#e5e5e5" />
              <text
                x={c.x + c.ancho / 2}
                y={c.y + c.alto / 2}
                textAnchor="middle"
                fontSize={Math.min(1.2, c.alto / 6)}
                fill="#737373"
                fontWeight={700}
              >
                Dorso sin impresión
              </text>
            </g>
          ),
        )}

        {/* Bordes de cada celda */}
        {m.celdas.map((c, i) => (
          <rect
            key={`b${i}`}
            x={c.x}
            y={c.y}
            width={c.ancho}
            height={c.alto}
            fill="none"
            stroke={m.traslape ? '#dc2626' : '#94a3b8'}
            strokeWidth={trazo * 0.6}
            strokeDasharray={`${trazo * 3} ${trazo * 2}`}
            pointerEvents="none"
          />
        ))}

        {/* Zona: una sola sobre la plancha, o repetida en cada celda impresa */}
        {zonaVista &&
          (enPlancha ? [{ x: 0, y: 0 }] : imprimibles).map((c, i) => (
            <rect
              key={`z${i}`}
              x={c.x + zonaVista.x0}
              y={c.y + zonaVista.y0}
              width={zonaVista.x1 - zonaVista.x0}
              height={zonaVista.y1 - zonaVista.y0}
              fill={color.relleno}
              stroke={color.trazo}
              strokeWidth={trazo}
              pointerEvents="none"
            />
          ))}

        {/* Rectángulo cobrado */}
        {cobrado && !arrastre && (
          <g pointerEvents="none">
            <rect
              x={cobrado.x0}
              y={cobrado.y0}
              width={cobrado.x1 - cobrado.x0}
              height={cobrado.y1 - cobrado.y0}
              fill="none"
              stroke={color.trazo}
              strokeWidth={trazo * 2.2}
              strokeDasharray={`${trazo * 6} ${trazo * 3}`}
            />
            <text
              x={cobrado.x0 + trazo * 3}
              y={cobrado.y0 - trazo * 3}
              fontSize={k * 13}
              fontWeight={800}
              fill={color.trazo}
              stroke="#fff"
              strokeWidth={k * 4}
              paintOrder="stroke"
            >
              Se cobra {(cobrado.x1 - cobrado.x0).toFixed(2)}" × {(cobrado.y1 - cobrado.y0).toFixed(2)}"
            </text>
          </g>
        )}

        {/* Manijas para ajustar en la primera celda. Van por fuera de cada esquina: arrastrar
            dentro de la zona (o desde su esquina) siempre dibuja una zona nueva. */}
        {editable && zona && (primera || enPlancha) && !arrastre && (
          <g>
            {(
              [
                ['ai', zona.x0, zona.y0],
                ['ad', zona.x1, zona.y0],
                ['bi', zona.x0, zona.y1],
                ['bd', zona.x1, zona.y1],
              ] as [Esq, number, number][]
            ).map(([esq, x, y]) => (
              <rect
                key={esq}
                // Separada 3 px de la esquina: empezar justo en la esquina dibuja una zona nueva.
                x={origen.x + x + (esq[1] === 'i' ? -k * 15 : k * 3)}
                y={origen.y + y + (esq[0] === 'a' ? -k * 15 : k * 3)}
                width={k * 12}
                height={k * 12}
                fill="#fff"
                stroke={color.trazo}
                strokeWidth={trazo}
                style={{ cursor: esq === 'ai' || esq === 'bd' ? 'nwse-resize' : 'nesw-resize' }}
                onPointerDown={(e) => {
                  const p = punto(e);
                  iniciar(e, { tipo: 'esquina', esq, base: zona, x: p.x, y: p.y, dx: origen.x + x - p.x, dy: origen.y + y - p.y });
                }}
              />
            ))}
          </g>
        )}

        {/* Rectángulo que se está dibujando */}
        {arrastre?.tipo === 'dibujar' && (
          <rect
            x={Math.min(arrastre.x0, arrastre.x1)}
            y={Math.min(arrastre.y0, arrastre.y1)}
            width={Math.abs(arrastre.x1 - arrastre.x0)}
            height={Math.abs(arrastre.y1 - arrastre.y0)}
            fill="rgba(79,70,229,0.08)"
            stroke="#4f46e5"
            strokeWidth={trazo}
            strokeDasharray={`${trazo * 3} ${trazo * 2}`}
            pointerEvents="none"
          />
        )}

        {/* Cotas de la plancha */}
        <text x={W / 2} y={-PAD / 3} textAnchor="middle" fontSize={k * 12} fill="#475569" fontWeight={700}>
          {+W.toFixed(3)}" a lo largo
        </text>
        <text
          x={-PAD / 3}
          y={H / 2}
          textAnchor="middle"
          fontSize={k * 12}
          fill="#475569"
          fontWeight={700}
          transform={`rotate(-90 ${-PAD / 3} ${H / 2})`}
        >
          {+H.toFixed(3)}" alrededor
        </text>
      </svg>
    </div>
  );
}

/** Zona guardada (px del arte) → coordenadas de la unidad. */
export function zonaEnUnidad(px: RectPx | null, unidad: { px: RectPx; dim: DimIn }, horizontalEsX: boolean): RectIn | null {
  return px ? rectPxAIn(px, unidad.px, unidad.dim, horizontalEsX) : null;
}

export { COLORES_RECT };
