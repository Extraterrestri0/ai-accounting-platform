#!/usr/bin/env node
/* eslint-disable */
// =====================================================================
// OCR provider readiness check (production-OCR validation, STEP 4).
// Verifies the configured OCR provider is the real Document-AI path (Azure Document
// Intelligence, EU) and NOT the dev fallback — so the validation runner can refuse to
// produce a result that isn't real. Run with env loaded:
//   npm run ocr:check         (== node -r ./scripts/load-env.js scripts/ocr-provider-check.js)
// Exit 0 = ready (real Azure provider); exit 1 = not ready (dev fallback / misconfigured).
// =====================================================================
const path = require('path');

// Mirror of EU_REGIONS in src/modules/docintel/infrastructure/azure-docintel-provider.ts
// (source of truth there; kept in sync deliberately — this is a check-only mirror).
const EU_REGIONS = new Set([
  'westeurope', 'northeurope', 'francecentral', 'germanywestcentral',
  'swedencentral', 'switzerlandnorth', 'norwayeast', 'polandcentral',
  'italynorth', 'spaincentral',
]);

function loadFactory() {
  // Prefer compiled dist (run `npm run build` first).
  const p = path.resolve(__dirname, '../dist/modules/docintel/infrastructure/ocr-provider.factory.js');
  return require(p).createOcrProvider;
}

/**
 * Inspect env + the provider factory and decide whether the real Document-AI path is
 * active. Pure: returns a structured verdict; does NOT call the OCR network.
 */
function checkProviderReadiness(env = process.env) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail ?? '' });

  const provider = (env.OCR_PROVIDER ?? '').toLowerCase();
  const endpoint = env.AZURE_DOCINTEL_ENDPOINT ?? '';
  const key = env.AZURE_DOCINTEL_KEY ?? '';
  const region = (env.AZURE_DOCINTEL_REGION ?? '').toLowerCase().replace(/\s+/g, '');
  const allowNonEu = env.OCR_ALLOW_NON_EU === 'true';

  add('OCR_REAL is not false', env.OCR_REAL !== 'false', `OCR_REAL=${env.OCR_REAL ?? '<unset>'}`);
  add('OCR_PROVIDER=azure', provider === 'azure', `OCR_PROVIDER=${env.OCR_PROVIDER ?? '<unset>'}`);
  add('Azure endpoint set', /^https:\/\/.+/.test(endpoint), endpoint ? endpoint : '<unset>');
  add('Azure key set', key.length > 0, key ? '<set>' : '<unset>');
  add('Azure region set', region.length > 0, region || '<unset>');
  add('Azure region is EU', allowNonEu || EU_REGIONS.has(region), allowNonEu ? 'OCR_ALLOW_NON_EU=true (override)' : (region || '<unset>'));

  // Factory must construct AzureDocIntelligenceProvider without throwing.
  let providerClass = null, factoryError = null;
  try {
    const inst = loadFactory()(env);
    providerClass = inst.constructor.name;
  } catch (e) {
    factoryError = (e && e.message) || String(e);
  }
  add('Factory returns AzureDocIntelligenceProvider', providerClass === 'AzureDocIntelligenceProvider',
    factoryError ? `factory threw: ${factoryError}` : `provider=${providerClass ?? 'null'}`);

  const devFallback = providerClass === 'DefaultOcrProvider' || providerClass === 'StubOcrProvider'
    || (provider !== 'azure' && provider !== 'http');
  // A configured generic EU HTTP vendor counts as "real OCR" too, but this check targets Azure.
  add('Dev fallback NOT active', !devFallback,
    devFallback ? `active fallback: ${providerClass || provider || 'default'}` : 'real provider');

  const ready = checks.every((c) => c.ok);
  return { ready, providerClass, factoryError, devFallback, checks };
}

function printVerdict(v) {
  console.log('\n=== OCR provider readiness ===');
  for (const c of v.checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  console.log('');
  if (v.ready) console.log('✅ READY — real Azure Document Intelligence provider is active.');
  else console.log('❌ NOT READY — production OCR provider is not configured (see failed checks above).');
  console.log('');
}

module.exports = { checkProviderReadiness, EU_REGIONS };

if (require.main === module) {
  const v = checkProviderReadiness(process.env);
  printVerdict(v);
  process.exit(v.ready ? 0 : 1);
}
