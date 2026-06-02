import { ReportsDashboardScreen } from '@/components/domain/reporting/ReportsDashboardScreen';
import { TrialBalanceScreen } from '@/components/domain/reporting/TrialBalanceScreen';
import { ProfitAndLossScreen } from '@/components/domain/reporting/ProfitAndLossScreen';
import { VatReportScreen } from '@/components/domain/reporting/VatReportScreen';
export default function Page() { return (<div className="space-y-6"><ReportsDashboardScreen /><TrialBalanceScreen /><ProfitAndLossScreen /><VatReportScreen /></div>); }
