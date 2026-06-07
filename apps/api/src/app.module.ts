import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { PlatformModule } from './platform/platform.module';
import { DatabaseModule } from './platform/database/database.module';
import { TenantContextMiddleware } from './platform/tenant-context/tenant-context.middleware';

import { IdentityModule } from './modules/identity';
import { TenancyModule } from './modules/tenancy';
import { MasterDataModule } from './modules/masterdata';
import { DocIntelModule } from './modules/docintel';
import { LedgerModule } from './modules/ledger';
import { TaxModule } from './modules/tax';
import { InvoicingModule } from './modules/invoicing';
import { PaymentsModule } from './modules/payments';
import { BankingModule } from './modules/banking';
import { PeriodsModule } from './modules/periods';
import { ViesModule } from './modules/vies';
import { ReportingModule } from './modules/reporting';
import { HealthModule } from './modules/health';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './modules/audit';
import { NotificationModule } from './modules/notification';
import { CmsModule } from './modules/cms';

@Module({
  imports: [
    PlatformModule,
    DatabaseModule, // @Global — PG pool (app_user), TenantContextService, DatabaseContextService
    IdentityModule, // provides PRINCIPAL_RESOLVER for the middleware
    TenancyModule,
    MasterDataModule,
    DocIntelModule,
    LedgerModule,
    TaxModule,
    InvoicingModule,
    PaymentsModule,
    BankingModule,
    PeriodsModule,
    ViesModule,
    ReportingModule,
    HealthModule,
    ThrottlerModule.forRoot([{ ttl: Number(process.env.RATE_LIMIT_TTL ?? 60000), limit: Number(process.env.RATE_LIMIT_MAX ?? 300) }]),
    AuditModule,
    NotificationModule,
    CmsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  /** Establish tenant context for EVERY route from the authenticated session. */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantContextMiddleware)
      // Pre-auth endpoints set their own context internally; reachable without a token.
      // (refresh/logout keep the middleware: they run under a still-valid access token.)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/config', method: RequestMethod.GET },
        { path: 'auth/mfa/verify', method: RequestMethod.POST },
        { path: 'auth/google', method: RequestMethod.GET },
        { path: 'auth/google/callback', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/(.*)', method: RequestMethod.GET },
        { path: 'dev-storage/(.*)', method: RequestMethod.GET },
        // Public CMS reads — the marketing site fetches content anonymously.
        { path: 'cms/posts', method: RequestMethod.GET },
        { path: 'cms/posts/(.*)', method: RequestMethod.GET },
        { path: 'cms/plans', method: RequestMethod.GET },
        { path: 'cms/content', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
