import {
  statementBalanceLabel, statementFieldsFor, validateStatementFields,
} from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/controllers/statementFields.js';

const REGULAR = { type: 'regular', currency: 'BRL' };
const DEBT = { type: 'debt', currency: 'BRL' };
const STATEMENT = { statement_date: '2026-03-31', statement_balance: '120.50' };

describe('statementFields', () => {
  describe('statementFieldsFor', () => {
    it('defaults the start date to today with an empty balance', () => {
      expect(statementFieldsFor({ statement: null, account: REGULAR, today: '2026-05-01' }))
        .toEqual({ statement_date: '2026-05-01', statement_balance: '' });
    });

    it('prefills the edit form with the statement', () => {
      expect(statementFieldsFor({ statement: STATEMENT, account: REGULAR, today: '2026-05-01' }))
        .toEqual({ statement_date: '2026-03-31', statement_balance: '120.50' });
    });

    it('negates the balance of a debt on edit', () => {
      const fields = statementFieldsFor({
        statement: { ...STATEMENT, statement_balance: '-300.00' }, account: DEBT, today: '2026-05-01',
      });

      expect(fields.statement_balance).toBe('300.00');
    });

    it('keeps an empty balance empty on a debt start', () => {
      expect(statementFieldsFor({ statement: null, account: DEBT, today: '2026-05-01' }).statement_balance).toBe('');
    });
  });

  describe('validateStatementFields', () => {
    it('builds exactly the two keys', () => {
      expect(validateStatementFields({ ...STATEMENT, extra: 'x' }, REGULAR))
        .toEqual({ body: { statement_date: '2026-03-31', statement_balance: '120.50' } });
    });

    it('accepts a negative balance', () => {
      expect(validateStatementFields({ ...STATEMENT, statement_balance: '-5,5' }, REGULAR).body.statement_balance)
        .toBe('-5.5');
    });

    it('accepts a zero balance', () => {
      expect(validateStatementFields({ ...STATEMENT, statement_balance: '0' }, REGULAR).body.statement_balance)
        .toBe('0');
    });

    it('rejects an invalid balance', () => {
      expect(validateStatementFields({ ...STATEMENT, statement_balance: 'abc' }, REGULAR).fieldErrors.statement_balance)
        .toBeDefined();
    });

    it('rejects an empty balance', () => {
      expect(validateStatementFields({ ...STATEMENT, statement_balance: '' }, REGULAR).fieldErrors.statement_balance)
        .toBeDefined();
    });

    it('requires a date', () => {
      const result = validateStatementFields({ ...STATEMENT, statement_date: '' }, REGULAR);

      expect(result.fieldErrors.statement_date).toBeDefined();
      expect(result.body).toBeUndefined();
    });

    it('does not validate the date against today', () => {
      expect(validateStatementFields({ ...STATEMENT, statement_date: '2999-01-01' }, REGULAR).body).toBeDefined();
    });

    it('negates a debt balance back on submit', () => {
      expect(validateStatementFields({ ...STATEMENT, statement_balance: '300.00' }, DEBT).body.statement_balance)
        .toBe('-300.00');
    });

    it('keeps a zero debt balance unsigned', () => {
      expect(validateStatementFields({ ...STATEMENT, statement_balance: '0' }, DEBT).body.statement_balance).toBe('0');
    });
  });

  describe('statementBalanceLabel', () => {
    it('is Amount owed for a debt', () => {
      expect(statementBalanceLabel(DEBT)).toBe('Amount owed');
    });

    it('is Statement balance otherwise', () => {
      expect(statementBalanceLabel(REGULAR)).toBe('Statement balance');
    });
  });
});
