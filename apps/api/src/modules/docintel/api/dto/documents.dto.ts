import type { DocumentStatus, DetectedType } from '../../domain/models';
export interface InitiateUploadDto { filename: string; mimeType: string; sizeBytes: number; }
export interface FinalizeUploadDto { checksumSha256: string; }
export interface ScanResultDto { result: 'clean' | 'infected' | 'error'; engine: string; }
export interface ListDocumentsDto { status?: DocumentStatus; type?: DetectedType; search?: string; page?: number; pageSize?: number; }
