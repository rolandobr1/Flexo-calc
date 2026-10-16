# Medidor de impresión en el arte — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el usuario suba un arte (imagen o PDF), marque la funda y la zona impresa, y la app cobre el rectángulo de plancha real (con margen, replicado en bandas × repeticiones, con ajustes por color).

**Architecture:** Dos módulos puros (`src/lib/medicion.ts`, `src/lib/costo.ts`) con toda la matemática y pruebas Vitest; un servicio de carga (`cargarArte.ts`, pdf.js) y el servicio Gemini ampliado; un componente `MedidorArte.tsx` cuya lógica de estado es un reducer puro probado; `App.tsx` solo orquesta.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind 4, `pdfjs-dist`, `@google/genai`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-14-medidor-impresion-design.md`

## Global Constraints

- Margen por defecto `1` pulgada por lado, editable; recorte **por lado** al borde de la plancha.
- Costo: `Σ área_color × 0.30 × 1.18`. Constantes: `COSTO_BASE_POR_AREA = 0.3`, `IVA = 1.18`, `MAX_PLATE_LENGTH = 50`.
- Sin medición (o sin rectángulo general), el resultado debe ser **idéntico** al actual: `ancho × reps × largo × bandas × 0.3 × 1.18 × colores`, mismo orden y mismas 8 filas.
- Eje X = a lo largo de la plancha (campo Largo, bandas). Eje Y = alrededor del cilindro (campo Ancho, repeticiones). Por defecto horizontal = X.
- Formatos: `image/jpeg`, `image/png`, `image/webp` (máx. 4 MB) y `application/pdf` (máx. 50 MB).
- PDF: pulgadas = puntos ÷ 72; render con lado mayor ≈ 2400 px; medidas de marco redondeadas al 1/8" más cercano.
- IA opcional: `box_2d = [ymin, xmin, ymax, xmax]` en 0–1000; se envía JPEG ≤ 4 MB, nunca el PDF; lista de modelos `['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']`.
- Textos de la interfaz en español.
- El proyecto **no usa git** (decisión del usuario): los pasos "Punto de control" sustituyen a los commits — correr `npm test` y `npm run lint` y marcar la tarea.

## Review Focus

1. **Rectángulo dibujado al revés o de tamaño cero** (arrastre de derecha a izquierda, clic sin arrastrar) → se normaliza; uno de < 4 px se ignora. Prueba en Tarea 1 (`normalizarRect`) y Tarea 5 (reducer ignora).
2. **Impresión dibujada parcialmente fuera del marco** → se recorta al marco, nunca área negativa. Prueba en Tarea 1.
3. **Fila de la tabla con desarrollo menor que el alto de la impresión** (`(r-1)·d + y1 > r·d`) → se recorta a `Py`, área nunca mayor que la plancha completa de esa fila. Prueba en Tarea 1.
4. **Más ajustes por color que colores en el formulario** → error "Hay más ajustes por color que colores." en vez de cálculo silencioso. Prueba en Tarea 2.
5. **Subir otro arte o cambiar de página después de medir** → la medición anterior se borra (no se aplica a un arte distinto). Prueba en Tarea 5.

---

### Task 1: Vitest + módulo de medición

**Files:**
- Modify: `package.json` (devDependency `vitest`; script `"test": "vitest run"`)
- Create: `src/lib/medicion.ts`
- Test: `src/lib/medicion.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RectPx { izq: number; arr: number; der: number; aba: number }
  export interface RectIn { x0: number; x1: number; y0: number; y1: number }   // pulgadas, relativo al marco
  export interface DimIn { anchoIn: number; altoIn: number }                    // X, Y
  export interface AjusteColor { tinta: string; rect: RectIn }
  export interface MedicionArte {
    modo: 'unidad' | 'plancha';
    marco: DimIn;
    general: RectIn;                 // obligatorio: sin general no hay MedicionArte
    ajustes: AjusteColor[];
    margenIn: number;
    bandasArte?: number; repsArte?: number;   // solo modo 'plancha'
  }
  export interface FilaPlancha { largo: number; dev: number; reps: number; bandas: number }
  export function normalizarRect(r: RectPx): RectPx
  export function rectPxAIn(rect: RectPx, marco: RectPx, marcoIn: DimIn, horizontalEsX?: boolean): RectIn
  export function redondearOctavo(v: number): number
  export function areaUnidad(rect: RectIn, fila: FilaPlancha, margenIn: number): number
  export function areaPlancha(rect: RectIn, marco: DimIn, margenIn: number): number
  export function areasPorColor(m: MedicionArte, colores: number, fila: FilaPlancha): number[]
  ```

- [ ] **Step 1: Instalar Vitest y agregar script**

Run: `npm install -D vitest` y agregar `"test": "vitest run"` a `scripts`.

- [ ] **Step 2: Escribir pruebas que fallan** en `src/lib/medicion.test.ts`

```ts
const bananas = { x0: 4.8, x1: 24.0, y0: 0.3, y1: 9.4 };
const snow = { x0: 4.0, x1: 34.0, y0: 0.25, y1: 15.25 };

