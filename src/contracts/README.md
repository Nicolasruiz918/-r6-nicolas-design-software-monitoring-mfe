# contracts — monitoring

Tipos de API **generados**, nunca escritos a mano (ADR-009 seccion 5).

- Origen del contrato: `design-software-shared-contracts/openapi/monitoring.yaml`.
  Hoy ese archivo vive en `design-software-docs/07-api/contracts/openapi/monitoring.yaml` y debe
  publicarse en `shared-contracts/openapi/` para que la generacion sea reproducible.
- Destino de los tipos generados: este directorio.
- `remote-props.ts` es un **placeholder local** de la forma expuesta del remote. La version
  autoritativa es `design-software-frontend-platform/src/contracts/remote-props.ts`
  (ADR-009 seccion 11); cuando ese paquete se publique, `src/App.tsx` debe pasar a implementar
  esa interfaz y este archivo debe eliminarse.
