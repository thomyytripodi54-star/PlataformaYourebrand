# Plataforma Yourebrand

Plataforma interna de la agencia: un inicio con el mapa de clientes y una entrada por área (Dirección, RRHH, Finanzas, Creativa y Operaciones).

- **Stack:** Next.js 16 (App Router), React 19, Tailwind 4, Motion, MapLibre y cobe. Datos en vivo desde Notion; follow ups y Finanzas en Upstash Redis.
- **Desarrollo:** `npm run dev` · **Tests:** `npm test` · **Lint:** `npm run lint`.
- **Variables (Vercel):** `NOTION_TOKEN`, `NOTION_WEBHOOK_SECRET`, `AUTH_USER`, `AUTH_PASSWORD`, `AUTH_SECRET` y la base Upstash Redis conectada al proyecto (`KV_REST_API_URL`, `KV_REST_API_TOKEN`).

## Asistente de dirección

Círculo en la esquina inferior derecha (todas las pantallas). Responde consultas y aconseja con los datos de la agencia; **es de solo lectura** (no tiene herramientas: no puede modificar la plataforma, Notion ni la planilla).

- **Qué sabe** (`lib/asistente/contexto.ts`):
  - Estado de resultados de la plataforma.
  - Planilla "Yourebrand Finanzas": Resumen INV publicitaria, INV publicitaria por campaña, Métricas Agencia 2026 y OBJETIVOS 2026.
  - La pestaña de cada mes ("Octubre 26") y de cada trimestre ("Metricas Agencia Q3 2026"), con objetivos, estado y progreso. En vivo se detectan solas; en la copia están octubre 2026 y los 4 trimestres de 2026.
  - Funnel de venta de Notion (reuniones, contrataciones, campaña de origen y pagos).
  - Clientes, organigrama, casos, comentarios recientes y follow ups.
  - No le llegan teléfonos ni emails.
- **Modelo:** `claude-sonnet-5-5` (variable opcional `ASISTENTE_MODELO` para cambiarlo, por ejemplo a `claude-opus-5-5`). Razonamiento adaptativo, esfuerzo medio, respaldo automático si el modelo declina y caché de prompt para los datos.
- **Variables:**
  - `ANTHROPIC_API_KEY` (obligatoria).
  - `GOOGLE_SERVICE_ACCOUNT_JSON` (opcional): JSON de una cuenta de servicio de Google con la planilla compartida como lector. Sin ella, se usa la copia de `data/asistente/planilla.json`.

## Datos y caché

- **Notion** se lee por la API (`lib/notion.ts`) con reintentos si Notion limita los pedidos (429) o falla (5xx). Si aun así falla, se usa la última lectura buena; la copia local de `data/` es el último recurso.
- **Cachés** (`lib/datos.ts`): datos generales (clientes, casos, nómina), comentarios **por cliente**, calendario **por cliente** y el mapa de qué calendario es de quién. Todo se sirve desde la caché y se refresca en segundo plano.
- **Webhook de Notion** (`app/api/notion-webhook`): invalida solo lo que cambió. Un comentario refresca los comentarios de ese cliente; una publicación, su calendario; cualquier página, los datos generales.
- **Follow up** (`lib/followup.ts`): un campo por cliente en un hash de Redis, así dos personas no se pisan. Las pantallas que lo muestran se arman en cada visita.
- **Recursos estáticos:** las capas del mapa (`public/geo`) y el worker de MapLibre se guardan un día en el navegador.

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