test('Bananas unidad 504/2 reps/1 banda', () => {
  expect(areaUnidad(bananas, { largo: 29, dev: 9.75, reps: 2, bandas: 1 }, 1)).toBeCloseTo(21.2 * 19.5, 6); // 413.4
});
test('Snowhite plancha completa', () => {
  expect(areaPlancha(snow, { anchoIn: 38, altoIn: 15.5 }, 1)).toBeCloseTo(32 * 15.5, 6); // 496
});
test('recorte por lado: a 0.25" del borde crece solo 0.25"', () => {
  expect(areaPlancha({ x0: 0.25, x1: 10, y0: 5, y1: 6 }, { anchoIn: 20, altoIn: 20 }, 1)).toBeCloseTo(11 * 3, 6);
});
test('réplica con 2 bandas', () => {
  // X: 4.8-1 .. (1*29+24)+1 = 3.8..54 → recorte a 58 no aplica; Y: 0..min(19.5, 20.15)
  expect(areaUnidad(bananas, { largo: 29, dev: 9.75, reps: 2, bandas: 2 }, 1)).toBeCloseTo((54 - 3.8) * 19.5, 6);
});
test('desarrollo menor que la impresión: nunca supera la plancha', () => {
  const f = { largo: 29, dev: 7.0, reps: 2, bandas: 1 };
  expect(areaUnidad(bananas, f, 1)).toBeLessThanOrEqual(29 * 14.0);
});
test('normalizarRect invierte arrastre al revés', () => {
  expect(normalizarRect({ izq: 100, arr: 80, der: 10, aba: 5 })).toEqual({ izq: 10, arr: 5, der: 100, aba: 80 });
});
test('rectPxAIn recorta al marco y convierte', () => {
  const marco = { izq: 100, arr: 100, der: 1100, aba: 600 };      // 1000 x 500 px = 20 x 10 in
  expect(rectPxAIn({ izq: 50, arr: 200, der: 600, aba: 700 }, marco, { anchoIn: 20, altoIn: 10 }))
    .toEqual({ x0: 0, x1: 10, y0: 2, y1: 10 });
});
test('rectPxAIn con vertical = X intercambia ejes', () => {
  const marco = { izq: 0, arr: 0, der: 500, aba: 1000 };          // X vertical = 20 in, Y horizontal = 10 in
  expect(rectPxAIn({ izq: 0, arr: 500, der: 250, aba: 1000 }, marco, { anchoIn: 20, altoIn: 10 }, false))
    .toEqual({ x0: 10, x1: 20, y0: 0, y1: 5 });
});
test('redondearOctavo', () => {
  expect(redondearOctavo(28.98)).toBe(29); expect(redondearOctavo(9.74)).toBe(9.75);
});
test('areasPorColor: ajuste para un color, general para el resto', () => {
  const m: MedicionArte = { modo: 'plancha', marco: { anchoIn: 38, altoIn: 15.5 }, general: snow,
    ajustes: [{ tinta: 'Negro', rect: { x0: 6, x1: 32, y0: 1, y1: 14 } }], margenIn: 1, bandasArte: 2, repsArte: 2 };
  const a = areasPorColor(m, 4, { largo: 19, dev: 7.75, reps: 2, bandas: 2 });
  expect(a).toHaveLength(4);
  expect(a[0]).toBeCloseTo(28 * 15, 6);     // 420, ajuste
  expect(a.slice(1).every(v => Math.abs(v - 496) < 1e-6)).toBe(true);
});
```

- [ ] **Step 3: Correr y ver que fallan**

Run: `npx vitest run src/lib/medicion.test.ts` — Expected: FAIL (módulo no existe).

- [ ] **Step 4: Implementar `src/lib/medicion.ts`**

Fórmulas exactas de la spec §6.2 (unidad) y §6.3 (plancha). `rectPxAIn`: normaliza, recorta al marco en px, escala por eje (`anchoIn / anchoPx`, `altoIn / altoPx` sobre el eje que corresponda); con `horizontalEsX = false`, X se mide en el eje vertical de la imagen desde `marco.arr` e Y en el horizontal desde `marco.izq`. `areasPorColor`: los ajustes ocupan los primeros índices, el resto usa `general`; en modo `'unidad'` usa `areaUnidad`, en `'plancha'` usa `areaPlancha` (la proporción se aplica en `costo.ts`). Área nunca negativa (`Math.max(0, …)`).

- [ ] **Step 5: Correr y ver que pasan**

Run: `npx vitest run src/lib/medicion.test.ts` — Expected: PASS (10 pruebas).

- [ ] **Step 6: Punto de control** — `npm run lint` sin errores.

---

### Task 2: Módulo de costo (extraer lógica de `App.tsx`)

**Files:**
- Create: `src/lib/costo.ts`
- Test: `src/lib/costo.test.ts`

**Interfaces:**
- Consumes: `MedicionArte`, `areasPorColor`, `areaPlancha` (Task 1).
- Produces:
  ```ts
  export const MANGA_DATABASE   // movida tal cual desde App.tsx
  export const MAX_PLATE_LENGTH = 50, COSTO_BASE_POR_AREA = 0.3, IVA = 1.18
  export interface Configuration {
    manga: number; reps: number; exactDev: number; type: 'funda' | 'rollo'; bands: number;
    area: number;          // suma de áreas de todos los colores ÷ colores (área por color promedio)
    costoTotal: number; id: string; diff: number; isAbove: boolean; estimado: boolean;
  }
  export interface EntradaCalculo {
    ancho: number; largo: number; colores: number; bandas: number;
    tipo: 'funda' | 'rollo'; medicion: MedicionArte | null;
  }
  export function validarEntrada(e: EntradaCalculo): string | null
  export function calcularConfiguraciones(e: EntradaCalculo): Configuration[]
  ```

- [ ] **Step 1: Escribir pruebas que fallan** en `src/lib/costo.test.ts`

```ts
const base = { ancho: 7.75, largo: 19, colores: 4, bandas: 2, tipo: 'funda' as const };

