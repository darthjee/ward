import type { QueryRunner } from 'typeorm';

const METHODS = [
  'addColumn',
  'addColumns',
  'changeColumn',
  'createForeignKey',
  'createIndex',
  'createTable',
  'dropColumn',
  'dropForeignKey',
  'dropIndex',
  'dropTable',
  'query',
] as const;

const STATE_METHODS = ['hasTable', 'hasColumn', 'getTable'] as const;

export type FakeQueryRunnerMocks = Record<(typeof METHODS)[number] | (typeof STATE_METHODS)[number], jest.Mock> & {
  calls: string[];
};

export function fakeQueryRunner(): FakeQueryRunnerMocks {
  const calls: string[] = [];
  const runner = { calls } as FakeQueryRunnerMocks;
  for (const method of METHODS) {
    runner[method] = jest.fn(async () => {
      calls.push(method);
    });
  }
  runner.hasTable = jest.fn(async () => true);
  runner.hasColumn = jest.fn(async () => true);
  runner.getTable = jest.fn(async () => undefined);
  return runner;
}

export function asQueryRunner(runner: FakeQueryRunnerMocks): QueryRunner {
  return runner as unknown as QueryRunner;
}
