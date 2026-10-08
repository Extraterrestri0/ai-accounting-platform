/** Document upload domain models. */
export type DocumentStatus = 'pending_upload' | 'uploaded' | 'scanning' | 'ready' | 'quarantined' | 'failed' | 'trashed' | 'deleted';
export type DetectedType = 'pdf' | 'png' | 'jpeg' | 'tiff' | 'xml';
export type ScanStatus = 'pending' | 'clean' | 'infected' | 'error';

export interface Document {
  id: string; companyId: string; originalFilename: string; mimeType: string;
  sizeBytes?: number; status: DocumentStatus; storageKey?: string; checksumSha256?: string;
  counterpartyId?: string; documentDate?: string; source: string; uploadedBy?: string;
  createdAt: string; updatedAt: string;
}
export interface DocumentVersion {
  id: string; documentId: string; versionNo: number; storageKey: string; checksumSha256: string; sizeBytes: number; createdAt: string;
}
export interface DocumentMetadata {
  documentId: string; detectedType?: DetectedType; pageCount?: number;
  scanStatus: ScanStatus; scanEngine?: string; scannedAt?: string;
}
export interface DocumentWithMeta extends Document { metadata?: DocumentMetadata; }