test('regresión sin medición: igual que la app actual', () => {
  const r = calcularConfiguraciones({ ...base, medicion: null });
  expect(r).toHaveLength(8);
  expect(r[0]).toMatchObject({ manga: 404, reps: 2, exactDev: 7.75, diff: 0, estimado: false });
  expect(r[0].costoTotal).toBeCloseTo(834.024, 3);
  r.forEach(c => expect(c.costoTotal).toBeCloseTo(7.75 * c.reps * 19 * 2 * 0.3 * 1.18 * 4, 6));
});
test('Snowhite modo plancha: 702.34, exacto en la fila del arte', () => {
  const med = { modo: 'plancha', marco: { anchoIn: 38, altoIn: 15.5 }, general: { x0: 4, x1: 34, y0: 0.25, y1: 15.25 },
    ajustes: [], margenIn: 1, bandasArte: 2, repsArte: 2 } as const;
  const r = calcularConfiguraciones({ ...base, medicion: med });
  const fila = r.find(c => c.manga === 404 && c.reps === 2)!;
  expect(fila.costoTotal).toBeCloseTo(702.336, 3);
  expect(fila.estimado).toBe(false);
  expect(r.filter(c => c.reps !== 2).every(c => c.estimado)).toBe(true);
});
test('Snowhite + ajuste del negro: 675.43', () => {
  const med = { modo: 'plancha', marco: { anchoIn: 38, altoIn: 15.5 }, general: { x0: 4, x1: 34, y0: 0.25, y1: 15.25 },
    ajustes: [{ tinta: 'Negro', rect: { x0: 6, x1: 32, y0: 1, y1: 14 } }], margenIn: 1, bandasArte: 2, repsArte: 2 } as const;
  const fila = calcularConfiguraciones({ ...base, medicion: med }).find(c => c.manga === 404 && c.reps === 2)!;
  expect(fila.costoTotal).toBeCloseTo(675.432, 3);
});
test('Bananas modo unidad: 504/2 = 413.4 por color, no estimado', () => {
  const med = { modo: 'unidad', marco: { anchoIn: 29, altoIn: 9.75 }, general: { x0: 4.8, x1: 24, y0: 0.3, y1: 9.4 },
    ajustes: [], margenIn: 1 } as const;
  const r = calcularConfiguraciones({ ancho: 9.75, largo: 29, colores: 4, bandas: 1, tipo: 'funda', medicion: med });
  const fila = r.find(c => c.manga === 504 && c.reps === 2)!;
  expect(fila.costoTotal).toBeCloseTo(413.4 * 0.354 * 4, 3);   // 585.374
  expect(r.every(c => !c.estimado)).toBe(true);
});
test('validarEntrada: mensajes actuales y ajustes > colores', () => {
  expect(validarEntrada({ ...base, colores: 9, medicion: null })).toBe('El número máximo de colores permitido es 8.');
  const med = { modo: 'unidad', marco: { anchoIn: 29, altoIn: 9.75 }, general: { x0: 0, x1: 1, y0: 0, y1: 1 },
    ajustes: [{ tinta: 'A', rect: { x0: 0, x1: 1, y0: 0, y1: 1 } }, { tinta: 'B', rect: { x0: 0, x1: 1, y0: 0, y1: 1 } }], margenIn: 1 } as const;
  expect(validarEntrada({ ...base, colores: 1, medicion: med })).toBe('Hay más ajustes por color que colores.');
});
```

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run src/lib/costo.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/lib/costo.ts`**

