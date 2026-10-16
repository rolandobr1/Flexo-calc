import { describe, expect, test } from 'vitest';
import { aMedicion, difiereMedida, unidadDeArte, estadoInicial, marcoDesdeFunda, medidaMarcoPdf, medidorReducer, tintasVisibles, type AccionMedidor, type EstadoMedidor } from './medidorEstado';

const r = (izq: number, arr: number, der: number, aba: number) => ({ izq, arr, der, aba });
const correr = (acciones: AccionMedidor[], s: EstadoMedidor = estadoInicial) => acciones.reduce(medidorReducer, s);

/** Marco Bananas: 2900 x 975 px = 29 x 9.75 in (0.01 in/px). */
const conMarco = () =>
  correr([
    { t: 'DIBUJAR', rect: r(0, 0, 2900, 975) },
    { t: 'CONFIRMAR_MARCO', dim: { anchoIn: 29, altoIn: 9.75 } },
  ]);

describe('medidorReducer', () => {
  test('DIBUJAR en paso marco asigna marco normalizado; < 4 px se ignora', () => {
    const s = medidorReducer(estadoInicial, { t: 'DIBUJAR', rect: r(500, 300, 100, 100) });
    expect(s.marcoPx).toEqual(r(100, 100, 500, 300));
    expect(medidorReducer(s, { t: 'DIBUJAR', rect: r(10, 10, 12, 12) })).toBe(s);
  });

  test('CONFIRMAR_MARCO pasa a impresión y DIBUJAR asigna el general', () => {
    const s = medidorReducer(conMarco(), { t: 'DIBUJAR', rect: r(480, 30, 2400, 940) });
    expect(s.paso).toBe('impresion');
    const m = aMedicion(s)!;
    expect(m).toMatchObject({ modo: 'unidad', marco: { anchoIn: 29, altoIn: 9.75 }, margenIn: 1, ajustes: [] });
    expect(m.general.x0).toBeCloseTo(4.8, 9);
    expect(m.general.x1).toBeCloseTo(24, 9);
    expect(m.general.y0).toBeCloseTo(0.3, 9);
    expect(m.general.y1).toBeCloseTo(9.4, 9);
  });

  test('sin general no hay medición', () => {
    expect(aMedicion(conMarco())).toBeNull();
    expect(aMedicion(estadoInicial)).toBeNull();
  });

  test('NUEVO_ARTE borra la medición pero conserva modo, margen y orientación', () => {
    const s = correr(
      [
        { t: 'MODO', modo: 'plancha' },
        { t: 'MARGEN', margenIn: 0.5 },
        { t: 'ORIENTACION', horizontalEsX: false },
        { t: 'DIBUJAR', rect: r(0, 0, 2900, 975) },
        { t: 'CONFIRMAR_MARCO', dim: { anchoIn: 9.75, altoIn: 29 } },
        { t: 'DIBUJAR', rect: r(480, 30, 2400, 940) },
        { t: 'NUEVO_ARTE' },
      ],
    );
    expect(aMedicion(s)).toBeNull();
    expect(s.marcoPx).toBeNull();
    expect(s.generalPx).toBeNull();
    expect(s.paso).toBe('marco');
    expect(s).toMatchObject({ modo: 'plancha', margenIn: 0.5, horizontalEsX: false });
  });

  test('cambiar orientación obliga a reconfirmar el marco', () => {
    const s = medidorReducer(conMarco(), { t: 'ORIENTACION', horizontalEsX: false });
    expect(s.marcoConfirmado).toBe(false);
    expect(s.paso).toBe('marco');
  });

  test('EDITAR_MARCO vuelve al paso marco conservando la impresión', () => {
    const s = correr([{ t: 'DIBUJAR', rect: r(480, 30, 2400, 940) }, { t: 'EDITAR_MARCO' }], conMarco());
    expect(s.paso).toBe('marco');
    expect(s.marcoConfirmado).toBe(false);
    expect(s.generalPx).toEqual(r(480, 30, 2400, 940));
  });

  test('arte de plancha completa: la medición se toma de una unidad (modo unidad)', () => {
    const s = correr(
      [
        { t: 'MODO', modo: 'plancha' },
        { t: 'ARTE_GRID', bandasArte: 2, repsArte: 2 },
        { t: 'DIBUJAR', rect: r(0, 0, 3800, 1550) },
        { t: 'CONFIRMAR_MARCO', dim: { anchoIn: 38, altoIn: 15.5 } },
        { t: 'DIBUJAR', rect: r(400, 25, 1500, 750) },
      ],
    );
    const m = aMedicion(s)!;
    expect(m).toMatchObject({ modo: 'unidad', marco: { anchoIn: 19, altoIn: 7.75 } });
    expect(m.general.x0).toBeCloseTo(4, 9);
    expect(m.general.x1).toBeCloseTo(15, 9);
    expect(m.general.y0).toBeCloseTo(0.25, 9);
    expect(m.general.y1).toBeCloseTo(7.5, 9);
  });

  test('impresión dibujada fuera del marco se recorta al marco', () => {
    const s = medidorReducer(conMarco(), { t: 'DIBUJAR', rect: r(-200, -50, 3500, 600) });
    expect(s.generalPx).toEqual(r(0, 0, 2900, 600));
  });

  test('MOVER mantiene el rectángulo dentro del marco y conserva su tamaño', () => {
    const s = correr([{ t: 'DIBUJAR', rect: r(100, 100, 600, 400) }, { t: 'MOVER', obj: 'general', dx: 5000, dy: -5000 }], conMarco());
    expect(s.generalPx).toEqual(r(2400, 0, 2900, 300));
  });

  test('REDIMENSIONAR más allá del borde opuesto queda normalizado y recortado', () => {
    const s = correr(
      [{ t: 'DIBUJAR', rect: r(100, 100, 600, 400) }, { t: 'REDIMENSIONAR', obj: 'general', esquina: 'ai', x: 800, y: 3000 }],
      conMarco(),
    );
    expect(s.generalPx).toEqual(r(600, 400, 800, 975));
  });

});

