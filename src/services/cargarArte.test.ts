import { describe, expect, test } from 'vitest';
import { archivoDelPortapapeles, escalaPdf, validarArchivo } from './cargarArte';

test('validarArchivo', () => {
  expect(validarArchivo({ type: 'application/pdf', size: 40e6 })).toBeNull();
  expect(validarArchivo({ type: 'image/jpeg', size: 1e6 })).toBeNull();
  expect(validarArchivo({ type: 'application/pdf', size: 51 * 1024 * 1024 })).toBe('El PDF supera el límite de 50MB.');
  expect(validarArchivo({ type: 'image/png', size: 5 * 1024 * 1024 })).toBeNull(); // capturas grandes
  expect(validarArchivo({ type: 'image/png', size: 21 * 1024 * 1024 })).toBe('La imagen supera el límite de 20MB.');
  expect(validarArchivo({ type: 'image/gif', size: 10 })).toBe('Formato no soportado. Use JPG, PNG, WEBP o PDF.');
});

test('escalaPdf: BBGST416 página 2354.95 pt renderizada a 2400 px', () => {
  expect(escalaPdf(2354.95, 2400) * 2400).toBeCloseTo(32.708, 3);
});

describe('archivoDelPortapapeles', () => {
  const png = new File([new Uint8Array([1, 2, 3])], 'image.png', { type: 'image/png' });
  const items = (fs: File[]) =>
    fs.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })) as unknown as DataTransferItemList;

  test('imagen copiada (captura): se toma de items y se renombra', () => {
    const f = archivoDelPortapapeles({ files: [] as unknown as FileList, items: items([png]) });
    expect(f?.type).toBe('image/png');
    expect(f?.name).toBe('Imagen pegada.png');
  });

  test('archivo copiado en el Explorador conserva su nombre', () => {
    const pdf = new File([new Uint8Array([1])], 'arte.pdf', { type: 'application/pdf' });
    expect(archivoDelPortapapeles({ files: [pdf] as unknown as FileList, items: items([]) })?.name).toBe('arte.pdf');
  });

  test('solo texto → null', () => {
    const texto = [{ kind: 'string', type: 'text/plain', getAsFile: () => null }] as unknown as DataTransferItemList;
    expect(archivoDelPortapapeles({ files: [] as unknown as FileList, items: texto })).toBeNull();
    expect(archivoDelPortapapeles(null)).toBeNull();
  });
});
