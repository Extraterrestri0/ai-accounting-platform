'use client';
/** Invoice Preview — renders the generated PDF artifact for an issued invoice. */
export function InvoicePreviewScreen({ pdfUrl }: { pdfUrl?: string }) {
  if (!pdfUrl) return <p>No PDF yet — issue the invoice to generate one.</p>;
  return (
    <section>
      <h1>Преглед · Invoice PDF preview</h1>
      <iframe title="invoice pdf" src={pdfUrl} style={{ width: '100%', height: 640 }} />
    </section>
  );
}