describe('correcciones de la revisión final', () => {
  test('arrastre completamente fuera del marco no reemplaza la impresión', () => {
    const base = medidorReducer(conMarco(), { t: 'DIBUJAR', rect: r(480, 30, 2400, 940) });
    expect(medidorReducer(base, { t: 'DIBUJAR', rect: r(3000, 100, 3500, 500) })).toBe(base);
  });

  test('redimensionar a tamaño cero se ignora (impresión y marco)', () => {
    const base = medidorReducer(conMarco(), { t: 'DIBUJAR', rect: r(100, 100, 600, 400) });
    expect(medidorReducer(base, { t: 'REDIMENSIONAR', obj: 'general', esquina: 'ad', x: 100, y: 100 })).toBe(base);
    expect(medidorReducer(base, { t: 'REDIMENSIONAR', obj: 'marco', esquina: 'ad', x: 0, y: 0 })).toBe(base);
  });

  test('cambiar de modo obliga a reconfirmar el marco', () => {
    const s = medidorReducer(medidorReducer(conMarco(), { t: 'DIBUJAR', rect: r(480, 30, 2400, 940) }), {
      t: 'MODO',
      modo: 'plancha',
    });
    expect(s.marcoConfirmado).toBe(false);
    expect(s.paso).toBe('marco');
    expect(aMedicion(s)).toBeNull();
  });
});

