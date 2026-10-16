/**
 * Visor del arte con capa SVG para dibujar, mover y redimensionar rectángulos.
 * Se usa en el paso ② (marco) y en el ③ (impresión y tintas).
 */
import React, { useEffect, useRef, useState, type Dispatch } from 'react';
import type { RectPx } from '../lib/medicion';
import type { ArteCargado } from '../services/cargarArte';
import { type AccionMedidor, type Esquina, type EstadoMedidor, type Objetivo } from './medidorEstado';

type Arrastre =
  | { tipo: 'dibujar'; x0: number; y0: number; x1: number; y1: number }
  | { tipo: 'mover'; obj: Objetivo; x: number; y: number }
  /** dx/dy: distancia de la esquina al puntero al empezar (la manija está fuera de la esquina). */
  | { tipo: 'redimensionar'; obj: Objetivo; esquina: Esquina; dx: number; dy: number };

export const COLORES_RECT = {
  marco: { trazo: '#334155', relleno: 'rgba(51,65,85,0.06)' },
  general: { trazo: '#4f46e5', relleno: 'rgba(79,70,229,0.12)' },
  tinta: { trazo: '#d97706', relleno: 'rgba(217,119,6,0.14)' },
};

interface Props {
  arte: ArteCargado;
  estado: EstadoMedidor;
  dispatch: Dispatch<AccionMedidor>;
  /** Rectángulo que se puede mover/redimensionar (null = ninguno). */
  editable: Objetivo | null;
  /** Mostrar el marco atenuado (paso ③) o resaltado (paso ②). */
  vista: 'marco' | 'impresion';
  /** Sin interacción (p. ej. marco ya confirmado en el paso ②). */
  soloLectura?: boolean;
}

export default function VisorArte({ arte, estado: s, dispatch, editable, vista, soloLectura = false }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [escalaVista, setEscalaVista] = useState(1);

  // Escala px de imagen por px de pantalla (para el tamaño de manijas y trazos).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const obs = new ResizeObserver(() => {
      const w = svg.getBoundingClientRect().width;
      if (w > 0) setEscalaVista(arte.anchoPx / w);
    });
    obs.observe(svg);
    return () => obs.disconnect();
  }, [arte]);

  const punto = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };

  const iniciar = (e: React.PointerEvent, a: Arrastre) => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    terminado.current = false;
    setArrastre(a);
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
    else if (arrastre.tipo === 'mover') {
      dispatch({ t: 'MOVER', obj: arrastre.obj, dx: p.x - arrastre.x, dy: p.y - arrastre.y });
      setArrastre({ ...arrastre, x: p.x, y: p.y });
    } else
      dispatch({ t: 'REDIMENSIONAR', obj: arrastre.obj, esquina: arrastre.esquina, x: p.x + arrastre.dx, y: p.y + arrastre.dy });
  };

  const terminado = useRef(false);
  const onUp = () => {
    if (!arrastre || terminado.current) return;
    terminado.current = true;
    if (arrastre?.tipo === 'dibujar') {
      dispatch({ t: 'DIBUJAR', rect: { izq: arrastre.x0, arr: arrastre.y0, der: arrastre.x1, aba: arrastre.y1 } });
    }
    setArrastre(null);
  };

  const manija = escalaVista * 7;
  const grosor = escalaVista * 2;
  const dibujando = arrastre?.tipo === 'dibujar';

  const rect = (
    r: RectPx | null,
    obj: Objetivo | null,
    color: { trazo: string; relleno: string },
    etiqueta: string,
    opciones: { punteado?: boolean; tenue?: boolean } = {},
  ) => {
    if (!r) return null;
    const activo = obj !== null && obj === editable && !dibujando;
    return (
      <g key={obj ?? etiqueta} opacity={opciones.tenue ? 0.45 : 1}>
        <rect
          x={r.izq}
          y={r.arr}
          width={r.der - r.izq}
          height={r.aba - r.arr}
          fill={color.relleno}
          stroke={color.trazo}
          strokeWidth={grosor}
          strokeDasharray={opciones.punteado ? `${grosor * 4} ${grosor * 3}` : undefined}
          // Arrastrar dentro del rectángulo dibuja uno nuevo (no lo mueve): ver las manijas para ajustar.
          style={{ pointerEvents: 'none' }}
        />
        <text x={r.izq + grosor * 3} y={r.arr - grosor * 3} fill={color.trazo} fontSize={escalaVista * 12} fontWeight={700}>
          {etiqueta}
        </text>
        {activo &&
          (
            [
              ['ai', r.izq, r.arr],
              ['ad', r.der, r.arr],
              ['bi', r.izq, r.aba],
              ['bd', r.der, r.aba],
            ] as [Esquina, number, number][]
          ).map(([esq, cx, cy]) => (
            <rect
              key={esq}
              // Separada de la esquina: empezar justo en la esquina dibuja un rectángulo nuevo.
              x={esq[1] === 'i' ? cx - manija * 2.4 : cx + manija * 0.4}
              y={esq[0] === 'a' ? cy - manija * 2.4 : cy + manija * 0.4}
              width={manija * 2}
              height={manija * 2}
              fill="#fff"
              stroke={color.trazo}
              strokeWidth={grosor}
              style={{ cursor: esq === 'ai' || esq === 'bd' ? 'nwse-resize' : 'nesw-resize' }}
              onPointerDown={(e) => {
                const p = punto(e);
                iniciar(e, { tipo: 'redimensionar', obj: obj!, esquina: esq, dx: cx - p.x, dy: cy - p.y });
              }}
            />
          ))}
      </g>
    );
  };

  const enImpresion = vista === 'impresion';

  return (
    <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50 select-none touch-none">
      <img src={arte.dataUrl} alt="Arte" className="w-full h-auto block" draggable={false} />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${arte.anchoPx} ${arte.altoPx}`}
        className={`absolute inset-0 w-full h-full [&_text]:pointer-events-none ${soloLectura ? 'pointer-events-none' : 'cursor-crosshair'}`}
        onPointerDown={(e) => {
          const p = punto(e);
          iniciar(e, { tipo: 'dibujar', x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => onUp()}
        onLostPointerCapture={() => onUp()}
        onDragStart={(e) => e.preventDefault()}
      >
        {rect(s.marcoPx, 'marco', COLORES_RECT.marco, 'Funda', { tenue: enImpresion })}
        {enImpresion &&
          rect(s.generalPx, 'general', COLORES_RECT.general, 'General', { tenue: s.tintaActiva !== null })}
        {arrastre?.tipo === 'dibujar' && (
          <rect
            x={Math.min(arrastre.x0, arrastre.x1)}
            y={Math.min(arrastre.y0, arrastre.y1)}
            width={Math.abs(arrastre.x1 - arrastre.x0)}
            height={Math.abs(arrastre.y1 - arrastre.y0)}
            fill="rgba(79,70,229,0.08)"
            stroke="#4f46e5"
            strokeWidth={grosor}
            strokeDasharray={`${grosor * 3} ${grosor * 2}`}
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
}