`validarEntrada` reproduce **literalmente** los mensajes y el orden de `calculate()` en `App.tsx` (líneas 177–200) y agrega la regla de ajustes al final. `calcularConfiguraciones` reproduce la selección actual (4 por encima + 4 por debajo, orden por `diff`) y calcula el costo por fila:
- `medicion === null`: fórmula actual.
- `modo 'unidad'`: `fila = { largo, dev: exactDev, reps, bandas }`; `costo = Σ areasPorColor(...) × 0.3 × 1.18`; `estimado = false`.
- `modo 'plancha'`: por color `proporción = área_color / (marco.anchoIn × marco.altoIn)`; `costo = Σ (ancho × reps × largo × bandas × proporción) × 0.3 × 1.18`; `estimado = reps !== repsArte || bandas !== bandasArte`.

- [ ] **Step 4: Correr y ver que pasan** — `npm test` → PASS (Tasks 1 y 2).

- [ ] **Step 5: Punto de control** — `npm run lint`.

---

### Task 3: Carga de arte (imagen y PDF)

**Files:**
- Modify: `package.json` (dependency `pdfjs-dist`)
- Create: `src/services/cargarArte.ts`
- Test: `src/services/cargarArte.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const LIMITE_IMAGEN_MB = 4, LIMITE_PDF_MB = 50
  export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
  export interface ArteCargado {
    dataUrl: string; anchoPx: number; altoPx: number;
    paginas: number; pagina: number;
    pulgadasPorPx: number | null;   // solo PDF
  }
  export function validarArchivo(f: { type: string; size: number }): string | null
  export function escalaPdf(anchoPaginaPt: number, anchoRenderPx: number): number   // pt/72/px
  export function cargarArte(file: File, pagina?: number): Promise<ArteCargado>
  export function imagenParaIA(arte: ArteCargado): Promise<{ base64: string; mime: 'image/jpeg' }>
  ```

- [ ] **Step 1: Pruebas que fallan** (solo las funciones puras; pdf.js necesita navegador)

```ts
test('validarArchivo', () => {
  expect(validarArchivo({ type: 'application/pdf', size: 40e6 })).toBeNull();
  expect(validarArchivo({ type: 'application/pdf', size: 51 * 1024 * 1024 })).toBe('El PDF supera el límite de 50MB.');
  expect(validarArchivo({ type: 'image/png', size: 5 * 1024 * 1024 })).toBe('La imagen supera el límite de 4MB.');
  expect(validarArchivo({ type: 'image/gif', size: 10 })).toBe('Formato no soportado. Use JPG, PNG, WEBP o PDF.');
});
test('escalaPdf: BBGST416 página 2354.95 pt renderizada a 2400 px', () => {
  expect(escalaPdf(2354.95, 2400) * 2400).toBeCloseTo(32.708, 3);
});
```

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run src/services/cargarArte.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

`npm install pdfjs-dist`. Worker: `GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`. PDF: `getDocument({ data })`, `getPage(pagina)`, escala de render `2400 / max(viewport.width, viewport.height)` (con escala 1), render a `<canvas>` y `toDataURL('image/png')`; `pulgadasPorPx = escalaPdf(viewport1.width, canvas.width)`. Errores: `PasswordException` → `'El PDF está protegido con contraseña.'`; cualquier otro → `'No se pudo abrir el PDF.'`. Imagen: `FileReader` + `Image` para medir px, `pulgadasPorPx = null`. `imagenParaIA`: redimensiona a lado mayor ≤ 2000 px, JPEG calidad 0.85, devuelve base64 sin prefijo.

