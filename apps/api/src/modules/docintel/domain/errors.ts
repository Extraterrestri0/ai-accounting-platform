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