describe('tintas sincronizadas con los colores', () => {
  const conGeneral = () => medidorReducer(conMarco(), { t: 'DIBUJAR', rect: r(480, 30, 2400, 940) });

  test('SINCRONIZAR_TINTAS 0→4 crea Tinta 1..4 con "Zona propia" elegida pero sin dibujar', () => {
    const s = medidorReducer(estadoInicial, { t: 'SINCRONIZAR_TINTAS', n: 4 });
    expect(tintasVisibles(s)).toEqual([1, 2, 3, 4].map((i) => ({ nombre: `Tinta ${i}`, propia: true, zona: null })));
  });

  test('Zona propia elegida pero sin dibujar no cambia la medición (cobra la general)', () => {
    const s = correr([{ t: 'SINCRONIZAR_TINTAS', n: 4 }], conGeneral());
    expect(aMedicion(s)?.zonasPlancha ?? []).toEqual([]);
  });

  test('si el usuario elige "Usa zona general", se respeta al cambiar de pestaña', () => {
    const s = correr([
      { t: 'SINCRONIZAR_TINTAS', n: 2 },
      { t: 'TINTA_ACTIVA', i: 1 },
      { t: 'ZONA_PROPIA', i: 1, propia: false },
      { t: 'TINTA_ACTIVA', i: null },
      { t: 'TINTA_ACTIVA', i: 1 },
    ]);
    expect(s.tintas[1].propia).toBe(false);
    expect(s.tintas[0].propia).toBe(true);
  });

  test('4→5 conserva nombres; 4→2 recorta y la tinta activa desaparecida vuelve a General', () => {
    let s = correr([
      { t: 'SINCRONIZAR_TINTAS', n: 4 },
      { t: 'NOMBRE_TINTA', i: 0, nombre: 'Cyan' },
      { t: 'TINTA_ACTIVA', i: 3 },
    ]);
    s = medidorReducer(s, { t: 'SINCRONIZAR_TINTAS', n: 5 });
    expect(tintasVisibles(s).map((t) => t.nombre)).toEqual(['Cyan', 'Tinta 2', 'Tinta 3', 'Tinta 4', 'Tinta 5']);
    expect(s.tintaActiva).toBe(3);
    s = medidorReducer(s, { t: 'SINCRONIZAR_TINTAS', n: 2 });
    expect(tintasVisibles(s).map((t) => t.nombre)).toEqual(['Cyan', 'Tinta 2']);
    expect(s.tintaActiva).toBeNull();
  });

  test('NOMBRES_TINTAS aplica nombres en orden sin cambiar la cantidad', () => {
    const s = correr([{ t: 'SINCRONIZAR_TINTAS', n: 3 }, { t: 'NOMBRES_TINTAS', nombres: ['Cyan', 'Magenta', 'Amarillo', 'Negro'] }]);
    expect(tintasVisibles(s).map((t) => t.nombre)).toEqual(['Cyan', 'Magenta', 'Amarillo']);
  });

  test('ZONA_TINTA guarda la zona sobre la plancha completa y aMedicion la incluye (no se repite)', () => {
    const s = correr(
      [
        { t: 'SINCRONIZAR_TINTAS', n: 4 },
        { t: 'NOMBRE_TINTA', i: 3, nombre: 'Negro' },
        { t: 'ZONA_TINTA', i: 3, rect: { x0: 20, x1: 34, y0: 8, y1: 15 } },
      ],
      conGeneral(),
    );
    expect(s.tintas[3]).toEqual({ nombre: 'Negro', propia: true, zona: { x0: 20, x1: 34, y0: 8, y1: 15 } });
    expect(s.generalPx).toEqual(r(480, 30, 2400, 940));
    const m = aMedicion(s)!;
    expect(m.ajustes).toEqual([]);
    expect(m.zonasPlancha).toEqual([{ tinta: 'Negro', rect: { x0: 20, x1: 34, y0: 8, y1: 15 }, indice: 3 }]);
  });

  test('DIBUJAR con una tinta activa ya no toca su zona (solo la general)', () => {
    const s = correr(
      [
        { t: 'SINCRONIZAR_TINTAS', n: 2 },
        { t: 'TINTA_ACTIVA', i: 1 },
        { t: 'DIBUJAR', rect: r(600, 100, 1000, 500) },
      ],
      conGeneral(),
    );
    expect(s.tintas[1].zona).toBeNull();
    expect(s.generalPx).toEqual(r(600, 100, 1000, 500));
  });

  test('zona propia sin zona general: cuenta igual y la general es la unidad completa', () => {
    const s = correr([{ t: 'SINCRONIZAR_TINTAS', n: 2 }, { t: 'ZONA_TINTA', i: 0, rect: { x0: 20, x1: 34, y0: 8, y1: 15 } }], conMarco());
    const m = aMedicion(s)!;
    expect(m.general).toEqual({ x0: 0, x1: 29, y0: 0, y1: 9.75 });
    expect(m.zonasPlancha).toHaveLength(1);
  });

  test('zona propia sin dibujar no cuenta; ZONA_PROPIA false borra el rectángulo', () => {
    let s = correr([{ t: 'SINCRONIZAR_TINTAS', n: 2 }, { t: 'ZONA_PROPIA', i: 1, propia: true }], conGeneral());
    expect(aMedicion(s)!.zonasPlancha).toEqual([]);
    s = correr([{ t: 'ZONA_TINTA', i: 1, rect: { x0: 20, x1: 34, y0: 8, y1: 15 } }, { t: 'ZONA_PROPIA', i: 1, propia: false }], s);
    expect(s.tintas[1]).toEqual({ nombre: 'Tinta 2', propia: false, zona: null });
    expect(aMedicion(s)!.zonasPlancha).toEqual([]);
  });

  test('NUEVO_ARTE conserva las tintas (nombres) pero borra sus zonas', () => {
    const s = correr(
      [
        { t: 'SINCRONIZAR_TINTAS', n: 2 },
        { t: 'NOMBRE_TINTA', i: 0, nombre: 'Negro' },
        { t: 'ZONA_TINTA', i: 0, rect: { x0: 20, x1: 34, y0: 8, y1: 15 } },
        { t: 'NUEVO_ARTE' },
      ],
      conGeneral(),
    );
    expect(tintasVisibles(s)).toEqual([
      { nombre: 'Negro', propia: true, zona: null },
      { nombre: 'Tinta 2', propia: true, zona: null },
    ]);
    expect(s.tintaActiva).toBeNull();
  });
});