- [ ] **Step 4: Correr y ver que pasan** — `npm test` → PASS.

- [ ] **Step 5: Punto de control** — `npm run lint`.

---

### Task 4: Servicio Gemini — sugerencias de zonas

**Files:**
- Modify: `src/services/geminiVision.ts` (reescribir interfaz y prompt)
- Delete: `src/services/geminiVision.ts.bak`
- Test: `src/services/geminiVision.test.ts`

**Interfaces:**
- Consumes: `RectPx` (Task 1).
- Produces:
  ```ts
  export type Box2d = [number, number, number, number]   // ymin, xmin, ymax, xmax (0–1000)
  export type Confianza = 'high' | 'medium' | 'low' | 'none'
  export interface SugerenciaIA {
    marco: { box: Box2d | null; anchoIn: number | null; altoIn: number | null };   // medidas leídas de cotas, ancho = horizontal
    impresion: { box: Box2d | null };
    colores: number | null; tintas: string[];
    tipo_producto: 'rollo' | 'funda' | null; observaciones: string;
    confidence: { colores: Confianza; dimensiones: Confianza; impresion: Confianza; tipo_producto: Confianza };
  }
  export const MODELOS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
  export function box2dARectPx(b: Box2d, anchoPx: number, altoPx: number): RectPx
  export function parsearSugerencia(raw: string): SugerenciaIA
  export function esErrorRecuperable(msg: string): boolean
  export function sugerirZonas(base64: string, mime: 'image/jpeg'): Promise<SugerenciaIA>
  ```

- [ ] **Step 1: Pruebas que fallan**

