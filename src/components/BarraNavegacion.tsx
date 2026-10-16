/**
 * Barra de navegación fija abajo, igual en todos los pasos:
 * izquierda "Atrás", centro un atajo opcional (texto), derecha la única acción principal.
 */
import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export interface AccionNav {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Explica por qué el botón principal está deshabilitado. */
  pista?: string;
}

interface Props {
  atras?: AccionNav;
  atajo?: AccionNav;
  principal?: AccionNav;
}

export const presionable = 'transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out active:scale-[0.97]';

export default function BarraNavegacion({ atras, atajo, principal }: Props) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-neutral-200 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {atras && (
            <button
              onClick={atras.onClick}
              className={`flex items-center gap-1 text-sm font-bold text-neutral-500 hover:text-neutral-900 px-2 py-2 rounded-lg ${presionable}`}
            >
              <ArrowLeft className="w-4 h-4" /> {atras.label}
            </button>
          )}
        </div>

        {atajo && (
          <button
            onClick={atajo.onClick}
            disabled={atajo.disabled}
            className={`text-xs font-bold text-neutral-500 hover:text-brand-700 underline-offset-4 hover:underline px-2 py-2 disabled:opacity-40 ${presionable}`}
          >
            {atajo.label}
          </button>
        )}

        {principal && (
          <div className="flex items-center gap-3">
            {principal.disabled && principal.pista && (
              <span className="hidden sm:block text-[11px] font-bold text-amber-700 text-right max-w-[16rem]">
                {principal.pista}
              </span>
            )}
            <button
              onClick={principal.onClick}
              disabled={principal.disabled}
              title={principal.disabled ? principal.pista : undefined}
              data-nav="principal"
              className={`flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-5 rounded-xl text-sm shadow-lg shadow-brand-200 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed ${presionable}`}
            >
              {principal.label} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
