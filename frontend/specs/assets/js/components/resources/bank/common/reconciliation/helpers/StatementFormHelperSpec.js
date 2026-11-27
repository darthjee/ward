import StatementFormHelper from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/helpers/StatementFormHelper.jsx';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';
import { classifyReconciliationError } from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/controllers/reconciliationErrors.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const HANDLERS = {
  onFieldChange: () => undefined,
  onSubmitStatement: () => undefined,
  onCloseForm: () => undefined,
  onDismissError: () => undefined,
};

function build(overrides = {}, account = { type: 'regular', currency: 'BRL' }) {
  return {
    account,
    today: '2026-05-01',
    reconcile: {
      formKind: 'start',
      fields: { statement_date: '2026-05-01', statement_balance: '' },
      fieldErrors: {},
      pending: false,
      error: null,
      ...overrides,
    },
  };
}

function render(state) {
  return renderedOutput(StatementFormHelper.render(state, HANDLERS));
}

describe('StatementFormHelper', () => {
  it('uses today as the date max (a UX default only)', () => {
    expect(render(build()).containsAttribute('max', '2026-05-01')).toBeTrue();
  });

  it('does not set a min on the date', () => {
    expect(render(build()).contains(' min=')).toBeFalse();
  });

  it('labels the balance Statement balance', () => {
    expect(render(build()).containsElement('label', 'Statement balance')).toBeTrue();
  });

  it('labels the balance Amount owed on a debt', () => {
    expect(render(build({}, { type: 'debt', currency: 'BRL' })).containsElement('label', 'Amount owed')).toBeTrue();
  });

  it('shows Start reconciliation on a start form', () => {
    expect(render(build()).contains('Start reconciliation')).toBeTrue();
  });

  it('shows Save statement on an edit form', () => {
    expect(render(build({ formKind: 'edit' })).contains('Save statement')).toBeTrue();
  });

  it('prefills the edit form', () => {
    const page = render(build({
      formKind: 'edit', fields: { statement_date: '2026-03-31', statement_balance: '120.50' },
    }));

    expect(page.containsAttribute('value', '2026-03-31')).toBeTrue();
    expect(page.containsAttribute('value', '120.50')).toBeTrue();
  });

  it('prefixes the ids with statement-', () => {
    expect(render(build()).containsAttribute('id', 'statement-statement_date')).toBeTrue();
  });

  it('renders a field error', () => {
    expect(render(build({ fieldErrors: { statement_balance: 'Bad amount' } })).contains('Bad amount')).toBeTrue();
  });

  it('renders the request error', () => {
    const error = classifyReconciliationError(new ApiError(409, 'x', 'RECONCILIATION_OPEN'));

    expect(render(build({ error })).contains('This account already has an open statement.')).toBeTrue();
  });

  it('has a Cancel button', () => {
    expect(render(build()).containsElement('button', 'Cancel')).toBeTrue();
  });

  it('disables submit while pending', () => {
    expect(render(build({ pending: true })).contains('disabled')).toBeTrue();
  });
});
