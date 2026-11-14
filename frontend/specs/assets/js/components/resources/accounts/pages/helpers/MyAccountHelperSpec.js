import MyAccountHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx';
import { itBehavesLikeAnAccountEditFormHelper } from '../../../../../../../support/accountEditFormHelperExamples.js';

describe('MyAccountHelper', () => {
  const { buildHandlers, buildState, renderPage } = itBehavesLikeAnAccountEditFormHelper({
    Helper: MyAccountHelper,
    heading: 'My Account',
    successMessage: 'Account updated.',
    submitError: 'Invalid current password',
    idPrefix: 'my-account-',
    changeFields: [
      'username', 'email', 'currentPassword', 'newPassword', 'newPasswordConfirmation',
    ],
  });

  describe('.render (current password)', () => {
    it('renders the current-password field', () => {
      const page = renderPage(buildState(), buildHandlers());

      expect(page.contains('Current password')).withContext('current-password label').toBeTrue();
      expect(page.containsAttribute('id', 'my-account-currentPassword'))
        .withContext('current-password input id').toBeTrue();
    });

    it('wires the current-password change handler', () => {
      const handlers = buildHandlers();
      renderPage(buildState(), handlers);

      expect(handlers.onChange).toHaveBeenCalledWith('currentPassword');
    });
  });

  describe('.render (display locale)', () => {
    it('renders the select with every locale option', () => {
      const page = renderPage(buildState({ locale: 'pt-BR' }), buildHandlers());

      expect(page.containsInOrder('Display locale', 'Browser default', 'English (United States)', 'Deutsch (Deutschland)'))
        .toBeTrue();
    });

    it('wires the locale change handler', () => {
      const handlers = buildHandlers();
      renderPage(buildState(), handlers);

      expect(handlers.onChange).toHaveBeenCalledWith('locale');
    });
  });
});
