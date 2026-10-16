# Paso ③ Montaje — Diseño

**Proyecto:** FlexoCalc Pro · **Fecha:** 2026-10-14 · **Estado:** aprobado en conversación ("dale")
**Complementa:** `2026-10-14-pasos-pestanas-design.md` (reemplaza el paso ③ Impresión)

## 1. Objetivo
Después de marcar el arte, ver la **plancha final simulada** (unidad repetida en bandas × repeticiones de la manga elegida) y marcar sobre ella las zonas de cada tinta, viendo el rectángulo que se cobra.

## 2. Reglas
- Pestañas: **① Funda · ② Arte · ③ Montaje · ④ Resultados**.
- Manga a simular: la recomendada (primera fila) o cualquiera de las 4 alternativas de la comparativa. Por defecto la recomendada.
- Plancha: a lo largo = bandas × lámina (`largoEnPlancha`); alrededor = repeticiones × desarrollo de la manga.
- Celda (b, r) en x = b × lámina, y = r × desarrollo; tamaño lámina × ancho de funda. Si desarrollo < ancho de funda hay **traslape** (aviso).
- Fundas abiertas con arte de **solo el frente**: cada celda tiene frente (imagen) y dorso (copia del frente si el dorso va impreso; gris "sin impresión" si no).
- **Arte de plancha completa**: la unidad es la sub-zona superior izquierda del marco (marco ÷ bandas y repeticiones del arte). Desde este paso todas las zonas se dibujan **en coordenadas de una unidad**, por lo que la medición se trata como "una unidad" y el costo es exacto para cualquier manga (ya no hay filas "estimado").
- La **zona general** se dibuja sobre cualquier celda y se repite en todas; las manijas para ajustar están en la primera celda.
- La **zona propia de una tinta** (corrección del usuario, 2026-10-14) es un rectángulo sobre la **composición completa** (pulgadas de plancha, `Tinta.zona`): se dibuja directamente sobre la plancha, **no se repite**, y se cobra con margen recortado a la plancha (`rectCobradoPlancha`). Al cambiar de manga se recorta a la nueva plancha.
- Una zona propia cuenta aunque no haya zona general; en ese caso el resto de las tintas cubre la unidad completa.
- Para la tinta seleccionada se dibuja su zona en cada celda y, en trazo grueso, el **rectángulo cobrado** (con margen, recortado a la plancha) = el mismo que usa el costo (`areaUnidad`).
- Panel: área cobrada por tinta y costo total de la manga elegida = fila de esa manga en ④.

## 3. Componentes
| Archivo | Responsabilidad |
|---|---|
| `lib/medicion.ts` | + `rectCobradoUnidad(rect, fila, margen): RectIn` (area = `areaUnidad`), + `rectInAPx` (inversa de `rectPxAIn`) |
| `lib/montaje.ts` | `montaje(entrada) → { plancha, celdas, traslape, cobrados }` (puro) |
| `components/medidorEstado.ts` | `unidadDeArte(estado)` (marco de una unidad en px y pulgadas); `aMedicion` en modo plancha devuelve modo unidad con esa unidad |
| `components/VisorMontaje.tsx` | SVG de la plancha en pulgadas: celdas con el arte recortado, zonas, rectángulo cobrado, dibujo y manijas (convierte a px del arte y despacha las acciones existentes) |
| `components/PasoMontaje.tsx` | Selector de manga, pestañas de tintas (nombre, zona propia), margen, panel |
| `components/PasoImpresion.tsx` | Se elimina |
| `App.tsx` | Calcula configuraciones (memo) y la manga elegida; paso 'montaje' |

## 4. Pruebas
- `rectCobradoUnidad` coincide con `areaUnidad` (Bananas, arroz con y sin dorso).
- `rectInAPx` ∘ `rectPxAIn` = identidad (horizontal y vertical).
- `montaje`: arroz 668/2 × 1 banda → 2 celdas, plancha 40 × 25.92; Snowhite 404/2 × 2 bandas → 4 celdas, 38 × 15.5; traslape cuando desarrollo < ancho; frente/dorso.
- Para cada fila de la tabla, Σ áreas cobradas del montaje × 0.30 × 1.18 = `costoTotal`.
- `unidadDeArte` en plancha 2×2 → marco de una unidad 19 × 7.75.
- Navegador: arroz y Snowhite por el paso Montaje; mismos precios que hoy para las mismas zonas.
