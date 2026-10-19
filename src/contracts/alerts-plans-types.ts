import type { components } from './generated/monitoring.js';

export type GeneratedAlert = components['schemas']['GeneratedAlert'];
export type GeneratedAlertResolve = components['schemas']['GeneratedAlertResolve'];
export type ImprovementPlan = components['schemas']['ImprovementPlan'];
export type ImprovementPlanCreate = components['schemas']['ImprovementPlanCreate'];

/** improvement_plan.status es un string cerrado derivado del contrato: nunca se importa el enum de Postgres. */
export type PlanStatus = ImprovementPlan['status'];