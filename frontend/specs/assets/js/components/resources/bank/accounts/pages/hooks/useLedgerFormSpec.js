import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useLedgerForm, {
  initialLedgerForm,
  ledgerFormActions,
} from '../../../../../../../../../assets/js/components/resources/bank/accounts/pages/hooks/useLedgerForm.js';

describe('useLedgerForm', () => {
  let form;
  let actions;

  beforeEach(() => {
    form = initialLedgerForm('2026-05-10');
    actions = ledgerFormActions((next) => {
      form = typeof next === 'function' ? next(form) : next;
    });
  });

  it('starts as a new, clean, idle form with Notes closed', () => {
    expect(form).toEqual({
      editing: null,
      values: {
        date: '2026-05-10', direction: 'out', amount: '', description: '', notes: '',
      },
      baseline: form.values,
      notesOpen: false,
      fieldErrors: {},
      error: null,
      pending: false,
    });
  });

  it('merges a patch', () => {
    actions.update({ pending: true });

    expect(form.pending).toBeTrue();
  });

  it('changes a value', () => {
    actions.changeValue('amount', '3');

    expect(form.values.amount).toBe('3');
    expect(form.baseline.amount).toBe('');
  });

  it('toggles the notes', () => {
    actions.toggleNotes();

    expect(form.notesOpen).toBeTrue();
  });

  it('loads a transaction, opening Notes when present', () => {
    const transaction = {
      id: 3, date: '2026-05-01', amount: '-2.00', description: 'Coffee', notes: 'beans',
    };

    actions.startEdit(transaction);

    expect(form.editing).toBe(transaction);
    expect(form.values).toEqual(jasmine.objectContaining({ direction: 'out', amount: '2.00' }));
    expect(form.baseline).toBe(form.values);
    expect(form.notesOpen).toBeTrue();
  });

  it('keeps Notes closed for a transaction without notes', () => {
    actions.startEdit({
      id: 3, date: '2026-05-01', amount: '2.00', description: 'Pay', notes: null,
    });

    expect(form.notesOpen).toBeFalse();
    expect(form.values.direction).toBe('in');
  });

  it('resets', () => {
    actions.update({ pending: true });
    actions.reset();

    expect(form.pending).toBeFalse();
  });

  it('exposes the initial form from the hook', () => {
    let result;
    const Probe = () => {
      result = useLedgerForm();
      return null;
    };

    renderToStaticMarkup(React.createElement(Probe));

    expect(result.form.editing).toBeNull();
    expect(result.actions.reset).toEqual(jasmine.any(Function));
  });
});
