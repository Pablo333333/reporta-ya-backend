/**
 * Webpack config personalizado para NestJS + Prisma v7.
 *
 * Problema: los archivos generados por Prisma v7 (`generated/prisma/*.ts`)
 * importan entre sí con extensión `.js` (p.ej. `import ... from './enums.js'`).
 * Webpack no resuelve `.js` → `.ts` por defecto.
 *
 * Solución: `extensionAlias` de webpack 5.28+ intenta `.ts` antes que `.js`
 * para imports con extensión `.js` o `.mjs`, compatibilizando ESM generado
 * con la compilación CommonJS del proyecto.
 */
module.exports = (options) => {
  return {
    ...options,
    resolve: {
      ...options.resolve,
      extensionAlias: {
        '.js': ['.ts', '.js'],
        '.mjs': ['.mts', '.mjs'],
      },
    },
  };
};
