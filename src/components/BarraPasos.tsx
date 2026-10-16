import React from 'react';
import { Check } from 'lucide-react';

export type PasoId = 'funda' | 'arte' | 'montaje' | 'resultados';

export interface InfoPaso {
  id: PasoId;
  titulo: string;
  completo: boolean;
  disponible: boolean;
}

export default function BarraPasos({
  pasos,
  activo,
  onIr,
}: {
  pasos: InfoPaso[];
  activo: PasoId;
  onIr: (p: PasoId) => void;
}) {
  return (
    <nav className="bg-white rounded-3xl shadow-sm border border-neutral-200 p-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
      {pasos.map((p, i) => {
        const esActivo = p.id === activo;
        return (
          <button
            key={p.id}
            onClick={() => p.disponible && onIr(p.id)}
            disabled={!p.disponible}
            aria-current={esActivo ? 'step' : undefined}
            aria-label={p.titulo}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out ${
              esActivo
                ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-200'
                : p.disponible
                  ? 'hover:bg-neutral-100 text-neutral-700'
                  : 'text-neutral-300 cursor-not-allowed'
            }`}
          >
            <span
              className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black ${
                esActivo
                  ? 'bg-brand-600 text-white'
                  : p.completo
                    ? 'bg-emerald-500 text-white'
                    : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {p.completo && !esActivo ? <Check className="w-4 h-4" /> : i + 1}
            </span>
            <span className="text-sm font-bold">{p.titulo}</span>
          </button>
        );
      })}
    </nav>
  );
}
