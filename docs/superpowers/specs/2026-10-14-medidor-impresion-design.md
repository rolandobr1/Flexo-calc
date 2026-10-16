# Medidor de impresión en el arte — Diseño

**Proyecto:** FlexoCalc Pro
**Fecha:** 2026-10-14
**Estado:** Diseño aprobado en conversación, pendiente de revisión escrita

---

## 1. Problema

La app calcula el costo de plancha con el área completa de la funda/plancha. En la práctica, muchas veces la impresión ocupa solo parte de la funda (fuelles, zonas de sellado, paneles sin imprimir) y el proveedor cobra por el **rectángulo que encierra toda la impresión de cada color**, más un margen. Hoy eso se aproxima a mano con el campo "largo neto", que solo reduce una dimensión y no sabe cómo se repite la impresión en bandas × repeticiones.

## 2. Objetivo y criterios de éxito

El usuario sube el arte (imagen o PDF), marca la funda y la zona impresa, y la app calcula el costo con el área que realmente cobra el proveedor.

Éxito cuando:
- Con el arte de Bananas (PDF, 1 unidad 29" × 9.75") la app mide la funda a escala sin teclear medidas y calcula el rectángulo de plancha replicado (≈ 21.2" × 19.5" en manga 504, 2 repeticiones, 1 banda).
- Con el arte de Snowhite (imagen, plancha completa 38" × 15.5") la app calcula 32" × 15.5" = 496 pulg² por color.
- Sin usar el medidor, todo cálculo da **exactamente** lo mismo que la app actual.
- Todo funciona sin IA; la IA solo sugiere.

## 3. Reglas de negocio (acordadas)

| Regla | Valor |
|---|---|
| Criterio de cobro | Rectángulo que encierra toda la impresión de la plancha, por color |
| Rectángulo por color | Uno **general** para todas las tintas; ajustes opcionales por color |
| Margen | 1" por lado, editable; se recorta lado por lado al borde de la plancha |
| Formatos de arte | JPG, PNG, WEBP y PDF |
| IA | Opcional, botón "Sugerir con IA"; nunca deja valores definitivos |

## 4. Conceptos y ejes

