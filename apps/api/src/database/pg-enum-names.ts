/**
 * Nomes dos tipos ENUM no PostgreSQL — única fonte de verdade alinhada às migrations.
 * Usar em @Column({ type: 'enum', enumName: PgEnumNames.xxx }) para evitar divergência com synchronize.
 */
export const PgEnumNames = {
  categoryType: 'category_type_enum',
  transactionDirection: 'transaction_direction_enum',
  transactionTransferLeg: 'transaction_transfer_leg_enum',
  transactionSource: 'transaction_source_enum',
  projectionTrend: 'projection_trend_enum',
  whatsappSessionStatus: 'whatsapp_sessions_status_enum',
  whatsappEventDirection: 'whatsapp_event_direction_enum',
  whatsappEventStatus: 'whatsapp_event_status_enum',
  aiChannel: 'ai_channel_enum',
  aiTraceStatus: 'ai_trace_status_enum',
  aiObservationType: 'ai_observation_type_enum',
  organizationPlan: 'organization_plan_enum',
  organizationTaxIdType: 'organization_tax_id_type_enum',
  organizationMembershipRole: 'organization_membership_role_enum',
  organizationMembershipStatus: 'organization_membership_status_enum',
  alertEventType: 'alert_event_type_enum',
  reminderRecurrence: 'reminder_recurrence_enum',
  debtKind: 'debt_kind_enum',
  debtStatus: 'debt_status_enum',
  debtInstallmentStatus: 'debt_installment_status_enum',
} as const;
