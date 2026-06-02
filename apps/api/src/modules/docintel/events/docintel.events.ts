// Domain event contracts PUBLISHED by the DocIntel context (names are stable;
// payload shapes are finalized in the docintel feature task). Subscribers depend on these.

export const DocIntelEvents = {
  DocumentReceived: 'docintel.document_received',
  OcrCompleted: 'docintel.ocr_completed',
  ExtractionCompleted: 'docintel.extraction_completed',
  SuggestionReady: 'docintel.suggestion_ready',
  ReviewItemCreated: 'docintel.review_item_created',
  FeedbackRecorded: 'docintel.feedback_recorded',
} as const;

export type DocIntelEventType = (typeof DocIntelEvents)[keyof typeof DocIntelEvents];