```ts
test('box2dARectPx', () => {
  expect(box2dARectPx([100, 200, 900, 800], 2000, 1000)).toEqual({ izq: 400, arr: 100, der: 1600, aba: 900 });
});
test('parsearSugerencia quita ```json y coacciona tipos inválidos', () => {
  const s = parsearSugerencia('```json\n{"marco":{"box_2d":[0,0,1000,1000],"ancho_in":"x","alto_in":9.75},"impresion":{"box_2d":[1,2,3]},"colores":4.4,"tintas":["Cyan",5],"tipo_producto":"caja"}\n```');
  expect(s.marco).toEqual({ box: [0, 0, 1000, 1000], anchoIn: null, altoIn: 9.75 });
  expect(s.impresion.box).toBeNull();          // box inválido (3 elementos)
  expect(s.colores).toBe(4);
  expect(s.tintas).toEqual(['Cyan']);
  expect(s.tipo_producto).toBeNull();
  expect(s.confidence.impresion).toBe('none');
});
test('parsearSugerencia con texto no JSON lanza mensaje claro', () => {
  expect(() => parsearSugerencia('hola')).toThrow('La IA devolvió una respuesta inesperada');
});
test('esErrorRecuperable', () => {
  ['429', 'RESOURCE_EXHAUSTED', 'quota exceeded', '404 NOT_FOUND', 'model not found'].forEach(m => expect(esErrorRecuperable(m)).toBe(true));
  expect(esErrorRecuperable('API key not valid')).toBe(false);
});
```

- [ ] **Step 2: Correr y ver que fallan** — FAIL.

- [ ] **Step 3: Implementar**

Prompt: conservar las reglas de colores del prompt actual; reemplazar dimensiones/largo neto por: (a) `marco.box_2d` = funda/unidad completa (área del producto, sin cotas), `ancho_in`/`alto_in` leídos de las cotas escritas, convertir mm a pulgadas; (b) `impresion.box_2d` = rectángulo mínimo que encierra todo lo impreso dentro del marco; (c) `tintas` desde puntos de registro si existen. `sugerirZonas` itera `MODELOS`; si `esErrorRecuperable` pasa al siguiente; si no, relanza; si se agotan: `'No se pudo obtener sugerencias de la IA. Puedes continuar midiendo a mano.'`. Clave: `import.meta.env.VITE_GEMINI_API_KEY` (sin cambio).

- [ ] **Step 4: Correr y ver que pasan** — `npm test` → PASS.

- [ ] **Step 5: Punto de control** — `npm run lint` (fallará en `App.tsx` por la interfaz vieja: se arregla en Task 6; anotar).

---

### Task 5: Componente `MedidorArte` (reducer + vista SVG)

**Files:**
- Create: `src/components/medidorEstado.ts` (reducer puro)
- Create: `src/components/MedidorArte.tsx`
- Test: `src/components/medidorEstado.test.ts`

**Interfaces:**
- Consumes: `RectPx`, `DimIn`, `MedicionArte`, `normalizarRect`, `rectPxAIn`, `redondearOctavo` (Task 1); `ArteCargado`, `cargarArte`, `validarArchivo`, `imagenParaIA` (Task 3); `SugerenciaIA`, `sugerirZonas`, `box2dARectPx` (Task 4).
- Produces:
  ```ts
  // medidorEstado.ts
  export type Objetivo = 'marco' | 'general' | `ajuste:${number}`
  export type Esquina = 'ai' | 'ad' | 'bi' | 'bd'
  export interface EstadoMedidor {
    modo: 'unidad' | 'plancha'; paso: 'marco' | 'impresion';
    horizontalEsX: boolean; margenIn: number;
    marcoPx: RectPx | null; marcoIn: DimIn | null; marcoConfirmado: boolean;
    generalPx: RectPx | null; ajustesPx: { tinta: string; rect: RectPx | null }[]; ajusteActivo: number | null;
    sugerencia: { marco: RectPx | null; impresion: RectPx | null; marcoIn: DimIn | null } | null;
    bandasArte: number; repsArte: number;
  }
  export type AccionMedidor =
    | { t: 'NUEVO_ARTE' } | { t: 'MODO'; modo: 'unidad' | 'plancha' } | { t: 'ORIENTACION'; horizontalEsX: boolean }
    | { t: 'DIBUJAR'; rect: RectPx } | { t: 'MOVER'; obj: Objetivo; dx: number; dy: number }
    | { t: 'REDIMENSIONAR'; obj: Objetivo; esquina: Esquina; x: number; y: number }
    | { t: 'BORRAR'; obj: Objetivo } | { t: 'CONFIRMAR_MARCO'; dim: DimIn }
    | { t: 'AGREGAR_AJUSTE'; tinta: string } | { t: 'SUGERENCIA'; s: EstadoMedidor['sugerencia'] }
    | { t: 'ACEPTAR_SUGERENCIA' } | { t: 'DESCARTAR_SUGERENCIA' }
    | { t: 'MARGEN'; margenIn: number } | { t: 'ARTE_GRID'; bandasArte: number; repsArte: number }
  export const estadoInicial: EstadoMedidor      // modo 'unidad', paso 'marco', horizontalEsX true, margenIn 1, bandasArte 1, repsArte 1
  export function medidorReducer(s: EstadoMedidor, a: AccionMedidor): EstadoMedidor
  export function aMedicion(s: EstadoMedidor): MedicionArte | null   // null si falta marco confirmado o general
  export function medidaMarcoPdf(marcoPx: RectPx, pulgadasPorPx: number, horizontalEsX: boolean): DimIn  // redondeada a 1/8"

  // MedidorArte.tsx
  export interface AutollenadoCampos { ancho?: string; largo?: string; bandas?: string; colores?: string; tipo?: 'rollo' | 'funda' }
  export default function MedidorArte(props: {
    colores: number;                                   // para validar ajustes
    onMedicion: (m: MedicionArte | null) => void;
    onAutollenar: (c: AutollenadoCampos) => void;
  }): JSX.Element
  ```

- [ ] **Step 1: Pruebas que fallan** en `medidorEstado.test.ts`

```ts
const r = (izq: number, arr: number, der: number, aba: number) => ({ izq, arr, der, aba });

