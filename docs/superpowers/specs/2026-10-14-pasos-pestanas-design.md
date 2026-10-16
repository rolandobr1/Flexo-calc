# Flujo por pestañas — Diseño (anexo)

**Proyecto:** FlexoCalc Pro · **Fecha:** 2026-10-14
**Complementa:** `2026-10-14-medidor-impresion-design.md` (la matemática de medición y costo no cambia)
**Estado:** aprobado en conversación ("haz lo que recomiendas")

## 1. Problema
Con el medidor, el formulario y los resultados en una sola pantalla larga, el flujo confunde. Además debe quedar explícito que **el ancho de la funda define la manga**; la zona impresa solo cambia el costo.

## 2. Reglas
- La manga se elige siempre por el **ancho de funda** (medida alrededor del cilindro; en rollos, la **distancia entre marquillas**). La impresión nunca cambia la manga.
- Nombres de campos (decisión del usuario, 2026-10-14): Fundas → "Ancho de funda" (define la manga) y "Largo de funda"; Rollos/Láminas → "Distancia entre marquillas" (define la manga) y "Ancho del rollo" (a lo largo de la plancha).
- **El tamaño solo se define en ①** (decisión del usuario, 2026-10-14): ② se habilita con ① completo; el marco toma su tamaño de ① (`marcoDesdeFunda`: unidad = largo × ancho; plancha = largo × bandas del arte, ancho × repeticiones del arte) y no se edita en ②; en PDF a escala solo se avisa si el dibujo difiere > 1/8"; si ① cambia, el marco confirmado se ajusta solo; la IA no modifica ① (solo informa y nombra tintas).
- Una pestaña de tinta por cada color del paso ①, creada automáticamente. Cada tinta usa la zona general salvo que se active "Zona propia" y se dibuje.
- Los resultados se calculan automáticamente al abrir ④ (no hay botón Calcular ni resultados viejos).
- **Área cobrada alrededor del cilindro = desarrollo de la manga × repeticiones** (decisión del usuario, 2026-10-14). Aplica con y sin medición. Sin medición: `área = desarrollo × reps × largo × bandas`. Reemplaza la regla anterior "sin medición idéntico a la app vieja" (que usaba alto × reps); el precio solo cambia en filas donde el desarrollo difiere del alto. Invariante probado: medir nunca cuesta más que no medir.
- **Fundas abiertas (frente + dorso)** (decisión del usuario, 2026-10-14): en ① "El largo escrito es: tamaño de la bolsa | lámina completa" (por defecto bolsa). Con bolsa, la lámina en plancha = 2 × largo; bandas = `floor(50 / lámina)`; sin medición el área usa la lámina. El refile no cuenta. "¿El dorso lleva impresión?" (por defecto Sí). En ②, "Muestra frente y dorso | Muestra solo el frente": con solo el frente el marco es la bolsa y, si el dorso va impreso, las zonas se extienden al dorso (`conDorso`, +largo de la bolsa). Cambiar esta opción o el modo borra el marco (hay que redibujarlo); la zona impresa se conserva.
- Espacio entre repeticiones: se cobra el rectángulo que encierra todas las repeticiones, incluido el espacio entre ellas (confirmado por el usuario con el arte de arroz, 2026-10-14).
- Repeticiones: por el ancho de funda entre las mangas disponibles. Bandas: por el largo (`floor(50 / largo)`).

## 3. Flujo
Barra superior: **① Funda · ② Arte · ③ Impresión · ④ Resultados**, con ✓ por paso completo, Atrás/Siguiente.

| Paso | Contenido | ✓ cuando | Disponible |
|---|---|---|---|
| ① Funda | Tipo; **Ancho de funda (define la manga)** con aviso en vivo "Manga más cercana: 504 mm · 2 rep (9.750")"; Largo (a lo largo de la plancha); Bandas (sugeridas `floor(50/largo)`); Colores 1–8. Botones "Siguiente: Arte" y "Ver resultados sin arte". | `validarEntrada` sin error | siempre |
| ② Arte | Subir PDF/imagen; modo unidad/plancha; orientación; "Sugerir con IA" (solo informativa); dibujar marco; tamaño mostrado desde ① (bloqueado); "Confirmar marco". | marco confirmado | con ① completo |
| ③ Impresión | Margen; sub-pestañas **General · Tinta 1…N** (nombre editable; interruptor "Usa zona general / Zona propia"; etiqueta *general*/*propia*); panel de medidas. | hay zona general | con marco confirmado |
| ④ Resultados | Resumen ("Funda 9.75" × 29" · 4 colores · zona medida, margen 1""), tarjeta de mejor opción y tabla actuales. | — | siempre |

"Limpiar" (en ①) borra formulario, arte y medición.

## 4. Componentes
| Archivo | Responsabilidad |
|---|---|
| `components/BarraPasos.tsx` | Barra de pasos, ✓, navegación |
| `components/PasoFunda.tsx` | Formulario de la funda + aviso de manga |
| `components/VisorArte.tsx` | Imagen + capa SVG (dibujar, mover, redimensionar); reutilizado en ② y ③ |
| `components/PasoArte.tsx` | Carga, modo, orientación, IA, marco y confirmación |
| `components/PasoImpresion.tsx` | Margen, sub-pestañas de tintas, panel de medidas |
| `components/PasoResultados.tsx` | Resumen, tarjeta y tabla |
| `components/medidorEstado.ts` | Reducer: `ajustesPx` → `tintas` sincronizadas con los colores |
| `lib/costo.ts` | + `mangaMasCercana(alto, tipo)` |
| `App.tsx` | Estado compartido (formulario, arte, reducer, paso activo) |
| `components/MedidorArte.tsx` | Se elimina |

Reducer: `tintas: { nombre, propia, rect }[]`, `tintaActiva: number | null` (null = General). Acciones nuevas `SINCRONIZAR_TINTAS(n)` (conserva nombres/zonas al crecer, recorta al bajar), `NOMBRE_TINTA(i, nombre)`, `NOMBRES_TINTAS(string[])` (de la IA), `ZONA_PROPIA(i, propia)` (false borra el rectángulo), `TINTA_ACTIVA(i | null)`. `aMedicion` usa solo tintas con `propia && rect`.

## 5. Pruebas
- Unitarias: sincronizar tintas (4→5 conserva nombres, 4→2 recorta), zona propia, nombres de IA, dibujar en tinta activa; `mangaMasCercana(9.75,'funda')` = 504/2, `(7.75,'funda')` = 404/2, y coincide con la primera fila de la tabla.
- Las pruebas de `medicion` y `costo` no cambian.
- Navegador: recorrido por pestañas con Snowhite y Bananas; mismos importes que antes ($834.02 sin arte, ≈$585.69, ≈$702.29, ≈$675.36).
