// Domain event contracts PUBLISHED by the MasterData context (names are stable;
// payload shapes are finalized in the masterdata feature task). Subscribers depend on these.

export const MasterDataEvents = {
  CounterpartyCreated: 'masterdata.counterparty_created',
  CounterpartyValidated: 'masterdata.counterparty_validated',
  ChartOfAccountsInitialized: 'masterdata.chart_of_accounts_initialized',
} as const;

export type MasterDataEventType = (typeof MasterDataEvents)[keyof typeof MasterDataEvents];
