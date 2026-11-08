import { CanActivate, ExecutionContext, Global, INestApplication, Injectable, Module, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { Request } from 'express';
import request from 'supertest';
import { createInMemoryBankRepos, type InMemoryBankRepos } from './in-memory-bank-repos.js';
import { CachePolicyInterceptor } from '../../../core/cache-policy.interceptor.js';
import { HttpExceptionFilter } from '../../../core/http-exception.filter.js';
import { LoggingModule } from '../../../core/logging.module.js';
import { ORGANIZATION_MEMBERSHIP_LOOKUP, type OrganizationMembershipLookup } from '../../../core/organization-membership-lookup.js';
import { OwnerContextGuard } from '../../../core/owner-context.guard.js';
import { BankRoutesModule } from '../../bank-routes.module.js';
import { Account } from '../../entities/account.entity.js';
import { DebtDetails } from '../../entities/debt-details.entity.js';
import { InvestmentDetails } from '../../entities/investment-details.entity.js';
import { Transaction } from '../../entities/transaction.entity.js';

// The bank e2e harness. A real Nest application (`NestFactory.create`, not
// `Test.createTestingModule`), because `LazyModuleLoader` needs one. There is no database: a
// `@Global()` module provides a fake `DataSource` whose `getRepository()` returns in-memory
// repositories, so the repositories created by both the resident `BankRoutesModule` and the lazy
// `BankModule` (`forFeature`) resolve to the same fakes. Identities come from a stub user guard
// (`x-test-user`, `x-test-admin`) standing in for `JwtGuard`, and memberships from a fake
// `ORGANIZATION_MEMBERSHIP_LOOKUP`; the real `OwnerContextGuard`, `CachePolicyInterceptor`,
// `HttpExceptionFilter` and global `ValidationPipe` are wired as in `AppModule` / `main.ts`.
//
// Users: 7 (member of organization 3), 8 (member of organization 4), 9 (global admin, member of
// nothing). Spec files swap the SQL query classes for in-memory ones with `jest.mock`.

export const ALICE = '7';
export const BOB = '8';
export const ADMIN = '9';
export const ALICE_ORG = 3;
export const BOB_ORG = 4;

const MEMBERSHIPS = new Set([`${ALICE}:${ALICE_ORG}`, `${BOB}:${BOB_ORG}`]);

class FakeMembershipLookup implements OrganizationMembershipLookup {
  async isMember(userId: number, orgId: number): Promise<boolean> {
    return MEMBERSHIPS.has(`${userId}:${orgId}`);
  }
}

@Injectable()
class StubUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const sub = req.headers['x-test-user'];

    if (typeof sub === 'string') {
      req.user = { sub: Number(sub), sid: 'sid', username: `user-${sub}`, isAdmin: req.headers['x-test-admin'] === 'true' };
    }

    return true;
  }
}

export interface BankTestApp {
  app: INestApplication;
  repos: InMemoryBankRepos;
}

function fakeDataSource(repos: InMemoryBankRepos) {
  const repositoryFor = (entity: unknown): unknown => {
    if (entity === Account) return { ...repos.accounts, manager };
    if (entity === Transaction) return { ...repos.transactions, manager };
    if (entity === DebtDetails) return repos.debtDetails;
    if (entity === InvestmentDetails) return repos.investmentDetails;
    throw new Error(`no in-memory repository for ${String(entity)}`);
  };
  const manager = {
    getRepository: repositoryFor,
    transaction: async <R>(work: (m: unknown) => Promise<R>): Promise<R> => work(manager),
  };

  return { entityMetadatas: [], options: { type: 'mysql' }, getRepository: repositoryFor, manager };
}

/**
 * Builds the bank e2e app.
 * @param {Record<string, string>} config - Config values (e.g. `BANK_DEFAULT_CURRENCY`).
 * @returns {Promise<BankTestApp>} The initialised app and its in-memory repositories.
 */
export async function buildBankTestApp(config: Record<string, string> = {}): Promise<BankTestApp> {
  const repos = createInMemoryBankRepos();
  const values: Record<string, string> = { WARD_LOG_LEVEL: 'error', ...config };

  @Global()
  @Module({
    providers: [
      { provide: getDataSourceToken(), useValue: fakeDataSource(repos) },
      { provide: ConfigService, useValue: { get: (key: string, fallback?: unknown) => values[key] ?? fallback } },
    ],
    exports: [getDataSourceToken(), ConfigService],
  })
  class FakeInfrastructureModule {}

  @Module({
    imports: [FakeInfrastructureModule, LoggingModule, BankRoutesModule],
    providers: [
      { provide: ORGANIZATION_MEMBERSHIP_LOOKUP, useValue: new FakeMembershipLookup() },
      { provide: APP_GUARD, useClass: StubUserGuard },
      { provide: APP_GUARD, useClass: OwnerContextGuard },
      { provide: APP_INTERCEPTOR, useClass: CachePolicyInterceptor },
      { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ],
  })
  class BankTestHostModule {}

  const app = await NestFactory.create(BankTestHostModule, { logger: false, abortOnError: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return { app, repos };
}

type Method = 'get' | 'post' | 'patch' | 'delete';

/**
 * Sends a request as a user.
 * @param {INestApplication} app - The app.
 * @param {Method} method - The HTTP method.
 * @param {string} path - The path (e.g. `/bank/accounts.json`).
 * @param {string} user - The `x-test-user` id.
 * @param {object} [body] - The JSON body.
 * @param {boolean} [admin] - Whether the user is a global admin.
 * @returns {request.Test} The supertest request.
 */
export function send(
  app: INestApplication,
  method: Method,
  path: string,
  user: string,
  body?: object,
  admin = false,
): request.Test {
  const req = request(app.getHttpServer())[method](path).set('x-test-user', user).set('x-test-admin', String(admin));

  return body === undefined ? req : req.send(body);
}

/**
 * @param {number | null} orgId - The organization, or `null` for the personal prefix.
 * @returns {string} The bank base path (`/bank` or `/orgs/:orgId/bank`).
 */
export function base(orgId: number | null): string {
  return orgId === null ? '/bank' : `/orgs/${orgId}/bank`;
}

/**
 * Creates an account through the API.
 * @param {INestApplication} app - The app.
 * @param {string} user - The acting user.
 * @param {number | null} orgId - The organization, or `null` for Personal.
 * @param {object} fields - Extra body fields.
 * @returns {Promise<Record<string, unknown>>} The created account.
 */
export async function createAccount(
  app: INestApplication,
  user: string,
  orgId: number | null,
  fields: object = {},
): Promise<Record<string, unknown> & { id: number }> {
  const response = await send(app, 'post', `${base(orgId)}/accounts.json`, user, {
    name: `Account ${Math.random().toString(36).slice(2)}`,
    ...fields,
  }).expect(201);

  return response.body;
}

/** The uniform 404 body (apart from the timestamp). */
export const NOT_FOUND_BODY = {
  error: { code: 'NOT_FOUND', message: 'Not Found' },
  statusCode: 404,
  timestamp: expect.any(String),
};

/**
 * @param {request.Response} response - A response.
 * @returns {object} The body without its timestamp, for byte-identical comparisons.
 */
export function withoutTimestamp(response: request.Response): object {
  const rest = { ...(response.body as Record<string, unknown>) };
  delete rest.timestamp;

  return rest;
}