describe('correcciones de la revisión final (pestañas)', () => {
  const r2 = r;
  test('I1: nombres de tintas con colores vacíos aparecen al sincronizar', () => {
    const s = correr([
      { t: 'NOMBRES_TINTAS', nombres: ['Cyan', 'Magenta', 'Amarillo', 'Negro'] },
      { t: 'SINCRONIZAR_TINTAS', n: 4 },
    ]);
    expect(tintasVisibles(s).map((t) => t.nombre)).toEqual(['Cyan', 'Magenta', 'Amarillo', 'Negro']);
  });

  test('I2: pasar por 0 colores y volver conserva nombres y zonas; las ocultas no cuentan', () => {
    const base = correr(
      [
        { t: 'DIBUJAR', rect: r2(480, 30, 2400, 940) },
        { t: 'SINCRONIZAR_TINTAS', n: 4 },
        { t: 'NOMBRE_TINTA', i: 3, nombre: 'Negro' },
        { t: 'ZONA_TINTA', i: 3, rect: { x0: 20, x1: 34, y0: 8, y1: 15 } },
      ],
      conMarco(),
    );
    const cero = medidorReducer(base, { t: 'SINCRONIZAR_TINTAS', n: 0 });
    expect(tintasVisibles(cero)).toEqual([]);
    const dos = medidorReducer(base, { t: 'SINCRONIZAR_TINTAS', n: 2 });
    expect(aMedicion(dos)!.zonasPlancha).toEqual([]);
    const vuelta = medidorReducer(cero, { t: 'SINCRONIZAR_TINTAS', n: 4 });
    expect(tintasVisibles(vuelta)[3]).toEqual({ nombre: 'Negro', propia: true, zona: { x0: 20, x1: 34, y0: 8, y1: 15 } });
    expect(aMedicion(vuelta)!.zonasPlancha!.map((a) => a.tinta)).toEqual(['Negro']);
  });

  test('REINICIAR vuelve al estado inicial (Limpiar)', () => {
    const s = correr([{ t: 'SINCRONIZAR_TINTAS', n: 3 }, { t: 'MARGEN', margenIn: 0.5 }, { t: 'REINICIAR' }], conMarco());
    expect(s).toEqual(estadoInicial);
  });

  test('I3: medidas del marco en el estado — PDF las propone al dibujar', () => {
    const ppx = 0.01;
    const s = correr([{ t: 'ESCALA_PDF', pulgadasPorPx: ppx }, { t: 'DIBUJAR', rect: r2(0, 0, 2898, 975) }]);
    expect(s.marcoTxt).toEqual({ ancho: '29', alto: '9.75' });
  });

  test('I3: una corrección manual no se pisa salvo que se vuelva a dibujar el marco', () => {
    let s = correr([
      { t: 'ESCALA_PDF', pulgadasPorPx: 0.01 },
      { t: 'DIBUJAR', rect: r2(0, 0, 2898, 990) },
      { t: 'MARCO_TXT', ancho: '29', alto: '9.75' },
      { t: 'MARGEN', margenIn: 1 },
    ]);
    expect(s.marcoTxt).toEqual({ ancho: '29', alto: '9.75' });
    s = medidorReducer(s, { t: 'REDIMENSIONAR', obj: 'marco', esquina: 'bd', x: 2000, y: 975 });
    expect(s.marcoTxt).toEqual({ ancho: '20', alto: '9.75' });
  });

  test('I3: sin escala (imagen) el texto escrito se conserva al redibujar', () => {
    const s = correr([
      { t: 'DIBUJAR', rect: r2(0, 0, 500, 200) },
      { t: 'MARCO_TXT', ancho: '38', alto: '15.5' },
      { t: 'DIBUJAR', rect: r2(0, 0, 510, 205) },
    ]);
    expect(s.marcoTxt).toEqual({ ancho: '38', alto: '15.5' });
  });
});

