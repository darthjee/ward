import BankAccountEditController from '../../../../../../../../../assets/js/components/resources/bank/accounts/pages/controllers/BankAccountEditController.js';
import { fieldsFromAccount } from '../../../../../../../../../assets/js/components/resources/bank/common/form/controllers/accountFormFields.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const ACCOUNT = {
  id: 12,
  name: 'Main',
  bank_name: 'Bank',
  branch: null,
  account_number: '12345',
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '0.00',
  notes: null,
  archived_at: null,
};

describe('BankAccountEditController', () => {
  let deps;
  let controller;

  beforeEach(() => {
    deps = {
      context: { kind: 'organization', orgId: 5 },
      setFieldErrors: jasmine.createSpy('setFieldErrors'),
      setSubmitError: jasmine.createSpy('setSubmitError'),
      setPending: jasmine.createSpy('setPending'),
      onNotFound: jasmine.createSpy('onNotFound'),
      onConflict: jasmine.createSpy('onConflict'),
      navigate: jasmine.createSpy('navigate'),
      client: jasmine.createSpyObj('client', ['updateAccount']),
    };
    deps.client.updateAccount.and.resolveTo({ ...ACCOUNT, account_number: '•••• 2345' });
    controller = new BankAccountEditController(deps);
  });

  it('sends only the changed fields and goes to the detail page', async () => {
    await controller.handleSubmit(12, { ...fieldsFromAccount(ACCOUNT), name: 'Renamed', notes: 'hi' }, ACCOUNT);

    expect(deps.client.updateAccount).toHaveBeenCalledWith(deps.context, 12, { name: 'Renamed', notes: 'hi' });
    expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/accounts/12');
  });

  it('never sends an unchanged (locked) currency', async () => {
    await controller.handleSubmit(12, { ...fieldsFromAccount(ACCOUNT), name: 'X' }, ACCOUNT);

    expect(deps.client.updateAccount.calls.mostRecent().args[2].currency).toBeUndefined();
  });

  it('sends a changed currency', async () => {
    await controller.handleSubmit(12, { ...fieldsFromAccount(ACCOUNT), currency: 'USD' }, ACCOUNT);

    expect(deps.client.updateAccount.calls.mostRecent().args[2]).toEqual({ currency: 'USD' });
  });

  it('goes straight back when nothing changed', async () => {
    await controller.handleSubmit(12, fieldsFromAccount(ACCOUNT), ACCOUNT);

    expect(deps.client.updateAccount).not.toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/accounts/12');
  });

  it('sends only the name for an archived account', async () => {
    const archived = { ...ACCOUNT, archived_at: '2026-02-01T00:00:00.000Z' };

    await controller.handleSubmit(12, { ...fieldsFromAccount(archived), name: ' Old ' }, archived);

    expect(deps.client.updateAccount).toHaveBeenCalledWith(deps.context, 12, { name: 'Old' });
  });

  it('sends the unchanged name of an archived account (rename only)', async () => {
    const archived = { ...ACCOUNT, archived_at: '2026-02-01T00:00:00.000Z' };

    await controller.handleSubmit(12, fieldsFromAccount(archived), archived);

    expect(deps.client.updateAccount).toHaveBeenCalledWith(deps.context, 12, { name: 'Main' });
  });

  it('falls back to the account id to navigate', async () => {
    deps.client.updateAccount.and.resolveTo({});

    await controller.handleSubmit(12, { ...fieldsFromAccount(ACCOUNT), name: 'X' }, ACCOUNT);

    expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/accounts/12');
  });

  ['CURRENCY_LOCKED', 'ACCOUNT_ARCHIVED'].forEach((code) => {
    it(`shows the ${code} message and reloads`, async () => {
      deps.client.updateAccount.and.rejectWith(new ApiError(409, `${code} message`, code));

      await controller.handleSubmit(12, { ...fieldsFromAccount(ACCOUNT), currency: 'USD' }, ACCOUNT);

      expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict', code }));
      expect(deps.onConflict).toHaveBeenCalled();
      expect(deps.setPending.calls.mostRecent().args[0]).toBeFalse();
    });
  });

  it('keeps the values on ACCOUNT_NAME_TAKEN, without reloading', async () => {
    deps.client.updateAccount.and.rejectWith(new ApiError(409, 'Taken', 'ACCOUNT_NAME_TAKEN'));

    await controller.handleSubmit(12, { ...fieldsFromAccount(ACCOUNT), name: 'Other' }, ACCOUNT);

    expect(deps.setFieldErrors).toHaveBeenCalledWith({ name: 'Taken' });
    expect(deps.onConflict).not.toHaveBeenCalled();
  });

  it('shows Not-found on a 404', async () => {
    deps.client.updateAccount.and.rejectWith(new ApiError(404, 'Not Found'));

    await controller.handleSubmit(12, { ...fieldsFromAccount(ACCOUNT), name: 'X' }, ACCOUNT);

    expect(deps.onNotFound).toHaveBeenCalled();
  });

  it('validates before sending', async () => {
    await controller.handleSubmit(12, { ...fieldsFromAccount(ACCOUNT), opening_balance: '1.234' }, ACCOUNT);

    expect(deps.client.updateAccount).not.toHaveBeenCalled();
    expect(deps.setFieldErrors).toHaveBeenCalledWith({ opening_balance: jasmine.any(String) });
  });
});
