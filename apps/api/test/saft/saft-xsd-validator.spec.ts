import { join } from 'node:path';
import { LibxmlXsdValidator } from '../../src/modules/saft/infrastructure/libxml-xsd.validator';
import { normalizeXsdErrors } from '../../src/modules/saft/domain/saft-xsd';

const XSD = join(__dirname, 'fixtures', 'tiny.xsd');
const VALID_XML = '<?xml version="1.0" encoding="UTF-8"?>\n<note><to>Иван</to></note>';
const INVALID_XML = '<?xml version="1.0" encoding="UTF-8"?>\n<note><from>x</from></note>';

describe('normalizeXsdErrors (pure)', () => {
  it('maps libxml details to portable issues and drops unknown (0) line/col', () => {
    expect(normalizeXsdErrors([
      { message: ' element not expected ', line: 3, col: 5 },
      { message: '', line: 0, col: 0 },
    ])).toEqual([
      { message: 'element not expected', line: 3, column: 5 },
      { message: 'Unknown schema validation error' },
    ]);
    expect(normalizeXsdErrors(undefined)).toEqual([]);
  });
});

describe('LibxmlXsdValidator — inert when no schema is configured', () => {
  it('isConfigured() is false and validate() returns ok=null (NOT false)', async () => {
    const v = new LibxmlXsdValidator({}); // no xsdPath
    expect(v.isConfigured()).toBe(false);
    const r = await v.validate(VALID_XML);
    expect(r.ok).toBeNull();
    expect(r.errors).toEqual([]);
    expect(r.schemaVersion).toBeNull();
  });

  it('echoes the configured schemaVersion even while inert', async () => {
    const v = new LibxmlXsdValidator({ schemaVersion: 'nra-saft-x' });
    const r = await v.validate(VALID_XML);
    expect(r).toEqual({ ok: null, errors: [], schemaVersion: 'nra-saft-x' });
  });
});

describe('LibxmlXsdValidator — against a tiny test XSD (libxml2-wasm)', () => {
  const v = new LibxmlXsdValidator({ xsdPath: XSD, schemaVersion: 'tiny-1.0' });

  it('is configured when a schema path is supplied', () => {
    expect(v.isConfigured()).toBe(true);
  });

  it('valid XML → ok:true, no errors, schemaVersion echoed', async () => {
    const r = await v.validate(VALID_XML);
    expect(r).toEqual({ ok: true, errors: [], schemaVersion: 'tiny-1.0' });
  });

  it('invalid XML → ok:false with normalized, non-empty errors', async () => {
    const r = await v.validate(INVALID_XML);
    expect(r.ok).toBe(false);
    expect(r.schemaVersion).toBe('tiny-1.0');
    expect(r.errors.length).toBeGreaterThan(0);
    expect(typeof r.errors[0].message).toBe('string');
    expect(r.errors[0].message.length).toBeGreaterThan(0);
  });
});

// Note: the validator is consumed by the export service from Phase 5 onward. The guarantee
// that the v1 (flag-off) path performs NO XSD validation is asserted behaviorally in
// saft-export.spec.ts ("does NOT touch storage or the XSD validator on the v1 path").
