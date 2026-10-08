import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import type { SaftXsdValidator } from '../application/saft-xsd-validator.port';
import { normalizeXsdErrors, type RawXsdErrorDetail, type XsdValidationResult } from '../domain/saft-xsd';

export interface SaftXsdOptions {
  /** Filesystem path to the XSD schema. Unset → validator is inert (ok=null). */
  xsdPath?: string;
  /** Opaque schema-version label echoed back in results (e.g. an NRA schema version). */
  schemaVersion?: string;
}

/**
 * libxml2-wasm is ESM-only and uses top-level await. The API project builds to CommonJS
 * (node10), which would otherwise downlevel a static `import()` to `require()` (→ ERR_REQUIRE_ESM)
 * and fail to resolve its `.d.mts` types. We load it through an opaque dynamic import so neither
 * tsconfig touches the specifier; the module is typed structurally via Libxml2 below.
 */
const importEsm = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;

interface XmlDoc { dispose(): void }
interface Libxml2 {
  XmlDocument: { fromString(s: string): XmlDoc };
  XsdValidator: { fromDoc(d: XmlDoc): { validate(d: XmlDoc): void; dispose(): void } };
}

/**
 * Default XSD validation harness backed by libxml2-wasm. Pluggable behind SAFT_XSD_VALIDATOR.
 * Configuration (no schema content baked in):
 *   - SAFT_XSD_PATH    → path to the schema; absent ⇒ inert (ok=null, "not validated")
 *   - SAFT_XSD_VERSION → opaque version label echoed in every result
 */
@Injectable()
export class LibxmlXsdValidator implements SaftXsdValidator {
  private readonly log = new Logger('SaftXsd');
  private readonly xsdPath?: string;
  private readonly schemaVersion: string | null;

  constructor(opts: SaftXsdOptions = {}) {
    this.xsdPath = opts.xsdPath ?? process.env.SAFT_XSD_PATH ?? undefined;
    this.schemaVersion = (opts.schemaVersion ?? process.env.SAFT_XSD_VERSION) ?? null;
  }

  isConfigured(): boolean { return !!this.xsdPath; }

  async validate(xml: string): Promise<XsdValidationResult> {
    // Inert by default: no schema bound ⇒ "not validated" (ok=null), never false.
    if (!this.xsdPath) return { ok: null, errors: [], schemaVersion: this.schemaVersion };

    const lib = (await importEsm('libxml2-wasm')) as Libxml2;
    const xsdSource = readFileSync(this.xsdPath, 'utf8');
    let xsdDoc: XmlDoc | undefined;
    let validator: { validate(d: XmlDoc): void; dispose(): void } | undefined;
    let doc: XmlDoc | undefined;
    try {
      xsdDoc = lib.XmlDocument.fromString(xsdSource);
      validator = lib.XsdValidator.fromDoc(xsdDoc);
      doc = lib.XmlDocument.fromString(xml);
      try {
        validator.validate(doc);
        return { ok: true, errors: [], schemaVersion: this.schemaVersion };
      } catch (e) {
        // XmlValidateError carries libxml2 details; anything else is an internal fault → rethrow.
        const details = (e as { details?: RawXsdErrorDetail[] }).details;
        if (Array.isArray(details)) return { ok: false, errors: normalizeXsdErrors(details), schemaVersion: this.schemaVersion };
        throw e;
      }
    } finally {
      // libxml2-wasm requires explicit disposal to avoid WASM-heap leaks.
      try { doc?.dispose(); } catch { /* ignore */ }
      try { validator?.dispose(); } catch { /* ignore */ }
      try { xsdDoc?.dispose(); } catch { /* ignore */ }
    }
  }
}