test('DIBUJAR en paso marco asigna marco normalizado; < 4 px se ignora', () => {
  let s = medidorReducer(estadoInicial, { t: 'DIBUJAR', rect: r(500, 300, 100, 100) });
  expect(s.marcoPx).toEqual(r(100, 100, 500, 300));
  expect(medidorReducer(s, { t: 'DIBUJAR', rect: r(10, 10, 12, 12) })).toBe(s);
});
test('CONFIRMAR_MARCO pasa a impresión y DIBUJAR asigna el general', () => {
  let s = medidorReducer(estadoInicial, { t: 'DIBUJAR', rect: r(0, 0, 2900, 975) });
  s = medidorReducer(s, { t: 'CONFIRMAR_MARCO', dim: { anchoIn: 29, altoIn: 9.75 } });
  expect(s.paso).toBe('impresion');
  s = medidorReducer(s, { t: 'DIBUJAR', rect: r(480, 30, 2400, 940) });
  const m = aMedicion(s)!;
  expect(m).toMatchObject({ modo: 'unidad', marco: { anchoIn: 29, altoIn: 9.75 }, margenIn: 1, ajustes: [] });
  expect(m.general.x0).toBeCloseTo(4.8, 9); expect(m.general.x1).toBeCloseTo(24, 9);
  expect(m.general.y0).toBeCloseTo(0.3, 9); expect(m.general.y1).toBeCloseTo(9.4, 9);
});
test('AGREGAR_AJUSTE + DIBUJAR asigna al ajuste activo', () => {
  /* marco confirmado como arriba, luego */
  // s = medidorReducer(s, { t: 'AGREGAR_AJUSTE', tinta: 'Negro' }); DIBUJAR → s.ajustesPx[0].rect definido, aMedicion(s).ajustes[0].tinta === 'Negro'
});
test('ACEPTAR_SUGERENCIA copia marco, medidas e impresión', () => { /* SUGERENCIA → ACEPTAR → marcoPx, marcoIn y generalPx iguales a la sugerencia; sugerencia null */ });
test('NUEVO_ARTE borra la medición', () => {
  // estado con marco y general → NUEVO_ARTE → aMedicion(s) === null y paso === 'marco', pero modo/margen/orientación se conservan
});
test('MOVER y REDIMENSIONAR no sacan el rect del marco y mantienen orden de bordes', () => { /* REDIMENSIONAR esquina 'ai' más allá de 'der' → normalizado */ });
test('medidaMarcoPdf: 28.98 x 9.75 pulgadas → 29 x 9.75', () => {
  const ppx = 32.708 / 2400;
  expect(medidaMarcoPdf(r(0, 0, Math.round(28.98 / ppx), Math.round(9.75 / ppx)), ppx, true)).toEqual({ anchoIn: 29, altoIn: 9.75 });
});
```
(Los cuerpos comentados se escriben completos con las mismas aserciones descritas.)

- [ ] **Step 2: Correr y ver que fallan** — FAIL.

- [ ] **Step 3: Implementar `medidorEstado.ts`** — transiciones según los tipos de arriba; `DIBUJAR` en paso `'impresion'` asigna a `ajustesPx[ajusteActivo]` si hay ajuste activo, si no a `generalPx`; `MOVER`/`REDIMENSIONAR` sobre el general o ajustes se recortan a `marcoPx`.

- [ ] **Step 4: Correr y ver que pasan** — `npm test` → PASS.

- [ ] **Step 5: Implementar `MedidorArte.tsx`**

Estructura: zona de subida (arrastrar/clic, `accept` = `TIPOS_ACEPTADOS`) → al cargar: `dispatch({t:'NUEVO_ARTE'})`. Selector de página si `paginas > 1` (recarga con `cargarArte(file, n)` + `NUEVO_ARTE`). Controles: modo (unidad/plancha completa), orientación ("Horizontal = a lo largo" / "Vertical = a lo largo"), margen (número, paso 0.125). Visor: `<img>` + `<svg viewBox="0 0 anchoPx altoPx">` superpuesto; puntero → coordenadas de imagen con `getScreenCTM().inverse()`. Arrastre en vacío = `DIBUJAR`; arrastre en interior = `MOVER`; 4 manijas = `REDIMENSIONAR`. Colores: marco gris oscuro, general índigo, ajustes ámbar, sugerencias punteadas violeta con botones Aceptar/Descartar. Paso marco: inputs ancho/alto (prellenados con `medidaMarcoPdf` si `pulgadasPorPx`) + en modo plancha inputs "Bandas en el arte" / "Repeticiones en el arte" + botón "Confirmar marco" → `CONFIRMAR_MARCO` y `onAutollenar`:
  - unidad: `{ largo: X.toString(), ancho: Y.toString(), bandas: floor(50 / X).toString(), tipo: 'funda' }`
  - plancha: `{ largo: (X / bandasArte), ancho: (Y / repsArte), bandas: bandasArte }` como strings
Paso impresión: botón "+ Ajuste por color" (pide nombre de tinta; ofrece `tintas` de la IA si las hay) y lista de ajustes con borrar. Panel lateral: medidas en pulgadas de general/ajustes con y sin margen (usando `rectPxAIn`), y ahorro `1 − áreaPlancha/áreaMarco` en modo plancha. Botón "✨ Sugerir con IA": `imagenParaIA` → `sugerirZonas` → `box2dARectPx` → `SUGERENCIA`; si la IA trae `colores`/`tipo_producto` → `onAutollenar({ colores, tipo })`; errores en recuadro rojo sin bloquear. `useEffect` emite `onMedicion(aMedicion(estado))` en cada cambio.

- [ ] **Step 6: Punto de control** — `npm test` PASS.

---

### Task 6: Integración en `App.tsx` y arreglos

**Files:**
- Modify: `src/App.tsx`
- Modify: `index.html` (título `FlexoCalc Pro`)

**Interfaces:**
- Consumes: `calcularConfiguraciones`, `validarEntrada`, `MANGA_DATABASE`, `MAX_PLATE_LENGTH`, `Configuration` (Task 2); `MedidorArte`, `AutollenadoCampos` (Task 5); `MedicionArte` (Task 1).

- [ ] **Step 1: Quitar de `App.tsx`**: `MANGA_DATABASE` y constantes (ahora importadas), `Configuration` local, estado y handlers de IA (`aiImage`, `aiAnalyzing`, `aiResult`, `aiError`, `isDragOver`, `fileInputRef`, `handleImageFile`, `handleDrop`, `clearAiImage`), la sección "Análisis con IA", el estado `largoNeto` y su bloque "Opcional", `showAreaBreakdown`, la variable `label`.

- [ ] **Step 2: Agregar**: estado `medicion: MedicionArte | null`; `<MedidorArte colores={parseInt(colores) || 0} onMedicion={setMedicion} onAutollenar={...} />` entre el header y el formulario; `onAutollenar` llama `setAncho`, `handleLargoChange`, `setBandasManual`, `setColores`, `setTipoProducto` según los campos presentes (después de `largo`, aplicar `bandas` para que no lo pise la sugerencia automática). `calculate()` = `validarEntrada` → `calcularConfiguraciones` con `medicion`.

- [ ] **Step 3: Etiquetas**: campo ancho → `"Ancho de Funda (alrededor del cilindro)"` en funda / `"Distancia entre Marquillas (alrededor del cilindro)"` en rollo; campo largo → `"Largo (a lo largo de la plancha)"`. Tabla: columna nueva o etiqueta junto al costo `"estimado"` (gris) cuando `item.estimado`. Tarjeta "Mejor opción": si hay medición, subtítulo `"Área cobrada: {area.toFixed(1)} pulg² por color"`. Nota al pie: agregar `"Margen de {margen}" por lado."` cuando hay medición.