test('medidaMarcoPdf: 28.98 x 9.75 pulgadas → 29 x 9.75', () => {
  const ppx = 32.708 / 2400;
  expect(medidaMarcoPdf(r(0, 0, Math.round(28.98 / ppx), Math.round(9.75 / ppx)), ppx, true)).toEqual({
    anchoIn: 29,
    altoIn: 9.75,
  });
  expect(medidaMarcoPdf(r(0, 0, Math.round(9.75 / ppx), Math.round(28.98 / ppx)), ppx, false)).toEqual({
    anchoIn: 29,
    altoIn: 9.75,
  });
});

describe('el tamaño de la funda solo se define en ①', () => {
  test('modo funda/unidad: el marco es largo × ancho de ①', () => {
    expect(marcoDesdeFunda('unidad', 29, 9.75, 1, 1)).toEqual({ anchoIn: 29, altoIn: 9.75 });
  });

  test('modo plancha completa: largo × bandas del arte, ancho × repeticiones del arte', () => {
    expect(marcoDesdeFunda('plancha', 19, 7.75, 2, 2)).toEqual({ anchoIn: 38, altoIn: 15.5 });
  });

  test('datos inválidos → null', () => {
    expect(marcoDesdeFunda('unidad', NaN, 9.75, 1, 1)).toBeNull();
    expect(marcoDesdeFunda('unidad', 29, 0, 1, 1)).toBeNull();
    expect(marcoDesdeFunda('plancha', 19, 7.75, 0, 2)).toBeNull();
  });

  test('aviso de diferencia: tolerancia de 1/8"', () => {
    expect(difiereMedida({ anchoIn: 29, altoIn: 9.75 }, { anchoIn: 29, altoIn: 9.875 })).toBe(false);
    expect(difiereMedida({ anchoIn: 29, altoIn: 9.75 }, { anchoIn: 29, altoIn: 10 })).toBe(true);
    expect(difiereMedida({ anchoIn: 29, altoIn: 9.75 }, { anchoIn: 28.5, altoIn: 9.75 })).toBe(true);
  });
});

describe('el arte muestra solo el frente', () => {
  test('SOLO_FRENTE anula la confirmación del marco (cambia su tamaño)', () => {
    const s = medidorReducer(conMarco(), { t: 'SOLO_FRENTE', soloFrente: true });
    expect(s.soloFrente).toBe(true);
    expect(s.marcoConfirmado).toBe(false);
    expect(medidorReducer(s, { t: 'SOLO_FRENTE', soloFrente: true })).toBe(s);
  });

  test('marcoDesdeFunda usa el largo que corresponde al arte', () => {
    expect(marcoDesdeFunda('unidad', 20, 12.96, 1, 1)).toEqual({ anchoIn: 20, altoIn: 12.96 });
    expect(marcoDesdeFunda('unidad', 40, 12.96, 1, 1)).toEqual({ anchoIn: 40, altoIn: 12.96 });
  });
});

