'use client';

import { API_BASE, getToken, getActiveCompany, api } from './client';

export interface InitiateResult {
  document: { id: string; storageKey?: string };
  uploadTarget: { url: string; method: 'PUT'; headers: Record<string, string>; storageKey: string };
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Full real upload: initiate → PUT bytes (with progress) → finalize. Returns the document id. */
export async function uploadDocument(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const init = await api<InitiateResult>('/documents/initiate', {
    method: 'POST',
    body: { filename: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size },
  });
  const docId = init.document.id;
  const buffer = await file.arrayBuffer();
  const checksum = await sha256Hex(buffer);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${API_BASE}${init.uploadTarget.url}`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    const company = getActiveCompany();
    if (company) xhr.setRequestHeader('X-Company-Id', company);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Качването е неуспешно (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Мрежова грешка при качване'));
    xhr.send(new Uint8Array(buffer));
  });

  await api(`/documents/${docId}/finalize`, { method: 'POST', body: { checksumSha256: checksum } });
  onProgress?.(100);
  return docId;
}