- [ ] **Step 4: Verificar** — `npm run lint` sin errores; `npm test` PASS.

- [ ] **Step 5: Punto de control.**

---

### Task 7: Verificación final con los artes reales

**Files:** ninguno (solo verificación).

- [ ] **Step 1:** `npm run build` → termina sin errores.
- [ ] **Step 2:** `npm run dev`, abrir `http://localhost:3000`.
- [ ] **Step 3: Bananas (PDF `BBGST416_v3.pdf`)** — modo unidad; dibujar marco sobre el área gris → medidas propuestas `29` × `9.75`; confirmar → Largo 29, Ancho 9.75, Bandas 1, Tipo funda; dibujar impresión de ≈4.8" a 24.0" → panel ≈ 21.2" con margen; calcular con 4 colores → fila 504 / 2 rep ≈ $585, sin "estimado".
- [ ] **Step 4: Snowhite (PNG)** — modo plancha completa, bandas 2, repeticiones 2; marco 38 × 15.5 → Largo 19, Ancho 7.75; impresión 4.0→34.0 × 0.25→15.25 → 404/2 ≈ $702.34; agregar ajuste "Negro" ≈ 26 × 13 → ≈ $675.43; filas con otras repeticiones marcadas "estimado".
- [ ] **Step 5: Sin IA** — quitar `VITE_GEMINI_API_KEY` temporalmente: medir a mano funciona; "Sugerir con IA" muestra error sin bloquear. Restaurar la clave.
- [ ] **Step 6: Sin medidor** — calcular 7.75 / 19 / 2 bandas / 4 colores funda sin subir arte → $834.02 (igual que hoy).
- [ ] **Step 7: Casos de Review Focus** — arrastrar al revés, clic sin arrastrar, impresión fuera del marco, subir otro arte (se borra la medición), 2 ajustes con 1 color (mensaje de error).
