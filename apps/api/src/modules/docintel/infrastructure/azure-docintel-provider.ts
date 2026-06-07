import { Injectable, Logger } from '@nestjs/common';
import type { OcrField, OcrProvider, OcrResult } from '../application/ocr.port';
import type { FieldKey } from '../domain/extraction/models';

/**
 * Production Document-AI adapter — Azure AI Document Intelligence (Form Recognizer),
 * `prebuilt-invoice` model. Returns full text PLUS structured invoice fields with
 * per-field vendor confidence. Bulgarian + Latin scripts are supported by the model.
 *
 * GDPR / EU residency: the resource MUST be deployed in an approved EU region. The
 * region is asserted at construction (fail-fast); set OCR_ALLOW_NON_EU=true only to
 * bypass deliberately. The synchronous analyze call does not retain input documents.
 *
 * Config:
 *   AZURE_DOCINTEL_ENDPOINT   e.g. https://<resource>.cognitiveservices.azure.com
 *   AZURE_DOCINTEL_KEY        resource key
 *   AZURE_DOCINTEL_REGION     EU region id (westeurope, northeurope, francecentral, …)
 *   AZURE_DOCINTEL_MODEL      default 'prebuilt-invoice'
 *   AZURE_DOCINTEL_API_VERSION default '2023-07-31'
 *   OCR_TIMEOUT_MS            default 30000
 */
const EU_REGIONS = new Set([
  'westeurope', 'northeurope', 'francecentral', 'germanywestcentral',
  'swedencentral', 'switzerlandnorth', 'norwayeast', 'polandcentral',
  'italynorth', 'spaincentral',
]);

interface AzureField {
  type?: string; content?: string; confidence?: number;
  valueString?: string; valueDate?: string; valueNumber?: number;
  valuePhoneNumber?: string; valueCurrency?: { amount?: number; currencyCode?: string };
}
interface AzureAnalyze {
  status?: string; error?: unknown;
  analyzeResult?: { content?: string; pages?: unknown[]; documents?: Array<{ fields?: Record<string, AzureField> }> };
}

@Injectable()
export class AzureDocIntelligenceProvider implements OcrProvider {
  private readonly log = new Logger('OCR.Azure');
  private readonly endpoint: string;
  private readonly key: string;
  private readonly model: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;

  constructor() {
    this.endpoint = (process.env.AZURE_DOCINTEL_ENDPOINT ?? '').replace(/\/+$/, '');
    this.key = process.env.AZURE_DOCINTEL_KEY ?? '';
    this.model = process.env.AZURE_DOCINTEL_MODEL ?? 'prebuilt-invoice';
    this.apiVersion = process.env.AZURE_DOCINTEL_API_VERSION ?? '2023-07-31';
    this.timeoutMs = Number(process.env.OCR_TIMEOUT_MS ?? 30000);
    if (!this.endpoint || !this.key) {
      throw new Error('Azure Document Intelligence selected but AZURE_DOCINTEL_ENDPOINT / AZURE_DOCINTEL_KEY are not set.');
    }
    this.assertEuResidency();
  }

  private assertEuResidency(): void {
    if (process.env.OCR_ALLOW_NON_EU === 'true') { this.log.warn('OCR_ALLOW_NON_EU=true — EU residency guard bypassed.'); return; }
    const region = (process.env.AZURE_DOCINTEL_REGION ?? '').toLowerCase().replace(/\s+/g, '');
    if (!region) throw new Error('AZURE_DOCINTEL_REGION must be an approved EU region (GDPR/EU residency).');
    if (!EU_REGIONS.has(region)) throw new Error(`AZURE_DOCINTEL_REGION "${region}" is not an approved EU region.`);
  }

