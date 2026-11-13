import {
  buildBillFormHandlers,
  readBillRoute,
} from '../../../../../../../../../assets/js/components/resources/bank/bills/pages/hooks/useBillForm.js';

const PROVIDERS = [{ id: 3, name: 'Plumber', currency: 'BRL' }, { id: 4, name: 'Host', currency: 'USD' }];
const ACCOUNTS = [{ id: 1, name: 'Main', currency: 'BRL' }];

describe('useBillForm', () => {
  describe('readBillRoute', () => {
    it('reads the bill id on the edit page, in both contexts', () => {
      expect(readBillRoute(true, '#/bank/bills/9/edit')).toEqual({ billId: '9', fields: null });
      expect(readBillRoute(true, '#/orgs/5/bank/bills/12/edit')).toEqual({ billId: '12', fields: null });
    });

    it('pre-selects the provider from ?provider= on the new page', () => {
      expect(readBillRoute(false, '#/bank/bills/new?provider=3')).toEqual({
        billId: null, fields: jasmine.objectContaining({ provider_account_id: '3', paying_account_id: '' }),
      });
    });

    it('starts without a provider otherwise', () => {
      expect(readBillRoute(false, '#/orgs/5/bank/bills/new').fields.provider_account_id).toBe('');
    });

    it('defaults to the window hash', () => {
      expect(readBillRoute(false).billId).toBeNull();
    });
  });

  describe('buildBillFormHandlers', () => {
    let deps;
    let fields;

    beforeEach(() => {
      fields = {
        provider_account_id: '3', paying_account_id: '1', due_date: '2026-03-10', amount: '1', description: 'x', notes: '',
      };
      deps = {
        controller: {
          create: jasmine.createSpy('create').and.resolveTo(),
          update: jasmine.createSpy('update').and.resolveTo(),
          destroy: jasmine.createSpy('destroy').and.resolveTo(),
        },
        fields,
        setFields: jasmine.createSpy('setFields').and.callFake((update) => {
          fields = update(fields);
        }),
        lists: { providers: PROVIDERS, accounts: ACCOUNTS },
        bill: null,
        edit: false,
        currency: 'BRL',
        submitError: null,
        setSubmitError: jasmine.createSpy('setSubmitError'),
        setConfirming: jasmine.createSpy('setConfirming'),
        reload: jasmine.createSpy('reload'),
      };
    });

    const event = () => ({ preventDefault: jasmine.createSpy('preventDefault') });

    it('refreshes the paying account when the provider changes', () => {
      buildBillFormHandlers(deps).onFieldChange({ target: { name: 'provider_account_id', value: '4' } });

      expect(fields).toEqual(jasmine.objectContaining({ provider_account_id: '4', paying_account_id: '' }));
    });

    it('creates on the new page', () => {
      const submit = event();

      buildBillFormHandlers(deps).onSubmit(submit);

      expect(submit.preventDefault).toHaveBeenCalled();
      expect(deps.controller.create).toHaveBeenCalledWith(deps.fields, 'BRL');
    });

    it('updates on the edit page once the bill is loaded', () => {
      const bill = { id: 9 };

      buildBillFormHandlers({ ...deps, edit: true }).onSubmit(event());

      expect(deps.controller.update).not.toHaveBeenCalled();

      buildBillFormHandlers({ ...deps, edit: true, bill }).onSubmit(event());

      expect(deps.controller.update).toHaveBeenCalledWith(bill, deps.fields, 'BRL');
      expect(deps.controller.create).not.toHaveBeenCalled();
    });

    it('asks for confirmation before deleting', () => {
      const bill = { id: 9 };
      const handlers = buildBillFormHandlers({ ...deps, edit: true, bill });

      handlers.onDelete();

      expect(deps.setConfirming).toHaveBeenCalledWith(true);
      expect(deps.controller.destroy).not.toHaveBeenCalled();

      handlers.onConfirmDelete();

      expect(deps.controller.destroy).toHaveBeenCalledWith(bill);

      handlers.onCancelDelete();

      expect(deps.setConfirming).toHaveBeenCalledWith(false);
    });

    it('ignores a delete confirm without a bill', () => {
      expect(buildBillFormHandlers(deps).onConfirmDelete()).toBeUndefined();
    });

    it('retries through the error, dismisses it and reloads', () => {
      const retry = jasmine.createSpy('retry');
      const handlers = buildBillFormHandlers({ ...deps, submitError: { retry } });

      handlers.onRetry();
      handlers.onDismiss();
      handlers.onRetryLoad();

      expect(retry).toHaveBeenCalled();
      expect(deps.setSubmitError).toHaveBeenCalledWith(null);
      expect(deps.reload).toHaveBeenCalled();
      expect(() => buildBillFormHandlers(deps).onRetry()).not.toThrow();
    });
  });
});