describe('cambiar lo que abarca el marco obliga a redibujarlo', () => {
  test('SOLO_FRENTE borra el marco anterior (era de la lámina) y conserva la impresión', () => {
    const base = medidorReducer(conMarco(), { t: 'DIBUJAR', rect: r(480, 30, 2400, 940) });
    const s = medidorReducer(base, { t: 'SOLO_FRENTE', soloFrente: true });
    expect(s.marcoPx).toBeNull();
    expect(s.marcoIn).toBeNull();
    expect(s.generalPx).toEqual(r(480, 30, 2400, 940));
    expect(medidorReducer(s, { t: 'DIBUJAR', rect: r(0, 0, 1450, 975) }).marcoPx).toEqual(r(0, 0, 1450, 975));
  });

  test('MODO también borra el marco anterior', () => {
    const s = medidorReducer(conMarco(), { t: 'MODO', modo: 'plancha' });
    expect(s.marcoPx).toBeNull();
  });
});

describe('unidad de arte', () => {
  const plancha = () =>
    correr([
      { t: 'MODO', modo: 'plancha' },
      { t: 'ARTE_GRID', bandasArte: 2, repsArte: 2 },
      { t: 'DIBUJAR', rect: r(0, 0, 3800, 1550) },
      { t: 'CONFIRMAR_MARCO', dim: { anchoIn: 38, altoIn: 15.5 } },
    ]);

  test('plancha 2×2 horizontal → primera unidad 19 × 7.75 arriba a la izquierda', () => {
    expect(unidadDeArte(plancha())).toEqual({ px: r(0, 0, 1900, 775), dim: { anchoIn: 19, altoIn: 7.75 } });
  });

  test('plancha con orientación vertical: bandas por el eje vertical de la imagen', () => {
    const s = correr(
      [
        { t: 'MODO', modo: 'plancha' },
        { t: 'ORIENTACION', horizontalEsX: false },
        { t: 'ARTE_GRID', bandasArte: 2, repsArte: 2 },
        { t: 'DIBUJAR', rect: r(0, 0, 1550, 3800) },
        { t: 'CONFIRMAR_MARCO', dim: { anchoIn: 38, altoIn: 15.5 } },
      ],
    );
    expect(unidadDeArte(s)).toEqual({ px: r(0, 0, 775, 1900), dim: { anchoIn: 19, altoIn: 7.75 } });
  });

  test('modo unidad → el marco tal cual; sin marco confirmado → null', () => {
    expect(unidadDeArte(conMarco())).toEqual({ px: r(0, 0, 2900, 975), dim: { anchoIn: 29, altoIn: 9.75 } });
    expect(unidadDeArte(estadoInicial)).toBeNull();
  });
});

describe('revisión montaje', () => {
  const plancha2x2 = () =>
    correr([
      { t: 'MODO', modo: 'plancha' },
      { t: 'ARTE_GRID', bandasArte: 2, repsArte: 2 },
    ]);

  test('I1: cambiar de modo borra las zonas dibujadas (la unidad cambia)', () => {
    const s = correr(
      [
        { t: 'DIBUJAR', rect: r(480, 30, 2400, 940) },
        { t: 'SINCRONIZAR_TINTAS', n: 1 },
        { t: 'ZONA_TINTA', i: 0, rect: { x0: 20, x1: 34, y0: 8, y1: 15 } },
        { t: 'MODO', modo: 'plancha' },
      ],
      conMarco(),
    );
    expect(s.generalPx).toBeNull();
    expect(tintasVisibles(s)[0]).toEqual({ nombre: 'Tinta 1', propia: true, zona: null });
  });
});

