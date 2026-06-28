import { Logger } from '@nestjs/common';
import type { OcrProvider } from '../application/ocr.port';
import { DefaultOcrProvider } from './default-ocr-provider';
import { StubOcrProvider } from './stub-ocr-provider';
import { HttpOcrProvider } from './http-ocr-provider';
import { AzureDocIntelligenceProvider } from './azure-docintel-provider';

/**
 * Selects the OCR / Document-AI provider from configuration. Used by DocIntelModule
 * via `useFactory`. Backward compatible: with no OCR_PROVIDER set it returns the
 * existing DefaultOcrProvider (pdfjs born-digital + generic vendor + dev sample).
 *
 *   OCR_REAL=false        → StubOcrProvider (tests/preview)
 *   OCR_PROVIDER=azure    → Azure AI Document Intelligence (structured, EU)
 *   OCR_PROVIDER=http     → generic EU HTTPS vendor (text or structured)
 *   OCR_PROVIDER=stub     → StubOcrProvider
 *   OCR_PROVIDER=default  → DefaultOcrProvider (current behaviour)  [default]
 */
export function createOcrProvider(env: NodeJS.ProcessEnv = process.env): OcrProvider {
  const log = new Logger('OCR.Factory');
  if (env.OCR_REAL === 'false') { log.warn('OCR_REAL=false — using dev stub OCR.'); return new StubOcrProvider(); }
  const choice = (env.OCR_PROVIDER ?? 'default').toLowerCase();
  switch (choice) {
    case 'azure': log.log('OCR provider: Azure Document Intelligence (EU).'); return new AzureDocIntelligenceProvider();
    case 'http':  log.log('OCR provider: generic EU HTTP vendor.'); return new HttpOcrProvider();
    case 'stub':  return new StubOcrProvider();
    case 'default':
    default:      log.log('OCR provider: default (pdfjs + vendor + dev fallback).'); return new DefaultOcrProvider();
  }
}
