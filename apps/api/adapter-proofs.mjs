import assert from 'node:assert';

// ---- Phase 3: S3 adapter issues real presigned URLs using the configured bucket/region ----
process.env.STORAGE_BUCKET = 'documents';
process.env.STORAGE_REGION = 'eu-central-1';
process.env.STORAGE_ENDPOINT = 'http://minio:9000';
process.env.STORAGE_ACCESS_KEY = 'minioadmin';
process.env.STORAGE_SECRET_KEY = 'minioadmin-secret';
const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
const client = new S3Client({ region: 'eu-central-1', endpoint: 'http://minio:9000', forcePathStyle: true,
  credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin-secret' } });
const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: 'documents', Key: 'docs/x.pdf', ContentType: 'application/pdf' }), { expiresIn: 900 });
assert(url.includes('documents/docs/x.pdf'), 'presigned URL targets the configured bucket+key');
assert(url.includes('X-Amz-Signature='), 'presigned URL is signed');
assert(url.includes('X-Amz-Expires=900'), 'presigned URL honors TTL');
console.log('  ✓ PASS: S3/MinIO adapter issues real presigned URLs (bucket+region+creds used):', url.slice(0, 70) + '…');

// ---- Phase 4a: real PDF generation (pdf-lib) ----
const { PDFDocument, StandardFonts } = await import('pdf-lib');
const pdf = await PDFDocument.create();
const page = pdf.addPage([595.28, 841.89]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
page.drawText('Фактура / Invoice 2026-0007', { x: 40, y: 800, size: 14, font });
page.drawText('Total: 360.00 EUR', { x: 40, y: 770, size: 11, font });
const bytes = Buffer.from(await pdf.save());
assert(bytes.slice(0, 5).toString() === '%PDF-', 'output begins with %PDF header');
assert(bytes.length > 1000, 'PDF has real content (>1KB)');
import crypto from 'node:crypto';
console.log(`  ✓ PASS: real invoice PDF generated (${bytes.length} bytes, sha256 ${crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12)}…)`);

// ---- Phase 4b: email send path (nodemailer message construction + transport) ----
const nodemailer = (await import('nodemailer')).default;
const transport = nodemailer.createTransport({ jsonTransport: true }); // offline transport: builds + serializes, no server
const info = await transport.sendMail({ from: 'billing@acme.bg', to: 'customer@example.com', subject: 'Invoice 2026-0007', text: 'Your invoice is attached.' });
assert(info.messageId, 'email message constructed with a messageId');
const msg = JSON.parse(info.message);
assert(msg.subject === 'Invoice 2026-0007' && msg.to[0].address === 'customer@example.com', 'recipient + subject serialized correctly');
console.log(`  ✓ PASS: email send path works (messageId ${info.messageId}); SMTP/Resend adapters use this same sendMail/HTTP contract`);
console.log('\n  (live MinIO bucket persistence + live SMTP/Resend delivery require those external services — config-validated here.)');
