# FlexoCalc Pro · Plásticos Multiform

Calculadora interna del Departamento de Artes para **seleccionar la manga Comexi F2 ML** y **cotizar el costo de las planchas flexográficas** a partir del tamaño de la funda o del rollo y, opcionalmente, del arte.

## Qué hace

1. **Funda** — tipo (funda o rollo/lámina), ancho (define la manga), largo, bandas y colores, en pulgadas o milímetros.
2. **Arte** *(opcional)* — se sube un PDF o una imagen (o se pega con Ctrl+V) y se marca la funda; avisa si el marco no coincide con "frente y dorso" / "solo el frente".
3. **Montaje** — simula la plancha (bandas × repeticiones) para la manga elegida; se marca la zona impresa (de una copia o de toda la plancha) y, si hace falta, una zona propia o una medida manual por tinta.
4. **Resultados** — mejor opción con bandas × repeticiones destacadas y comparativa de 2 mangas por debajo y 2 por encima.

Costo = área cobrada × 0.30 × 1.18 (IVA), por color. Todo se calcula en el navegador: la app no tiene servidor ni base de datos y no envía datos a ningún lado.

## Uso local

Requisito: [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install
npm run dev        # abre http://localhost:3000
npm test           # pruebas
```

## Publicar

```bash
npm run build      # genera la carpeta dist/
```

Se copia el contenido de `dist/` a cualquier servidor de archivos estáticos (IIS, Apache, Nginx, Netlify…), en la raíz o en una subcarpeta. Para IIS ya va incluido el `web.config`.
Con HTTPS, la app se puede **instalar como aplicación de Windows** desde Edge o Chrome (⋯ → Aplicaciones → Instalar) y funciona sin internet después de la primera visita.

## Estructura

- `src/lib/` — cálculo puro con pruebas: mangas y costo (`costo.ts`), medición (`medicion.ts`), montaje (`montaje.ts`), funda (`funda.ts`), unidades (`unidades.ts`).
- `src/components/` — pasos de la app y visores del arte y del montaje.
- `docs/superpowers/` — especificaciones y planes de diseño.
