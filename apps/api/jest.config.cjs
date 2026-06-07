module.exports = {
  preset: 'ts-jest', testEnvironment: 'node',
  testMatch: ['**/test/auth/**/*.spec.ts','**/test/identity/**/*.spec.ts','**/test/masterdata/**/*.spec.ts','**/test/documents/**/*.spec.ts','**/test/extraction/**/*.spec.ts','**/test/rules/**/*.spec.ts','**/test/review/**/*.spec.ts','**/test/posting/**/*.spec.ts','**/test/vat/**/*.spec.ts','**/test/invoicing/**/*.spec.ts','**/test/reporting/**/*.spec.ts','**/test/payments/**/*.spec.ts','**/test/audit/**/*.spec.ts','**/test/periods/**/*.spec.ts','**/test/vies/**/*.spec.ts','**/test/banking/**/*.spec.ts','**/test/saft/**/*.spec.ts','**/test/health/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true, strict: false, types: ['jest','node'] } }] },
};