describe('medida manual por tinta', () => {
  const base = () =>
    correr([
      { t: 'DIBUJAR', rect: r(0, 0, 2900, 975) },
      { t: 'CONFIRMAR_MARCO', dim: { anchoIn: 29, altoIn: 9.75 } },
      { t: 'DIBUJAR', rect: r(480, 30, 2400, 940) },
      { t: 'SINCRONIZAR_TINTAS', n: 3 },
    ]);

  test('MEDIDA_MANUAL la guarda y aMedicion la manda como manual con su índice', () => {
    const s = medidorReducer(base(), { t: 'MEDIDA_MANUAL', i: 2, manual: { ancho: 10, alto: 5 } });
    expect(s.tintas[2].manual).toEqual({ ancho: 10, alto: 5 });
    expect(aMedicion(s)!.manuales).toEqual([{ tinta: 'Tinta 3', ancho: 10, alto: 5, indice: 2 }]);
  });

  test('una tinta con medida manual no cuenta además su zona dibujada', () => {
    const s = correr(
      [
        { t: 'ZONA_TINTA', i: 0, rect: { x0: 1, x1: 5, y0: 1, y1: 5 } },
        { t: 'MEDIDA_MANUAL', i: 0, manual: { ancho: 10, alto: 5 } },
      ],
      base(),
    );
    const m = aMedicion(s)!;
    expect(m.zonasPlancha ?? []).toEqual([]);
    expect(m.manuales).toHaveLength(1);
  });

  test('dibujar la zona de nuevo o volver a lo medido quita la medida manual', () => {
    let s = medidorReducer(base(), { t: 'MEDIDA_MANUAL', i: 0, manual: { ancho: 10, alto: 5 } });
    s = medidorReducer(s, { t: 'ZONA_TINTA', i: 0, rect: { x0: 1, x1: 5, y0: 1, y1: 5 } });
    expect(s.tintas[0].manual).toBeUndefined();
    s = medidorReducer(s, { t: 'MEDIDA_MANUAL', i: 1, manual: { ancho: 3, alto: 3 } });
    s = medidorReducer(s, { t: 'MEDIDA_MANUAL', i: 1, manual: null });
    expect(s.tintas[1].manual).toBeUndefined();
  });

  test('medidas inválidas (0, negativas, NaN) se ignoran', () => {
    const s = medidorReducer(base(), { t: 'MEDIDA_MANUAL', i: 0, manual: { ancho: 0, alto: 5 } });
    expect(s.tintas[0].manual).toBeUndefined();
    expect(medidorReducer(base(), { t: 'MEDIDA_MANUAL', i: 0, manual: { ancho: NaN, alto: 5 } }).tintas[0].manual).toBeUndefined();
  });

  test('con solo medidas manuales (sin zonas) ya hay medición', () => {
    const sinGeneral = correr([
      { t: 'DIBUJAR', rect: r(0, 0, 2900, 975) },
      { t: 'CONFIRMAR_MARCO', dim: { anchoIn: 29, altoIn: 9.75 } },
      { t: 'SINCRONIZAR_TINTAS', n: 2 },
      { t: 'MEDIDA_MANUAL', i: 0, manual: { ancho: 10, alto: 5 } },
    ]);
    expect(aMedicion(sinGeneral)).not.toBeNull();
  });
});

describe('frente / lámina completa al cambiar de arte', () => {
  test('un arte nuevo vuelve a "Muestra frente y dorso" (no hereda "solo el frente")', () => {
    const s = correr([{ t: 'SOLO_FRENTE', soloFrente: true }, { t: 'NUEVO_ARTE' }]);
    expect(s.soloFrente).toBe(false);
  });

  test('SOLO_FRENTE con conservarMarco cambia la opción sin borrar el marco dibujado', () => {
    const conM = correr([{ t: 'SOLO_FRENTE', soloFrente: true }, { t: 'DIBUJAR', rect: r(41, 71, 2241, 994) }]);
    const s = medidorReducer(conM, { t: 'SOLO_FRENTE', soloFrente: false, conservarMarco: true });
    expect(s.soloFrente).toBe(false);
    expect(s.marcoPx).toEqual(r(41, 71, 2241, 994));
    expect(s.marcoConfirmado).toBe(false);
  });
});
