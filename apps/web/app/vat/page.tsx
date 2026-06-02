import { VatDashboardScreen } from '@/components/domain/vat/VatDashboardScreen';
import { RegisterScreen } from '@/components/domain/vat/RegisterScreen';
export default function Page() { return (<div className="space-y-6"><VatDashboardScreen year={2026} month={4} /><RegisterScreen kind="purchase" year={2026} month={4} /><RegisterScreen kind="sales" year={2026} month={4} /></div>); }
