import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import useUpdateValueForm from '../../../../../../../../../assets/js/components/resources/bank/investments/common/hooks/useUpdateValueForm.js';
import BankClient from '../../../../../../../../../assets/js/client/BankClient.js';
import { initialLedgerForm } from '../../../../../../../../../assets/js/components/resources/bank/common/detail/hooks/useLedgerForm.js';
import { flushMicrotasks } from '../../../../../../../../support/flushMicrotasks.js';

const ACCOUNT = { id: 3, balance: '1000.00', currency: 'BRL' };

function probe(account = ACCOUNT, reload = () => undefined, actions = { reset: () => undefined }) {
  let result;
  const Probe = () => {
    result = useUpdateValueForm({
      context: { kind: 'personal' }, accountId: '3', account, reload, ledgerForm: { form: initialLedgerForm(), actions },
    });
    return null;
  };

  renderToStaticMarkup(React.createElement(Probe));

  return result;
}

const fakeEvent = () => ({ preventDefault: jasmine.createSpy('preventDefault') });

describe('useUpdateValueForm', () => {
  it('starts with an empty value dated today', () => {
    const { state } = probe();

    expect(state.values.value).toBe('');
    expect(state.values.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.notice).toBeNull();
  });

  it('wires the change and dismiss handlers', () => {
    const { handlers } = probe();

    expect(() => handlers.onUpdateValueChange({ target: { name: 'value', value: '12' } })).not.toThrow();
    expect(() => handlers.onUpdateValueDismiss()).not.toThrow();
  });

  it('does nothing on submit before the account is loaded', () => {
    const event = fakeEvent();

    expect(probe(null).handlers.onUpdateValueSubmit(event)).toBeUndefined();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('validates the (empty) current value through the controller, posting nothing', async () => {
    spyOn(BankClient, 'createTransaction').and.resolveTo({ id: 1 });
    const event = fakeEvent();

    await probe().handlers.onUpdateValueSubmit(event);
    await flushMicrotasks();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(BankClient.createTransaction).not.toHaveBeenCalled();
  });
});
