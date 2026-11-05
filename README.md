This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Finanzas › Estado de Resultados
- Datos: `data/finanzas/estado-resultados.json`, un registro por mes consolidado (líneas del ER en ARS, dólar usado, recurrencias, clientes/entradas/bajas, análisis). 2026 (enero–octubre) se importó de Google Sheets "Yourebrand Finanzas" y se validó que cada mes cierre exacto contra la planilla.
- Los totales, %, USD, trimestres y año se calculan en `lib/finanzas.ts`; no se cargan a mano.
- Hasta junio 2026 CM y Producción iban juntos (`produccion: null`).
- Alerta: desde el día 1 del mes M, si M−1 no está consolidado queda **pendiente**; después del día 10 (`NEXT_PUBLIC_DIA_LIMITE_ER`) queda **atrasado**. Se calcula en el servidor con la hora de Buenos Aires.
- Tests: `npm test` (números de octubre 2026 según la skill, cierre de los 10 meses, agregados por Q y alertas con fechas simuladas).
- **Consolidar desde la plataforma ("+")**: se sube el Excel (.xlsx con BALANCE) y el servidor ejecuta la skill:
  - `lib/er/excel.ts` lee BALANCE igual que `er_mes.py` (bloques en la fila 23, fila `=SUM`, "Calculo diferido").
  - `lib/er/motor.ts` es el port 1:1 de `er_mes.py`. El original está en `scripts/skill/er_mes.py` y `tests/motor-er.test.ts` verifica que ambos den exactamente lo mismo (líneas, totales, detalle y REVISAR).
  - `lib/er/insumos.ts` trae de Notion la Nómina (roles), Clientes (abonos, planes, altas y bajas) y Vencimientos del mes, y el dólar blue del día (dolarapi.com, promedio compra/venta).
  - Pantalla de revisión: cada ítem de REVISAR se resuelve (línea + confirmar) y el ER se recalcula al instante. No se puede confirmar con ítems pendientes ni con diferencia sin explicar contra el "Calculo diferido".
  - Al confirmar se recalcula en el servidor y se guarda una **versión nueva** (historial y log) en Upstash Redis (privado).
- **Configuración en Vercel**: Storage → *Upstash for Redis* → conectar al proyecto (crea `KV_REST_API_URL` y `KV_REST_API_TOKEN`). `NOTION_TOKEN` con acceso a Nómina, Clientes y "Vencimientos del mes".
- **Prueba local sin Notion ni Redis**: `ER_FIXTURES=$PWD/tests/fixtures npm run dev` y subir un Excel generado con `npx tsx tests/fixtures/generar.ts balance.xlsx`.
- **Octubre 2026 está vaciado temporalmente** para probar la consolidación; su versión importada está en `data/finanzas/respaldo-octubre-2026.json`.
