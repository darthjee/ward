import { buildDetailHandlers } from '../../../../../../../../../assets/js/components/resources/bank/common/detail/controllers/detailHandlers.js';
import { emptyLedgerValues } from '../../../../../../../../../assets/js/components/resources/bank/common/detail/controllers/ledgerFormFields.js';

const CLEAN = emptyLedgerValues('2026-05-10');
const DIRTY = { ...CLEAN, amount: '5' };
const ROW = { id: 3, description: 'Coffee' };

describe('buildDetailHandlers', () => {
  let deps;

  function build(overrides = {}) {
    return buildDetailHandlers({ ...deps, ...overrides });
  }

  beforeEach(() => {
    deps = {
      form: { editing: null, values: CLEAN, baseline: CLEAN },
      actions: jasmine.createSpyObj('actions', ['changeValue', 'toggleNotes', 'reset', 'startEdit', 'startNew']),
      ledgerController: jasmine.createSpyObj('ledgerController', ['submit']),
      detailController: jasmine.createSpyObj('detailController', ['archive', 'unarchive', 'deleteAccount', 'deleteTransaction']),
      currency: 'BRL',
      page: 2,
      confirmation: null,
      setConfirmation: jasmine.createSpy('setConfirmation'),
      error: null,
      setError: jasmine.createSpy('setError'),
      reload: jasmine.createSpy('reload'),
      confirm: jasmine.createSpy('confirm').and.returnValue(false),
    };
  });

  describe('form', () => {
    it('changes values by input name', () => {
      build().onFieldChange({ target: { name: 'amount', value: '3' } });

      expect(deps.actions.changeValue).toHaveBeenCalledWith('amount', '3');
    });

    it('changes the direction', () => {
      build().onDirectionChange('in');

      expect(deps.actions.changeValue).toHaveBeenCalledWith('direction', 'in');
    });

    it('toggles the notes', () => {
      build().onToggleNotes();

      expect(deps.actions.toggleNotes).toHaveBeenCalled();
    });

    it('submits with the currency and the page', () => {
      const event = { preventDefault: jasmine.createSpy('preventDefault') };

      build().onSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(deps.ledgerController.submit).toHaveBeenCalledWith(deps.form, { currency: 'BRL', page: 2 });
    });
  });

  describe('unsaved form confirmation', () => {
    it('edits another row without asking when the form is clean', () => {
      build().onEdit(ROW);

      expect(deps.confirm).not.toHaveBeenCalled();
      expect(deps.actions.startEdit).toHaveBeenCalledWith(ROW);
    });

    it('asks before switching to another row with unsaved changes, and keeps the form when refused', () => {
      build({ form: { editing: null, values: DIRTY, baseline: CLEAN } }).onEdit(ROW);

      expect(deps.confirm).toHaveBeenCalled();
      expect(deps.actions.startEdit).not.toHaveBeenCalled();
    });

    it('switches when confirmed', () => {
      deps.confirm.and.returnValue(true);

      build({ form: { editing: { id: 1 }, values: DIRTY, baseline: CLEAN } }).onEdit(ROW);

      expect(deps.actions.startEdit).toHaveBeenCalledWith(ROW);
    });

    it('ignores Edit on the row already being edited', () => {
      build({ form: { editing: ROW, values: DIRTY, baseline: CLEAN } }).onEdit(ROW);

      expect(deps.confirm).not.toHaveBeenCalled();
      expect(deps.actions.startEdit).not.toHaveBeenCalled();
    });

    it('asks before changing page, cancelling the navigation when refused', () => {
      const event = { preventDefault: jasmine.createSpy('preventDefault') };

      build({ form: { editing: null, values: DIRTY, baseline: CLEAN } }).onNavigate(3, event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(deps.actions.reset).not.toHaveBeenCalled();
    });

    it('changes page and resets the form when clean', () => {
      const event = { preventDefault: jasmine.createSpy('preventDefault') };

      build().onNavigate(3, event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(deps.actions.reset).toHaveBeenCalled();
    });

    it('starts a preset without asking when the form is clean', () => {
      const preset = { direction: 'in', description: 'Payment' };

      build().onStartNew(preset);

      expect(deps.confirm).not.toHaveBeenCalled();
      expect(deps.actions.startNew).toHaveBeenCalledWith(preset);
    });

    it('starts a preset over a clean edit without asking', () => {
      build({ form: { editing: ROW, values: CLEAN, baseline: CLEAN } }).onStartNew({ direction: 'out' });

      expect(deps.confirm).not.toHaveBeenCalled();
      expect(deps.actions.startNew).toHaveBeenCalledWith({ direction: 'out' });
    });

    it('asks before replacing unsaved changes with a preset, keeping them when refused', () => {
      build({ form: { editing: null, values: DIRTY, baseline: CLEAN } }).onStartNew({ direction: 'in' });

      expect(deps.confirm).toHaveBeenCalled();
      expect(deps.actions.startNew).not.toHaveBeenCalled();

      deps.confirm.and.returnValue(true);
      build({ form: { editing: ROW, values: DIRTY, baseline: CLEAN } }).onStartNew({ direction: 'in' });

      expect(deps.actions.startNew).toHaveBeenCalledWith({ direction: 'in' });
    });

    it('asks before cancelling an edit with unsaved changes', () => {
      build({ form: { editing: ROW, values: DIRTY, baseline: CLEAN } }).onCancelEdit();

      expect(deps.actions.reset).not.toHaveBeenCalled();

      deps.confirm.and.returnValue(true);
      build({ form: { editing: ROW, values: DIRTY, baseline: CLEAN } }).onCancelEdit();

      expect(deps.actions.reset).toHaveBeenCalled();
    });
  });

  describe('actions', () => {
    it('archives and unarchives', () => {
      build().onArchive();
      build().onUnarchive();

      expect(deps.detailController.archive).toHaveBeenCalled();
      expect(deps.detailController.unarchive).toHaveBeenCalled();
    });

    it('confirms before deleting the account', () => {
      build().onDeleteAccount();

      expect(deps.setConfirmation).toHaveBeenCalledWith({ kind: 'account' });
      expect(deps.detailController.deleteAccount).not.toHaveBeenCalled();

      build({ confirmation: { kind: 'account' } }).onConfirm();

      expect(deps.detailController.deleteAccount).toHaveBeenCalled();
    });

    it('confirms before deleting a transaction', () => {
      build().onDeleteTransaction(ROW);

      expect(deps.setConfirmation).toHaveBeenCalledWith({ kind: 'transaction', transaction: ROW });

      build({ confirmation: { kind: 'transaction', transaction: ROW } }).onConfirm();

      expect(deps.detailController.deleteTransaction).toHaveBeenCalledWith(ROW);
    });

    it('cancels the confirmation', () => {
      build().onCancelConfirm();

      expect(deps.setConfirmation).toHaveBeenCalledWith(null);
    });

    it('retries the failed request', () => {
      const retry = jasmine.createSpy('retry');

      build({ error: { kind: 'transient', retry } }).onRetry();
      build().onRetry();

      expect(retry).toHaveBeenCalledTimes(1);
    });

    it('dismisses the alert and retries the load', () => {
      build().onDismiss();
      build().onRetryLoad();

      expect(deps.setError).toHaveBeenCalledWith(null);
      expect(deps.reload).toHaveBeenCalled();
    });
  });
});