  async recognize(bytes: Buffer, mimeType: string): Promise<OcrResult> {
    const analyzeUrl = `${this.endpoint}/formrecognizer/documentModels/${this.model}:analyze?api-version=${this.apiVersion}`;
    const submit = await fetch(analyzeUrl, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': this.key, 'Content-Type': mimeType || 'application/octet-stream' },
      body: new Uint8Array(bytes),
    });
    if (submit.status !== 202) {
      throw new Error(`Azure DI submit failed: ${submit.status} ${(await this.safeText(submit)).slice(0, 240)}`);
    }
    const opUrl = submit.headers.get('operation-location') ?? submit.headers.get('Operation-Location');
    if (!opUrl) throw new Error('Azure DI: missing operation-location header.');

    const result = await this.poll(opUrl);
    const ar = result.analyzeResult ?? {};
    const docFields = ar.documents?.[0]?.fields ?? {};
    const fields = this.mapInvoiceFields(docFields);
    this.log.log(`Azure DI ok — ${fields.length} fields, ${ar.pages?.length ?? 1} page(s).`);
    return {
      text: ar.content ?? '',
      pageCount: ar.pages?.length ?? 1,
      engine: `azure-docintel@${this.model}`,
      provider: 'azure',
      model: `${this.model}/${this.apiVersion}`,
      fields,
    };
  }

  private async poll(opUrl: string): Promise<AzureAnalyze> {
    const deadline = Date.now() + this.timeoutMs;
    const interval = 1000;
    for (;;) {
      if (Date.now() > deadline) throw new Error('Azure DI: polling timed out.');
      await new Promise((r) => setTimeout(r, interval));
      const poll = await fetch(opUrl, { headers: { 'Ocp-Apim-Subscription-Key': this.key } });
      if (!poll.ok) throw new Error(`Azure DI poll failed: ${poll.status}`);
      const body = (await poll.json()) as AzureAnalyze;
      const status = (body.status ?? '').toLowerCase();
      if (status === 'succeeded') return body;
      if (status === 'failed') throw new Error(`Azure DI analysis failed: ${JSON.stringify(body.error ?? {}).slice(0, 200)}`);
      // 'running' | 'notstarted' → keep polling
    }
  }

  /** Map Azure prebuilt-invoice fields → our canonical FieldKeys (only emitting present values). */
  private mapInvoiceFields(f: Record<string, AzureField>): OcrField[] {
    const out: OcrField[] = [];
    const str = (k: string): AzureField | undefined => f[k];
    const conf = (x?: AzureField): number => (typeof x?.confidence === 'number' ? x.confidence : 0.5);
    const text = (x?: AzureField): string | null => (x ? (x.valueString ?? x.content ?? null) : null);
    const date = (x?: AzureField): string | null => (x ? (x.valueDate ?? x.content ?? null) : null);
    const money = (x?: AzureField): string | null => {
      const a = x?.valueCurrency?.amount ?? x?.valueNumber;
      return typeof a === 'number' ? a.toFixed(2) : null;
    };
    const add = (key: FieldKey, value: string | null, source?: AzureField): void => {
      if (value != null && String(value).trim() !== '') out.push({ key, value: String(value).trim(), confidence: conf(source) });
    };

    add('supplier_name', text(str('VendorName')), str('VendorName'));
    add('supplier_vat', text(str('VendorTaxId')), str('VendorTaxId'));
    add('customer_name', text(str('CustomerName')), str('CustomerName'));
    add('customer_vat', text(str('CustomerTaxId')), str('CustomerTaxId'));
    add('invoice_number', text(str('InvoiceId')), str('InvoiceId'));
    add('invoice_date', date(str('InvoiceDate')), str('InvoiceDate'));
    add('due_date', date(str('DueDate')), str('DueDate'));
    add('net_amount', money(str('SubTotal')), str('SubTotal'));
    add('vat_amount', money(str('TotalTax')), str('TotalTax'));
    add('total_amount', money(str('InvoiceTotal')), str('InvoiceTotal'));

    const cur = str('InvoiceTotal')?.valueCurrency?.currencyCode ?? str('SubTotal')?.valueCurrency?.currencyCode;
    if (cur) out.push({ key: 'currency', value: cur, confidence: conf(str('InvoiceTotal') ?? str('SubTotal')) });

    return out;
  }

  private async safeText(r: Response): Promise<string> { try { return await r.text(); } catch { return ''; } }
}
