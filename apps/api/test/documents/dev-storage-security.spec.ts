/**
 * Security regression tests for the local document-serving path (STORAGE_DRIVER=local, the
 * production driver). The GET /dev-storage/* route is excluded from the auth middleware, so
 * an HMAC-signed, time-limited URL is the access control. These prove:
 *   - a valid signed URL serves the bytes
 *   - an unsigned / forged / expired / key-tampered request is denied (404, no key oracle)
 *   - path traversal keys are refused by the storage adapter
 * (Finding A — previously: unauthenticated reads + unverified "signature" + traversal.)
 */
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  buildSignedLocalUrl, signStorageKey, verifyStorageSignature,
} from '../../src/modules/docintel/infrastructure/signed-url';
import { LocalObjectStorage } from '../../src/modules/docintel/infrastructure/local-object-storage';
import { DevStorageController } from '../../src/modules/docintel/api/dev-storage.controller';

const SECRET = 'unit-test-storage-secret-abcdef0123456789';
beforeAll(() => { process.env.STORAGE_URL_SECRET = SECRET; });

const parse = (url: string) => {
  const q = url.split('?')[1];
  const sp = new URLSearchParams(q);
  const key = decodeURIComponent(url.split('?')[0].replace('/dev-storage/', ''));
  return { key, exp: sp.get('exp') ?? undefined, sig: sp.get('sig') ?? undefined };
};

describe('signed-url HMAC', () => {
  const KEY = 't-1/c-1/doc-1/invoice.pdf';

  it('verifies a freshly built signed URL', () => {
    const { key, exp, sig } = parse(buildSignedLocalUrl(KEY, 300, SECRET));
    expect(key).toBe(KEY);
    expect(verifyStorageSignature(KEY, exp, sig, SECRET)).toBe(true);
  });

  it('rejects a missing signature', () => {
    expect(verifyStorageSignature(KEY, String(Date.now() + 1000), undefined, SECRET)).toBe(false);
    expect(verifyStorageSignature(KEY, undefined, 'deadbeef', SECRET)).toBe(false);
  });

  it('rejects a forged signature (wrong secret / guessed hash)', () => {
    const exp = String(Date.now() + 60_000);
    const forged = signStorageKey(KEY, Number(exp), 'attacker-secret');
    expect(verifyStorageSignature(KEY, exp, forged, SECRET)).toBe(false);
    // plain unkeyed sha256 (the old scheme) must not validate either
    const crypto = require('node:crypto');
    const unkeyed = crypto.createHash('sha256').update(KEY + exp).digest('hex').slice(0, 16);
    expect(verifyStorageSignature(KEY, exp, unkeyed, SECRET)).toBe(false);
  });

  it('rejects an expired signature', () => {
    const past = Date.now() - 1000;
    const sig = signStorageKey(KEY, past, SECRET);
    expect(verifyStorageSignature(KEY, String(past), sig, SECRET)).toBe(false);
  });

  it('rejects a key swap (signature bound to a different key)', () => {
    const { exp, sig } = parse(buildSignedLocalUrl(KEY, 300, SECRET));
    expect(verifyStorageSignature('t-1/c-1/doc-1/OTHER.pdf', exp, sig, SECRET)).toBe(false);
    // a different tenant trying to reuse the token for their own key fails
    expect(verifyStorageSignature('t-2/c-9/doc-9/x.pdf', exp, sig, SECRET)).toBe(false);
  });
});

describe('DevStorageController GET access control', () => {
  const bytes = Buffer.from('%PDF-1.7 demo');
  const KEY = 't-1/c-1/doc-1/invoice.pdf';
  const storage = {
    readObject: jest.fn(async (k: string) => { if (k === KEY) return bytes; throw new Error('not found'); }),
  } as any;
  const controller = new DevStorageController(storage);

  const fakeRes = () => {
    const res: any = { statusCode: 200, headers: {}, body: undefined, sent: undefined };
    res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (b: unknown) => { res.body = b; return res; };
    res.send = (b: unknown) => { res.sent = b; return res; };
    return res;
  };
  const reqFor = (key: string, exp?: string, sig?: string) =>
    ({ params: { '0': encodeURIComponent(key) }, query: { exp, sig } } as any);

  beforeEach(() => storage.readObject.mockClear());

  it('serves bytes for a valid signed request', async () => {
    const { exp, sig } = parse(buildSignedLocalUrl(KEY, 300, SECRET));
    const res = fakeRes();
    await controller.get(reqFor(KEY, exp, sig), res);
    expect(res.statusCode).toBe(200);
    expect(res.sent).toEqual(bytes);
    expect(storage.readObject).toHaveBeenCalledWith(KEY);
  });

  it('denies an unsigned request (the old unauthenticated read) with 404 and never touches storage', async () => {
    const res = fakeRes();
    await controller.get(reqFor(KEY), res);
    expect(res.statusCode).toBe(404);
    expect(storage.readObject).not.toHaveBeenCalled();
  });

  it('denies a forged signature', async () => {
    const exp = String(Date.now() + 60_000);
    const res = fakeRes();
    await controller.get(reqFor(KEY, exp, 'f'.repeat(64)), res);
    expect(res.statusCode).toBe(404);
    expect(storage.readObject).not.toHaveBeenCalled();
  });

  it('denies a valid token re-pointed at another document key', async () => {
    const { exp, sig } = parse(buildSignedLocalUrl(KEY, 300, SECRET));
    const res = fakeRes();
    await controller.get(reqFor('t-2/c-2/doc-2/secret.pdf', exp, sig), res);
    expect(res.statusCode).toBe(404);
    expect(storage.readObject).not.toHaveBeenCalled();
  });
});

