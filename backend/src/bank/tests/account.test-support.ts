import type { OwnerContext } from '../../core/owner-context.js';
import { Account } from '../entities/account.entity.js';

export const PERSONAL: OwnerContext = { kind: 'user', userId: 7 };
export const ORGANIZATION: OwnerContext = { kind: 'organization', organizationId: 3 };

export function buildAccount(overrides: Partial<Account> = {}): Account {
  return Object.assign(new Account(), {
    id: 1,
    userId: 7,
    organizationId: null,
    type: 'regular',
    name: 'Nubank',
    bankName: 'Nu',
    branch: '0001',
    accountNumber: '12345-6',
    currency: 'BRL',
    openingDate: '2026-01-01',
    openingBalance: 100000n,
    archivedAt: null,
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  });
}
