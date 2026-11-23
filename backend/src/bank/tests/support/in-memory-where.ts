import { QueryFailedError } from 'typeorm';

// The `where` matching and the MySQL error shape shared by the in-memory bank repositories.

export type Where = Record<string, unknown>;

export function mysqlError(code: string): QueryFailedError {
  return new QueryFailedError('in-memory', [], Object.assign(new Error(code), { code }));
}

type Operator = { type: string; value: unknown };
const isSet = (value: unknown): boolean => value !== null && value !== undefined;
const OPERATORS: Record<string, (actual: never, value: never) => boolean> = {
  isNull: (actual) => !isSet(actual),
  in: (actual, value: unknown[]) => value.includes(actual),
  between: (actual, [low, high]: [never, never]) => isSet(actual) && actual >= low && actual <= high,
  lessThan: (actual, value) => isSet(actual) && actual < value,
};

export function matches(row: object, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as Record<string, unknown>)[key];

    if (expected && typeof expected === 'object' && 'type' in expected) {
      const operator = expected as Operator;
      return OPERATORS[operator.type]?.(actual as never, operator.value as never) ?? false;
    }

    return actual === expected;
  });
}