describe('adversarial review of the signed-URL verifier (Task 3)', () => {
  const KEY = 't-1/c-1/doc-1/invoice.pdf';
  const freshExp = () => String(Date.now() + 60_000);

  it('a key with URL-special characters round-trips through encode/verify', () => {
    const key = 't-1/c-1/doc 1/инвойс (1)+%2F.pdf';
    const { key: parsedKey, exp, sig } = parse(buildSignedLocalUrl(key, 300, SECRET));
    expect(parsedKey).toBe(key);
    expect(verifyStorageSignature(key, exp, sig, SECRET)).toBe(true);
  });

  it('rejects duplicate exp/sig query params (arrays, not strings)', () => {
    const exp = freshExp();
    const sig = signStorageKey(KEY, Number(exp), SECRET);
    expect(verifyStorageSignature(KEY, [exp, exp] as unknown, sig, SECRET)).toBe(false);
    expect(verifyStorageSignature(KEY, exp, [sig, 'x'] as unknown, SECRET)).toBe(false);
  });

  it('never throws on malformed signatures (odd length, non-hex, huge)', () => {
    const exp = freshExp();
    for (const bad of ['z'.repeat(64), 'abc', '', '0'.repeat(63), '0'.repeat(65), 'g'.repeat(64), '1'.repeat(100000)]) {
      expect(() => verifyStorageSignature(KEY, exp, bad, SECRET)).not.toThrow();
      expect(verifyStorageSignature(KEY, exp, bad, SECRET)).toBe(false);
    }
  });

  it('rejects NaN, Infinity, negative, non-integer and absurd-future expiry', () => {
    const goodSig = (e: string) => signStorageKey(KEY, Number(e), SECRET);
    for (const exp of ['NaN', 'Infinity', '-1', '1e9', '12.5', 'abc', '']) {
      expect(verifyStorageSignature(KEY, exp, goodSig(exp), SECRET)).toBe(false);
    }
    const farFuture = String(Date.now() + 1000 * 24 * 60 * 60 * 1000); // ~1000 days out
    expect(verifyStorageSignature(KEY, farFuture, goodSig(farFuture), SECRET)).toBe(false);
  });

  it('changing the key OR the expiry invalidates the signature', () => {
    const { exp, sig } = parse(buildSignedLocalUrl(KEY, 300, SECRET));
    expect(verifyStorageSignature(KEY, exp, sig, SECRET)).toBe(true);
    expect(verifyStorageSignature(KEY + 'x', exp, sig, SECRET)).toBe(false);          // key tampered
    expect(verifyStorageSignature(KEY, String(Number(exp) + 1), sig, SECRET)).toBe(false); // exp tampered
  });

  it('encoded traversal and absolute/backslash keys cannot escape the storage root', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acco-adv-'));
    process.env.DOC_STORAGE_DIR = dir;
    const store = new LocalObjectStorage();
    for (const k of ['../escape.txt', 't/../../escape.txt', '/etc/passwd', '..\\..\\escape.txt', 't\\x', 'a\0b']) {
      await expect(store.readObject(k)).rejects.toThrow(/invalid storage key|traversal|denied/i);
    }
  });
});

describe('LocalObjectStorage path traversal', () => {
  let dir: string; let store: LocalObjectStorage;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acco-store-'));
    process.env.DOC_STORAGE_DIR = dir;
    store = new LocalObjectStorage();
    await store.putObject('t-1/c-1/doc-1/ok.pdf', Buffer.from('ok'), 'application/pdf');
    await fs.writeFile(path.join(dir, '..', 'acco-secret.txt'), 'TOP SECRET').catch(() => undefined);
  });

  it('reads a legitimate key', async () => {
    expect((await store.readObject('t-1/c-1/doc-1/ok.pdf')).toString()).toBe('ok');
  });

  it('refuses a traversal key that would escape the storage root', async () => {
    await expect(store.readObject('../acco-secret.txt')).rejects.toThrow(/traversal|denied/i);
    await expect(store.readObject('t-1/../../acco-secret.txt')).rejects.toThrow(/traversal|denied/i);
  });
});
