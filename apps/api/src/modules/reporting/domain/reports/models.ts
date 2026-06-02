/** Reporting domain models. Reports READ immutable sources and never write the ledger. */
export type ReportType = 'trial_balance' | 'general_ledger' | 'account_card' | 'journal' | 'profit_and_loss' | 'balance_sheet' | 'vat' | 'invoice';
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type Direction = 'debit' | 'credit';

export interface LedgerLine { entryId: string; entryNo: number; date: string; ref?: string; accountCode: string; accountName: string; type: AccountType; direction: Direction; amount: string; narrative?: string; }

export interface TrialBalanceRow { accountCode: string; accountName: string; type: AccountType; debit: string; credit: string; balance: string; }
export interface TrialBalance { rows: TrialBalanceRow[]; totals: { debit: string; credit: string; balanced: boolean }; period: { from: string; to: string }; }
export interface ProfitAndLoss { revenue: string; expense: string; netProfit: string; period: { from: string; to: string }; }
export interface BalanceSheet { assets: string; liabilities: string; equity: string; balanced: boolean; asOf: string; }
export interface AccountCardEntry { date: string; ref?: string; narrative?: string; direction: Direction; amount: string; balance: string; }
export interface AccountCard { accountCode: string; accountName: string; rows: AccountCardEntry[]; closingBalance: string; period: { from: string; to: string }; }
export interface JournalReportEntry { entryNo: number; date: string; description: string; sourceType: string; lines: { accountCode: string; direction: Direction; amount: string }[]; }
export interface GeneralLedgerAccount { accountCode: string; accountName: string; lines: { date: string; ref?: string; direction: Direction; amount: string; balance: string }[]; total: { debit: string; credit: string } }
export interface InvoiceReportRow { invoiceNumber?: string; customerName?: string; issueDate?: string; netTotal: string; vatTotal: string; grossTotal: string; status: string; }
