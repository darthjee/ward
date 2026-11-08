import BankAccountNewController from '../../../../../../../../../assets/js/components/resources/bank/accounts/pages/controllers/BankAccountNewController.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const FIELDS = {
  name: 'Main', bank_name: '', branch: '', account_number: '', currency: 'BRL', opening_date: '2000-01-01', opening_balance: '0', notes: '',
};

describe('BankAccountNewController', () => {
  let deps;
  let controller;

  function build(context = { kind: 'personal' }) {
    return new BankAccountNewController({ ...deps, context });
  }

  beforeEach(() => {
    deps = {
      setFieldErrors: jasmine.createSpy('setFieldErrors'),
      setSubmitError: jasmine.createSpy('setSubmitError'),
      setPending: jasmine.createSpy('setPending'),
      onNotFound: jasmine.createSpy('onNotFound'),
      navigate: jasmine.createSpy('navigate'),
      client: jasmine.createSpyObj('client', ['createAccount']),
    };
    deps.client.createAccount.and.resolveTo({ id: 12, account_number: '•••• 1234' });
    controller = build();
  });

  it('creates the account and navigates to its detail page', async () => {
    await controller.handleSubmit(FIELDS);

    expect(deps.client.createAccount).toHaveBeenCalledWith({ kind: 'personal' }, {
      name: 'Main', bank_name: null, branch: null, account_number: null, notes: null, currency: 'BRL', opening_date: '2000-01-01', opening_balance: '0',
    });
    expect(deps.navigate).toHaveBeenCalledWith('#/bank/accounts/12');
  });

  it('navigates within an organization', async () => {
    await build({ kind: 'organization', orgId: 5 }).handleSubmit(FIELDS);

    expect(deps.navigate).toHaveBeenCalledWith('#/orgs/5/bank/accounts/12');
  });

  it('sets pending while the request is in flight', async () => {
    let resolve;

    deps.client.createAccount.and.returnValue(new Promise((done) => {
      resolve = done;
    }));

    const submission = controller.handleSubmit(FIELDS);

    expect(deps.setPending).toHaveBeenCalledWith(true);
    resolve({ id: 1 });
    await submission;
    expect(deps.setPending).not.toHaveBeenCalledWith(false);
  });

  it('does not send on client errors', async () => {
    await controller.handleSubmit({ ...FIELDS, currency: '' });

    expect(deps.setFieldErrors).toHaveBeenCalledWith({ currency: 'Choose a currency' });
    expect(deps.client.createAccount).not.toHaveBeenCalled();
  });

  it('resets pending on an expired session', async () => {
    deps.client.createAccount.and.resolveTo(undefined);

    await controller.handleSubmit(FIELDS);

    expect(deps.setPending.calls.mostRecent().args[0]).toBeFalse();
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it('shows ACCOUNT_NAME_TAKEN as a name field error, without an alert', async () => {
    deps.client.createAccount.and.rejectWith(new ApiError(409, 'Name taken', 'ACCOUNT_NAME_TAKEN'));

    await controller.handleSubmit(FIELDS);

    expect(deps.setFieldErrors).toHaveBeenCalledWith({ name: 'Name taken' });
    expect(deps.setSubmitError).not.toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict' }));
    expect(deps.setPending.calls.mostRecent().args[0]).toBeFalse();
  });

  it('shows the details of a 400', async () => {
    deps.client.createAccount.and.rejectWith(new ApiError(400, 'Validation failed', 'VALIDATION_FAILED', ['notes is too long']));

    await controller.handleSubmit(FIELDS);

    expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({
      kind: 'validation', messages: ['notes is too long'],
    }));
  });

  it('shows a transient alert on a 5xx', async () => {
    deps.client.createAccount.and.rejectWith(new ApiError(502, 'Bad gateway'));

    await controller.handleSubmit(FIELDS);

    expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'transient' }));
  });

  it('shows Not-found on a 404', async () => {
    deps.client.createAccount.and.rejectWith(new ApiError(404, 'Not Found'));

    await controller.handleSubmit(FIELDS);

    expect(deps.onNotFound).toHaveBeenCalled();
  });

  it('tolerates the default onConflict', async () => {
    deps.client.createAccount.and.rejectWith(new ApiError(409, 'Other', 'OTHER'));

    await controller.handleSubmit(FIELDS);

    expect(deps.setSubmitError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'conflict' }));
  });

  it('uses the default navigation and client', () => {
    const plain = new BankAccountNewController({
      context: { kind: 'personal' },
      setFieldErrors: () => undefined,
      setSubmitError: () => undefined,
      setPending: () => undefined,
      onNotFound: () => undefined,
    });

    expect(plain.client.createAccount).toEqual(jasmine.any(Function));
    expect(() => plain.navigate('#/x')).not.toThrow();
  });
});
