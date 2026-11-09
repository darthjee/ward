import type { BankModuleLoader } from '../bank-module.loader.js';

export function fakeLoader() {
  const accounts = {
    list: jest.fn(async () => []),
    create: jest.fn(async () => ({ id: 1 })),
    find: jest.fn(async () => ({ id: 1 })),
    update: jest.fn(async () => ({ id: 1 })),
    delete: jest.fn(async () => undefined),
    archive: jest.fn(async () => ({ id: 1 })),
    unarchive: jest.fn(async () => ({ id: 1 })),
  };
  const transactions = {
    ledger: jest.fn(async () => ({ transactions: [] })),
    create: jest.fn(async () => ({ id: 2 })),
    update: jest.fn(async () => ({ id: 2 })),
    delete: jest.fn(async () => undefined),
  };
  const accountant = {
    preview: jest.fn(async () => ({ charges: [] })),
    markSent: jest.fn(async () => ({ charges: [] })),
    markUnsent: jest.fn(async () => ({ charges: [] })),
  };
  const services = jest.fn(async () => ({ accounts, accountant, transactions }));

  return { loader: { services } as unknown as BankModuleLoader, services, accounts, accountant, transactions };
}
