import type { AccountRef } from './account-refs.js';
import type { BillSource, OccurrenceKind } from './bill-schedule.js';
import { formatAmount } from './currency.js';
import type { Account } from './entities/account.entity.js';
import type { BillPayment, BillPaymentStatus } from './entities/bill-payment.entity.js';
import type { Bill } from './entities/bill.entity.js';
import type { Occurrence } from './occurrence-generator.js';

/** An occurrence's state: from its payment row, otherwise from its effective date. */
export type OccurrenceStatus = 'open' | 'overdue' | BillPaymentStatus;

/** A recorded payment / skip, as shown on an occurrence or a bill (snake_case). */
export interface PaymentResponse {
  id: number;
  status: BillPaymentStatus;
  paid_on: string | null;
  amount: string | null;
  /** `null` for a skip, or once the paying account was deleted (`ON DELETE SET NULL`). */
  paying_account: AccountRef | null;
}

/** The occurrence shape of `docs/agents/modules/bank/bills.md` (never an owner field). */
export interface OccurrenceResponse {
  kind: OccurrenceKind;
  source_account: AccountRef & { type: string };
  bill: { id: number; description: string } | null;
  nominal_date: string;
  effective_date: string;
  expected_amount: string | null;
  currency: string;
  status: OccurrenceStatus;
  payment: PaymentResponse | null;
  default_paying_account: AccountRef | null;
}

/** A built occurrence: its response plus the raw amounts the totals need. */
export interface OccurrenceView {
  response: OccurrenceResponse;
  expected: bigint | null;
  paid: bigint | null;
}

/** Everything needed to build one occurrence. */
export interface OccurrenceInput {
  kind: OccurrenceKind;
  /** The source account (a one-off's provider). */
  account: Account;
  bill: Bill | null;
  nominal: string;
  effective: string;
  expected: bigint | null;
  defaultPayingAccount: AccountRef | null;
  payment: BillPayment | undefined;
}

/**
 * @param {BillSource} source - A debt / provider-expense source.
 * @param {Occurrence} occurrence - One of its generated occurrences.
 * @param {BillPayment | undefined} payment - Its payment row, if any.
 * @returns {OccurrenceInput} The derived occurrence's input.
 */
export function derivedInput(source: BillSource, occurrence: Occurrence, payment: BillPayment | undefined): OccurrenceInput {
  return {
    kind: source.kind,
    account: source.account,
    bill: null,
    nominal: occurrence.nominal,
    effective: occurrence.effective,
    expected: source.expected,
    defaultPayingAccount: source.defaultPayingAccount,
    payment,
  };
}

/**
 * One-off bills have no weekend shift: nominal and effective dates are both `dueDate`.
 * @param {Bill} bill - The one-off bill.
 * @param {Account} provider - Its provider-expense account.
 * @param {BillPayment | undefined} payment - Its payment row, if any.
 * @param {Map<number, AccountRef>} refs - Account refs (for the bill's paying account).
 * @returns {OccurrenceInput} The one-off occurrence's input.
 */
export function billInput(
  bill: Bill,
  provider: Account,
  payment: BillPayment | undefined,
  refs: Map<number, AccountRef>,
): OccurrenceInput {
  return {
    kind: 'bill',
    account: provider,
    bill,
    nominal: bill.dueDate,
    effective: bill.dueDate,
    expected: bill.amount,
    defaultPayingAccount: refOf(bill.payingAccountId, refs),
    payment,
  };
}

/**
 * @param {BillPayment} payment - A payment row.
 * @param {string} currency - The source account's currency.
 * @param {Map<number, AccountRef>} refs - Account refs (for the paying account).
 * @returns {PaymentResponse} Its public view.
 */
export function serializePayment(payment: BillPayment, currency: string, refs: Map<number, AccountRef>): PaymentResponse {
  return {
    id: payment.id,
    status: payment.status,
    paid_on: payment.paidOn,
    amount: payment.amount === null ? null : formatAmount(payment.amount, currency),
    paying_account: refOf(payment.payingAccountId, refs),
  };
}

/**
 * @param {OccurrenceInput} input - The occurrence's input.
 * @param {Map<number, AccountRef>} refs - Account refs (for the payment's paying account).
 * @param {string} today - Today (UTC), `YYYY-MM-DD`.
 * @returns {OccurrenceView} The occurrence and its raw amounts.
 */
export function buildOccurrence(input: OccurrenceInput, refs: Map<number, AccountRef>, today: string): OccurrenceView {
  const { account, payment } = input;
  const status: OccurrenceStatus = payment ? payment.status : input.effective < today ? 'overdue' : 'open';

  return {
    response: {
      kind: input.kind,
      source_account: { id: account.id, name: account.name, type: account.type },
      bill: input.bill ? { id: input.bill.id, description: input.bill.description } : null,
      nominal_date: input.nominal,
      effective_date: input.effective,
      expected_amount: input.expected === null ? null : formatAmount(input.expected, account.currency),
      currency: account.currency,
      status,
      payment: payment ? serializePayment(payment, account.currency, refs) : null,
      default_paying_account: input.defaultPayingAccount,
    },
    expected: input.expected,
    paid: payment?.status === 'paid' ? payment.amount : null,
  };
}

/**
 * Calendar order: `effective_date` ascending, then `kind`, then source account
 * id, then bill id.
 * @param {OccurrenceView} a - One occurrence.
 * @param {OccurrenceView} b - Another occurrence.
 * @returns {number} The sort comparison.
 */
export function compareOccurrences(a: OccurrenceView, b: OccurrenceView): number {
  const left = a.response;
  const right = b.response;

  if (left.effective_date !== right.effective_date) {
    return left.effective_date < right.effective_date ? -1 : 1;
  }

  if (left.kind !== right.kind) {
    return left.kind < right.kind ? -1 : 1;
  }

  return left.source_account.id - right.source_account.id || (left.bill?.id ?? 0) - (right.bill?.id ?? 0);
}

/**
 * @param {number | null} id - An account id.
 * @param {Map<number, AccountRef>} refs - Loaded refs.
 * @returns {AccountRef | null} The ref, or `null` when unset or gone.
 */
function refOf(id: number | null, refs: Map<number, AccountRef>): AccountRef | null {
  return id === null ? null : refs.get(id) ?? null;
}
