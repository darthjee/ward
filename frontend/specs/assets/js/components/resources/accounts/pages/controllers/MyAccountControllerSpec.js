import MyAccountController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/MyAccountController.js';
import DisplayLocale from '../../../../../../../../assets/js/utils/locale/DisplayLocale.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { itBehavesLikeAnAccountEditFormController } from '../../../../../../../support/accountEditFormControllerExamples.js';

describe('MyAccountController', () => {
  const blankFields = {
    username: '',
    email: '',
    currentPassword: 'secret',
    newPassword: '',
    newPasswordConfirmation: '',
  };

  const context = itBehavesLikeAnAccountEditFormController({
    ControllerClass: MyAccountController,
    clientMethod: 'updateAccount',
    blankFields,
    submit: (controller, fields) => controller.handleSubmit(fields),
    wrapResponse: (account) => account,
    expectedClientArgs: (payload) => [{ currentPassword: 'secret', ...payload }],
  });

  describe('#validate', () => {
    it('returns no errors for a form with only the current password filled in', () => {
      const controller = context.buildController();

      expect(controller.validate(blankFields)).toEqual({});
    });

    it('flags a missing current password', () => {
      const controller = context.buildController();

      expect(
        controller.validate({ ...blankFields, username: 'newname', currentPassword: '' }).currentPassword,
      ).toBeDefined();
    });
  });

  describe('#handleSubmit', () => {
    it('sets currentPassword field errors and skips the API call when it is missing', async () => {
      const controller = context.buildController();

      await controller.handleSubmit({ ...blankFields, username: 'newname', currentPassword: '' });

      expect(context.setFieldErrors).toHaveBeenCalledWith(
        jasmine.objectContaining({ currentPassword: jasmine.any(String) }),
      );
      expect(context.client.updateAccount).not.toHaveBeenCalled();
    });

    it('also clears the current password field on success', async () => {
      context.client.updateAccount.and.resolveTo({ username: 'newname', email: 'foo@example.com' });
      const controller = context.buildController();

      await controller.handleSubmit({ ...blankFields, username: 'newname' });

      const updater = context.setFields.calls.mostRecent().args[0];
      expect(updater({ username: 'old', email: 'foo@example.com', currentPassword: 'secret' }))
        .toEqual({
          username: 'newname',
          email: 'foo@example.com',
          locale: '',
          currentPassword: '',
          newPassword: '',
          newPasswordConfirmation: '',
        });
    });

    it('stores the submit error and does not update the fields on a wrong current password', async () => {
      context.client.updateAccount.and.rejectWith(new ApiError(400, 'Invalid current password'));
      const controller = context.buildController();

      await controller.handleSubmit({ ...blankFields, username: 'newname' });

      expect(context.setSubmitError).toHaveBeenCalledWith('Invalid current password');
      expect(context.setFields).not.toHaveBeenCalled();
      expect(context.setSuccess).not.toHaveBeenCalledWith(true);
    });
  });

  describe('display locale', () => {
    const loaded = { username: 'alice', email: 'alice@example.com', locale: 'pt-BR' };
    const form = { ...blankFields, currentPassword: '', ...{ username: 'alice', email: 'alice@example.com', locale: 'pt-BR' } };

    afterEach(() => {
      DisplayLocale.set(null);
    });

    it('pre-fills the form from the account on load', async () => {
      context.client.getAccount = jasmine.createSpy('getAccount').and.resolveTo(loaded);
      const controller = context.buildController();

      await controller.load();

      const updater = context.setFields.calls.mostRecent().args[0];
      expect(updater({ currentPassword: '' })).toEqual({
        currentPassword: '', username: 'alice', email: 'alice@example.com', locale: 'pt-BR',
      });
    });

    it('uses an empty select value for a null locale', async () => {
      context.client.getAccount = jasmine.createSpy('getAccount').and.resolveTo({ ...loaded, locale: null });
      const controller = context.buildController();

      await controller.load();

      expect(context.setFields.calls.mostRecent().args[0]({}).locale).toBe('');
    });

    it('shows the error and keeps the fields when loading fails', async () => {
      context.client.getAccount = jasmine.createSpy('getAccount').and.rejectWith(new ApiError(500, 'boom'));
      const controller = context.buildController();

      await controller.load();

      expect(context.setSubmitError).toHaveBeenCalledWith('boom');
      expect(context.setFields).not.toHaveBeenCalled();
    });

    describe('after loading', () => {
      let controller;

      beforeEach(async () => {
        context.client.getAccount = jasmine.createSpy('getAccount').and.resolveTo(loaded);
        controller = context.buildController();
        await controller.load();
        context.setFields.calls.reset();
      });

      it('has no update when nothing changed', async () => {
        await controller.handleSubmit(form);

        expect(context.client.updateAccount).not.toHaveBeenCalled();
      });

      it('submits a locale-only change without password, username or email', async () => {
        context.client.updateAccount.and.resolveTo({ ...loaded, locale: 'en-US' });

        await controller.handleSubmit({ ...form, locale: 'en-US' });

        expect(context.client.updateAccount).toHaveBeenCalledOnceWith({ locale: 'en-US' });
      });

      it('sends an explicit null when choosing Browser default', async () => {
        context.client.updateAccount.and.resolveTo({ ...loaded, locale: null });

        await controller.handleSubmit({ ...form, locale: '' });

        expect(context.client.updateAccount).toHaveBeenCalledOnceWith({ locale: null });
      });

      it('still requires the current password when the username changes', async () => {
        await controller.handleSubmit({ ...form, username: 'bob' });

        expect(context.setFieldErrors).toHaveBeenCalledWith(
          jasmine.objectContaining({ currentPassword: jasmine.any(String) }),
        );
      });

      it('sends the password with a protected change', async () => {
        context.client.updateAccount.and.resolveTo({ ...loaded, username: 'bob' });

        await controller.handleSubmit({ ...form, username: 'bob', currentPassword: 'secret' });

        expect(context.client.updateAccount).toHaveBeenCalledOnceWith({
          username: 'bob', currentPassword: 'secret',
        });
      });

      it('updates the live display locale on success', async () => {
        context.client.updateAccount.and.resolveTo({ ...loaded, locale: 'pt-BR' });

        await controller.handleSubmit({ ...form, locale: 'pt-BR', username: 'x', currentPassword: 'p' });

        expect(DisplayLocale.get()).toBe('pt-BR');
      });

      it('maps INVALID_LOCALE to the select error', async () => {
        context.client.updateAccount.and.rejectWith(new ApiError(422, 'Unsupported display locale', 'INVALID_LOCALE'));

        await controller.handleSubmit({ ...form, locale: 'en-US' });

        expect(context.setFieldErrors).toHaveBeenCalledWith({ locale: 'Unsupported display locale' });
      });
    });
  });
});
