# Flujo por pestañas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Reorganizar la app en pestañas ① Funda · ② Arte · ③ Impresión (sub-pestañas por tinta) · ④ Resultados, con la manga definida por el alto de la funda.
**Architecture:** Estado compartido en `App`; un componente por paso; `VisorArte` reutilizable; reducer con tintas sincronizadas a los colores.
**Tech Stack:** React 19, TS, Vite, Tailwind, Vitest, Playwright (verificación).
**Spec:** `docs/superpowers/specs/2026-10-14-pasos-pestanas-design.md`

## Global Constraints
- `medicion.ts` y la fórmula de `calcularConfiguraciones` no cambian; sus pruebas deben seguir pasando sin edición.
- Textos en español. Sin git en la carpeta del usuario: "Punto de control" = `npx vitest run` + `npx tsc --noEmit`.

## Review Focus
1. Bajar colores con una tinta activa en edición → `tintaActiva` vuelve a General si su índice desaparece. (Task 1)
2. Ir a ③ sin marco confirmado → pestaña deshabilitada; si el marco se anula (editar/orientación/modo) estando en ③, se vuelve a ②. (Task 3)
3. Resultados con formulario inválido → se muestra el error de `validarEntrada` en ④, no una tabla vacía. (Task 3)
4. Cambiar colores en ① después de medir → las tintas se sincronizan y el costo usa el nuevo número de colores. (Task 1, Task 3)
5. Limpiar → borra formulario, arte, medición y vuelve a ①. (Task 3)

---

### Task 1: Reducer con tintas + `mangaMasCercana`
**Files:** Modify `src/components/medidorEstado.ts`, `src/components/medidorEstado.test.ts`, `src/lib/costo.ts`, `src/lib/costo.test.ts`
**Interfaces (Produces):**
```ts
// medidorEstado.ts
export type Objetivo = 'marco' | 'general' | `tinta:${number}`
export interface Tinta { nombre: string; propia: boolean; rect: RectPx | null }
// EstadoMedidor: ajustesPx/ajusteActivo → tintas: Tinta[]; tintaActiva: number | null
// Acciones: quitar AGREGAR_AJUSTE, ACTIVAR_AJUSTE; agregar
//  { t:'SINCRONIZAR_TINTAS'; n:number } | { t:'NOMBRE_TINTA'; i:number; nombre:string }
//  | { t:'NOMBRES_TINTAS'; nombres:string[] } | { t:'ZONA_PROPIA'; i:number; propia:boolean }
//  | { t:'TINTA_ACTIVA'; i:number|null }
// costo.ts
export function mangaMasCercana(alto: number, tipo: 'funda'|'rollo'): { manga: number; reps: number; dev: number } | null
```
- [ ] Tests RED: `SINCRONIZAR_TINTAS` 0→4 crea "Tinta 1..4" (propia false); 4→5 conserva nombres; 4→2 recorta y `tintaActiva` 3 → null; `ZONA_PROPIA(i,false)` borra rect; `DIBUJAR` con `tintaActiva=i` y `propia` asigna a la tinta; `DIBUJAR` con `tintaActiva=i` sin `propia` activa `propia`; `aMedicion` incluye solo `propia && rect`; `NOMBRES_TINTAS` aplica nombres en orden sin cambiar la cantidad; `mangaMasCercana(9.75,'funda')` → 504/2/9.75, `(7.75,'funda')` → 404/2, igual a `calcularConfiguraciones(...)[0]` para altos [3.7, 7.75, 9.75, 12.3, 19]; `mangaMasCercana(0)` → null.
- [ ] Implementar; actualizar tests existentes que usaban `AGREGAR_AJUSTE`/`ACTIVAR_AJUSTE`/`ajuste:i`.
- [ ] GREEN + punto de control (tsc fallará en MedidorArte/App hasta Task 3).

### Task 2: `VisorArte` (extraído de MedidorArte)
**Files:** Create `src/components/VisorArte.tsx`
**Produces:** `VisorArte(props: { arte: ArteCargado; estado: EstadoMedidor; dispatch: Dispatch<AccionMedidor>; editable: Objetivo | null; nombresTintas?: boolean })` — imagen + SVG: dibujar (`DIBUJAR`), mover, redimensionar; dibuja marco, general, tintas propias, sugerencias. Lógica de puntero idéntica a `MedidorArte`.
- [ ] Extraer; verificado en Task 4 (navegador).

### Task 3: Pasos y App
**Files:** Create `BarraPasos.tsx`, `PasoFunda.tsx`, `PasoArte.tsx`, `PasoImpresion.tsx`, `PasoResultados.tsx`; Modify `App.tsx`; Delete `MedidorArte.tsx`.
- `App`: `paso: 'funda'|'arte'|'impresion'|'resultados'`; formulario; `arte`, `archivo`; `useReducer(medidorReducer)`; `useEffect` → `SINCRONIZAR_TINTAS(parseInt(colores)||0)`; `medicion = aMedicion(estado)`; si `!estado.marcoConfirmado && paso==='impresion'` → `setPaso('arte')`.
- `PasoFunda`: etiqueta "Alto de funda (define la manga)" / rollo "Distancia entre marquillas (define la manga)"; aviso `mangaMasCercana`; botones Siguiente/Ver resultados/Limpiar.
- `PasoArte`: contenido de paso marco de `MedidorArte` + IA; al confirmar: autollenado + aviso "Enviado a Funda: alto X, largo Y, bandas Z" con botón "Revisar en Funda"; IA: colores → formulario, `NOMBRES_TINTAS(tintas)`.
- `PasoImpresion`: margen; sub-pestañas General/Tintas con etiqueta; nombre editable; interruptor; panel de medidas (como antes).
- `PasoResultados`: `validarEntrada` → error o `calcularConfiguraciones` en `useMemo`; resumen; tarjeta y tabla actuales.
- [ ] `npx tsc --noEmit` limpio; `npx vitest run` verde; `npx vite build` OK.

### Task 4: Verificación en navegador
- [ ] Sin arte: ① 7.75/19/2/4 funda → ④ $834.02; aviso de manga 404 · 2 rep.
- [ ] Bananas PDF: ② marco → 29 × 9.75 → ① alto 9.75, largo 29, bandas 1, aviso 504 · 2 rep; ③ general → ④ ≈$585.69.
- [ ] Snowhite PNG plancha 2×2: ④ ≈$702.29; ③ pestaña Tinta 1 → nombre "Negro", zona propia, dibujar → ④ ≈$675.36.
- [ ] Review Focus 1, 2, 3, 5 en navegador; consola sin errores.
