import AccountFormController from '../../../../../../../../../assets/js/components/resources/bank/common/form/controllers/AccountFormController.js';
import { fieldsFromAccount } from '../../../../../../../../../assets/js/components/resources/bank/common/form/controllers/accountFormFields.js';

const ACCOUNT = {
  id: 7,
  name: 'Car loan',
  bank_name: 'Bank',
  branch: null,
  account_number: null,
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '-10000.00',
  notes: null,
  archived_at: null,
  extra: 'a',
};

class ExtraController extends AccountFormController {
  validate(fields, options) {
    const validation = super.validate(fields, options);

    return validation.body && !options?.nameOnly
      ? { ...validation, body: { ...validation.body, extra: fields.extra } }
      : validation;
  }

  fieldsFrom(account) {
    return { ...super.fieldsFrom(account), extra: account.extra };
  }

  changes(body, original) {
    return { ...super.changes(body, original), touched: true };
  }

  sendCreate(body) {
    return this.client.createAccount(this.context, { ...body, type: 'debt' });
  }
}

describe('AccountFormController', () => {
  let deps;

  function build(Klass = AccountFormController, overrides = {}) {
    return new Klass({ ...deps, ...overrides });
  }

  beforeEach(() => {
    deps = {
      context: { kind: 'personal' },
      setFieldErrors: jasmine.createSpy('setFieldErrors'),
      setSubmitError: jasmine.createSpy('setSubmitError'),
      setPending: jasmine.createSpy('setPending'),
      onNotFound: jasmine.createSpy('onNotFound'),
      navigate: jasmine.createSpy('navigate'),
      client: jasmine.createSpyObj('client', ['createAccount', 'updateAccount']),
    };
    deps.client.createAccount.and.resolveTo({ id: 7 });
    deps.client.updateAccount.and.resolveTo({ id: 7 });
  });

  it('defaults to the Accounts section', () => {
    expect(build().detailHash(7)).toBe('#/bank/accounts/7');
  });

  it('builds detail hashes under the given section base, in both contexts', () => {
    expect(build(AccountFormController, { base: '/bank/debts' }).detailHash(7)).toBe('#/bank/debts/7');
    expect(build(AccountFormController, { base: '/bank/debts', context: { kind: 'organization', orgId: 5 } }).detailHash(7))
      .toBe('#/orgs/5/bank/debts/7');
  });

  it('creates through the sendCreate hook and goes to the section detail', async () => {
    await build(ExtraController, { base: '/bank/debts' }).create({ ...fieldsFromAccount(ACCOUNT), extra: 'b' });

    expect(deps.client.createAccount).toHaveBeenCalledWith(deps.context, jasmine.objectContaining({
      name: 'Car loan', extra: 'b', type: 'debt',
    }));
    expect(deps.navigate).toHaveBeenCalledWith('#/bank/debts/7');
  });

  it('creates with the validated body as-is by default', async () => {
    await build().create(fieldsFromAccount(ACCOUNT));

    expect(deps.client.createAccount.calls.mostRecent().args[1].type).toBeUndefined();
  });

  it('updates through the validate, fieldsFrom and changes hooks', async () => {
    await build(ExtraController, { base: '/bank/debts' }).update(7, { ...fieldsFromAccount(ACCOUNT), extra: 'b' }, ACCOUNT);

    expect(deps.client.updateAccount).toHaveBeenCalledWith(deps.context, 7, { extra: 'b', touched: true });
    expect(deps.navigate).toHaveBeenCalledWith('#/bank/debts/7');
  });

  it('goes straight back to the section detail when nothing changed', async () => {
    await build(AccountFormController, { base: '/bank/debts' }).update(7, fieldsFromAccount(ACCOUNT), ACCOUNT);

    expect(deps.client.updateAccount).not.toHaveBeenCalled();
    expect(deps.setFieldErrors).toHaveBeenCalledWith({});
    expect(deps.navigate).toHaveBeenCalledWith('#/bank/debts/7');
  });

  it('sends only the name of an archived account', async () => {
    const archived = { ...ACCOUNT, archived_at: '2026-02-01T00:00:00.000Z' };

    await build(ExtraController).update(7, { ...fieldsFromAccount(archived), extra: 'b' }, archived);

    expect(deps.client.updateAccount).toHaveBeenCalledWith(deps.context, 7, { name: 'Car loan' });
  });
});
