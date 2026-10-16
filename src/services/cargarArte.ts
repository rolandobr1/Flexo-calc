/**
 * Carga del arte (imagen o PDF) en el navegador.
 * El PDF se procesa localmente con pdf.js: el archivo no sale de la máquina.
 */

export const LIMITE_IMAGEN_MB = 20;
export const LIMITE_PDF_MB = 50;
export const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

/** Lado mayor del render de un PDF, en px. */
const LADO_RENDER_PDF = 2400;

export interface ArteCargado {
  dataUrl: string;
  anchoPx: number;
  altoPx: number;
  paginas: number;
  pagina: number;
  /** Solo PDF: pulgadas reales por píxel del render. */
  pulgadasPorPx: number | null;
}

export function validarArchivo(f: { type: string; size: number }): string | null {
  if (!(TIPOS_ACEPTADOS as readonly string[]).includes(f.type)) {
    return 'Formato no soportado. Use JPG, PNG, WEBP o PDF.';
  }
  const mb = 1024 * 1024;
  if (f.type === 'application/pdf') {
    return f.size > LIMITE_PDF_MB * mb ? `El PDF supera el límite de ${LIMITE_PDF_MB}MB.` : null;
  }
  return f.size > LIMITE_IMAGEN_MB * mb ? `La imagen supera el límite de ${LIMITE_IMAGEN_MB}MB.` : null;
}

/**
 * Archivo pegado desde el portapapeles (Ctrl+V): una imagen copiada (captura, imagen copiada
 * desde otro programa) o un archivo copiado en el Explorador. null si no hay ninguno.
 */
export function archivoDelPortapapeles(dt: Pick<DataTransfer, 'files' | 'items'> | null): File | null {
  if (!dt) return null;
  for (const f of Array.from(dt.files ?? [])) if (f) return nombrarPegado(f);
  for (const it of Array.from(dt.items ?? [])) {
    if (it.kind === 'file') {
      const f = it.getAsFile();
      if (f) return nombrarPegado(f);
    }
  }
  return null;
}

function nombrarPegado(f: File): File {
  if (f.name && f.name !== 'image.png') return f;
  const ext = f.type.split('/')[1] ?? 'png';
  return new File([f], `Imagen pegada.${ext}`, { type: f.type });
}

/** Pulgadas por píxel: puntos PDF ÷ 72 = pulgadas, repartidas en el ancho renderizado. */
export function escalaPdf(anchoPaginaPt: number, anchoRenderPx: number): number {
  return anchoPaginaPt / 72 / anchoRenderPx;
}

function leerDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo abrir la imagen.'));
    img.src = src;
  });
}

async function cargarPdf(file: File, pagina: number): Promise<ArteCargado> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (err) {
    if (err instanceof Error && err.name === 'PasswordException') {
      throw new Error('El PDF está protegido con contraseña.');
    }
    throw new Error('No se pudo abrir el PDF.');
  }

  const num = Math.min(Math.max(1, pagina), doc.numPages);
  const page = await doc.getPage(num);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: LADO_RENDER_PDF / Math.max(base.width, base.height) });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo abrir el PDF.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  return {
    dataUrl: canvas.toDataURL('image/png'),
    anchoPx: canvas.width,
    altoPx: canvas.height,
    paginas: doc.numPages,
    pagina: num,
    pulgadasPorPx: escalaPdf(base.width, canvas.width),
  };
}

export async function cargarArte(file: File, pagina = 1): Promise<ArteCargado> {
  const error = validarArchivo(file);
  if (error) throw new Error(error);
  if (file.type === 'application/pdf') return cargarPdf(file, pagina);

  const dataUrl = await leerDataUrl(file);
  const img = await cargarImagen(dataUrl);
  return {
    dataUrl,
    anchoPx: img.naturalWidth,
    altoPx: img.naturalHeight,
    paginas: 1,
    pagina: 1,
    pulgadasPorPx: null,
  };
}

