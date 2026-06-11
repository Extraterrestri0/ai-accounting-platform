export class UnsupportedFileTypeError extends Error {
  constructor(t: string) { super(`Unsupported file type: ${t}. Allowed: PDF, JPG, JPEG, PNG, TIFF, XML.`); this.name = 'UnsupportedFileTypeError'; }
}
export class FileTooLargeError extends Error {
  constructor(size: number, max: number) { super(`File too large: ${size} bytes (max ${max}).`); this.name = 'FileTooLargeError'; }
}
export class FileTypeMismatchError extends Error {
  constructor() { super('File content does not match a supported type (magic-byte check failed).'); this.name = 'FileTypeMismatchError'; }
}
export class DocumentNotFoundError extends Error {
  constructor(id: string) { super(`Document ${id} not found.`); this.name = 'DocumentNotFoundError'; }
}
export class InvalidDocumentStateError extends Error {
  constructor(msg: string) { super(msg); this.name = 'InvalidDocumentStateError'; }
}
/** Raised when the scan/extract pipeline cannot be reached (Redis/BullMQ down). Recoverable: retry. */
export class ScanQueueUnavailableError extends Error {
  constructor(cause?: string) { super(`The document scan pipeline is temporarily unavailable. Please try again.${cause ? ` (${cause})` : ''}`); this.name = 'ScanQueueUnavailableError'; }
}
/**
 * Raised when an image/scan needs OCR but no real OCR provider is configured.
 * The dev sample is NOT an acceptable substitute for a customer document (no fake results).
 */
export class OcrUnavailableError extends Error {
  constructor() { super('OCR provider is not configured. Image invoices cannot be extracted automatically. Enter the fields manually in review, or configure an OCR provider.'); this.name = 'OcrUnavailableError'; }
}
