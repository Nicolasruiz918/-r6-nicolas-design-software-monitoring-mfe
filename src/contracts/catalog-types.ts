import type { components } from './generated/monitoring.js';

export type KpiType = components['schemas']['KpiType'];
export type KpiTypeCreate = components['schemas']['KpiTypeCreate'];
export type KpiTypeUpdate = components['schemas']['KpiTypeUpdate'];
export type AlertType = components['schemas']['AlertType'];
export type AlertTypeCreate = components['schemas']['AlertTypeCreate'];
export type AlertTypeUpdate = components['schemas']['AlertTypeUpdate'];
export type RiskLevel = components['schemas']['RiskLevel'];
export type KpiStatus = components['schemas']['KpiStatus'];
export type Pagination = components['schemas']['Pagination'];
export type CursorPagination = components['schemas']['CursorPagination'];
export type KpiUnit = KpiType['unit'];
export type ThresholdUnit = NonNullable<AlertTypeCreate['threshold_unit']>;
export type KpiTracking = components['schemas']['KpiTracking'];
export type KpiTrackingCreate = Record<string, unknown>;
export type KpiSummaryReportEntry = components['schemas']['KpiSummaryReportEntry'];
export type IndicatorsReportEntry = components['schemas']['IndicatorsReportEntry'];

export interface CatalogPage<T> {
  data: T[];
  pagination: Pagination;
}
