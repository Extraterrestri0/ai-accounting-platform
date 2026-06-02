import { InvoiceListScreen } from '@/components/domain/invoicing/InvoiceListScreen';
import { InvoiceDetailScreen } from '@/components/domain/invoicing/InvoiceDetailScreen';
export default function Page() { return (<div className="space-y-6"><InvoiceListScreen /><InvoiceDetailScreen invoiceId="inv-1" /></div>); }