- **Página:** lo que trae el archivo. Solo aporta escala (en PDF).
- **Unidad:** una funda/etiqueta. Es el **marco** que dibuja el usuario en el modo por defecto.
- **Plancha:** la cuadrícula de unidades: `bandas` a lo largo × `repeticiones` alrededor del cilindro.
- **Eje X — a lo largo de la plancha** (bandas; máx. 50"). Corresponde al campo "Largo".
- **Eje Y — alrededor del cilindro** (repeticiones; desarrollo de la manga). Corresponde al campo "Ancho".
- Selector de orientación: qué lado del arte es X. Por defecto, horizontal = X (como en ambos artes de ejemplo).

Modo del arte (selector): **◉ Una unidad** (por defecto) / **○ Plancha completa**.

## 5. Experiencia de usuario

Sección nueva **"Medir impresión en el arte"** que reemplaza la sección actual "Análisis con IA" (una sola subida para todo).

1. **Subir arte.** Imagen o PDF. En PDF con varias páginas aparece selector de página (por defecto la 1).
2. **Marco.** El usuario dibuja un rectángulo sobre la unidad (o la plancha, según el modo).
   - PDF: las pulgadas se calculan con la escala del PDF y se redondean al 1/8" más cercano (28.98 → 29.0). Editables.
   - Imagen: el usuario escribe ancho y alto en pulgadas.
   - Al confirmar, se llenan los campos del formulario:
     - Modo unidad: Largo = X del marco, Ancho = Y del marco, Bandas = `floor(50 / Largo)`, Tipo = funda.
     - Modo plancha completa: aparecen dos campos, "Bandas en el arte" y "Repeticiones en el arte"; Largo = X ÷ bandas, Ancho = Y ÷ repeticiones.
3. **Impresión.** El usuario dibuja el rectángulo general de impresión dentro del marco. Botón **"+ Ajuste por color"**: elige una tinta (de la lista detectada por IA o escrita) y dibuja su rectángulo.
4. Panel lateral en vivo: medidas de cada rectángulo (sin y con margen), área por color y ahorro frente a la plancha completa.

Rectángulos: se crean arrastrando, se mueven arrastrando el interior, se redimensionan por las 4 esquinas, se borran con un botón. Las sugerencias de IA se muestran punteadas con botones Aceptar / Descartar.

## 6. Cálculo

### 6.1 Medición (unidades de entrada)
Rectángulos guardados en coordenadas de la imagen renderizada. Conversión a pulgadas relativa a la esquina del marco:

```
escalaX = marco.anchoIn / marco.anchoPx
escalaY = marco.altoIn  / marco.altoPx
x0 = (rect.izqPx - marco.izqPx) * escalaX      (recortado a [0, marco.anchoIn])
...análogo para x1, y0, y1
```

### 6.2 Rectángulo de plancha — modo unidad
Para una fila de la tabla con desarrollo `d` (exactDev), repeticiones `r`, bandas `b`, y largo de unidad `L` (= Largo del formulario):

```
Px = b * L                      Py = r * d
X0 = x0                         X1 = (b - 1) * L + x1
Y0 = y0                         Y1 = (r - 1) * d + y1
X0' = max(0,  X0 - m)           X1' = min(Px, X1 + m)
Y0' = max(0,  Y0 - m)           Y1' = min(Py, Y1 + m)
área = (X1' - X0') * (Y1' - Y0')
```
`m` = margen (1"). Cada fila de la tabla usa su propio `d` y `r`, por lo que el resultado es exacto para cada manga.

### 6.3 Rectángulo de plancha — modo plancha completa
El marco ya es la plancha. `área = (X1' - X0') * (Y1' - Y0')` con el rectángulo medido directamente, más margen, recortado al marco.
Para la tabla: `proporción = área / (marco.anchoIn * marco.altoIn)`, aplicada al área completa de cada fila (fórmula actual). Filas con bandas y repeticiones iguales a las declaradas del arte son exactas; las demás muestran la etiqueta **"estimado"**.

### 6.4 Costo
```
para cada color c en 1..colores:
    rect_c = ajuste[c] si existe, si no el general
    área_c = área según 6.2 o 6.3
costo = Σ área_c × 0.30 × 1.18
```
Sin medición: `área_c = ancho × reps × largo × bandas` (fórmula actual, sin cambios).

### 6.5 Ejemplos de referencia (para pruebas)
| Caso | Entrada | Esperado |
|---|---|---|
| Snowhite, plancha completa | marco 38 × 15.5; impresión X 4.0→34.0, Y 0.25→15.25; m=1; 4 colores | 32 × 15.5 = 496 pulg²/color; costo 702.34 (vs. 834.02 completo) |
| Snowhite + ajuste | igual, más 1 color con 26 × 13 interior (28 × 15 con margen) | 3 × 496 + 420 → costo 675.43 |
| Bananas, unidad | marco 29 × 9.75; impresión X 4.8→24.0, Y 0.3→9.4; d=9.75, r=2, b=1; m=1 | X 3.8→25.0 = 21.2; Y 0→19.5; 413.4 pulg²/color |
| Recorte por lado | impresión a 0.25" del borde | ese lado crece solo 0.25" |
| Sin medición | cualquier entrada válida | costo idéntico a la versión actual |

## 7. Componentes

| Archivo | Responsabilidad | Depende de |
|---|---|---|
| `src/lib/medicion.ts` | Puro. Px→pulgadas, réplica en cuadrícula, margen y recorte, área por color. | — |
| `src/lib/costo.ts` | Puro. `MANGA_DATABASE`, búsqueda de mangas (lógica actual de `calculate`), costo por fila con o sin medición. | `medicion.ts` |
| `src/services/cargarArte.ts` | Carga imagen o PDF (pdf.js): devuelve dataURL renderizado, tamaño en px, número de páginas y, si es PDF, pulgadas por píxel. | `pdfjs-dist` |
| `src/services/geminiVision.ts` | Se amplía: devuelve marco (`box_2d` + medidas leídas de cotas), rectángulo de impresión (`box_2d`), colores y nombres de tintas. | `@google/genai` |
| `src/components/MedidorArte.tsx` | Visor + capa SVG: modos (marco / impresión / ajuste color), dibujar, mover, redimensionar, borrar, sugerencias IA. Emite `MedicionArte`. | `cargarArte`, `geminiVision`, `medicion` |
| `src/App.tsx` | Formulario y resultados. Recibe `MedicionArte` y llama a `costo.ts`. Se elimina el campo "largo neto" y la sección de IA anterior. | todo lo anterior |

Tipo de salida del medidor:
```ts
interface RectIn { x0: number; x1: number; y0: number; y1: number }   // pulgadas, relativo al marco
interface MedicionArte {
  modo: 'unidad' | 'plancha';
  marco: { anchoIn: number; altoIn: number };   // X, Y
  general: RectIn | null;
  ajustes: { tinta: string; rect: RectIn }[];
  margenIn: number;                               // por defecto 1
  bandasArte?: number; repsArte?: number;         // solo modo plancha
}
```

## 8. PDF

- `pdfjs-dist` en el navegador; el archivo no sale de la máquina.
- Render de la página elegida con el lado mayor ≈ 2400 px.
- Escala: tamaño de página en puntos ÷ 72 = pulgadas. Verificado con BBGST416_v3.pdf: página 32.71" × 14.06", funda medida 28.98" × 9.75" (cotas: 29.0" × 9.75") → el PDF de Illustrator viene 1:1.
- Si el usuario escribe otra medida para el marco, esa manda (cubre PDFs no 1:1).
- Límite: 50 MB para PDF; imágenes siguen en 4 MB.
- PDF con contraseña o dañado → mensaje claro, sin romper la app.

## 9. IA (opcional)

- Botón "Sugerir con IA" en el medidor; ya no se ejecuta al subir.
- Se envía la página renderizada como JPEG (≤ 4 MB), nunca el PDF.
- Respuesta JSON: `marco { box_2d, ancho_in, alto_in }`, `impresion { box_2d }`, `colores`, `tintas: string[]`, `tipo_producto`, `observaciones`, `confidence`. `box_2d` = `[ymin, xmin, ymax, xmax]` normalizado 0–1000 (formato nativo de Gemini).
- Las sugerencias aparecen punteadas; el usuario acepta, ajusta o descarta.
- Cualquier error de modelo (cupo, modelo inexistente/retirado) pasa al siguiente modelo. Se quita `gemini-1.5-flash-002`.
- Si todos fallan: aviso y el flujo manual sigue intacto.

## 10. Arreglos incluidos (porque se toca ese código)

- Etiquetas: "Ancho" = alrededor del cilindro, "Largo" = a lo largo de la plancha, en ambos modos.
- Ícono de confianza: condición `(low || none) && !== 'none'` corregida.
- Variables sin uso (`label`, `showAreaBreakdown`) eliminadas.

## 11. Pruebas

- Agregar **Vitest** (dev) y script `npm test`.
- Unitarias en `medicion.ts` y `costo.ts` con los casos de 6.5, más: ajuste por color, réplica con varias bandas, cada fila de la tabla con su propio `d`, y regresión "sin medición = costo actual".
- Manual: cargar el PNG de Snowhite y BBGST416_v3.pdf; verificar marco 29.0 × 9.75 desde PDF, arrastre y redimensión, y flujo completo con la IA desactivada (sin clave).

## 12. Fuera de alcance

- Guardar cotizaciones en Firebase.
- Mover la clave de Gemini a un servidor (riesgo conocido: hoy queda expuesta en el navegador).
- Detección automática del área por color (separaciones del PDF).
- Formas no rectangulares, montajes escalonados o rotados.
- Exportar la cotización a PDF.

## 13. Supuestos

- La impresión dentro de la unidad es la misma en todas las repeticiones y bandas (se replica).
- El rectángulo con margen nunca excede la plancha (recorte por lado).
- El costo base (0.30 por pulg²) y el impuesto (18%) no cambian.
