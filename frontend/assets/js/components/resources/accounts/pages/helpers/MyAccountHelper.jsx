import AccountEditFormHelper from '../../../../common/forms/helpers/AccountEditFormHelper.jsx';
import LocaleSelect from '../LocaleSelect.jsx';

const LEADING_PASSWORD_FIELDS = [
  ['currentPassword', 'password', 'Current password'],
];

/**
 * Render the display-locale select slot.
 *
 * @param {object} state - Page state.
 * @param {{onChange: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The select.
 */
function renderLocaleSelect(state, handlers) {
  return (
    <LocaleSelect
      id="my-account-locale"
      value={state.locale ?? ''}
      error={state.fieldErrors?.locale}
      onChange={handlers.onChange('locale')}
    />
  );
}

/**
 * Rendering helper for the "My account" page.
 */
const MyAccountHelper = {
  /**
   * Render the My Account page: editable username/email fields, the required current-password
   * confirmation, a change-password section, a save action, and inline error/success display.
   * The shared markup is rendered by {@link AccountEditFormHelper}.
   *
   * @param {{username: string, email: string, currentPassword: string, newPassword: string,
   *   newPasswordConfirmation: string, fieldErrors: object, submitError: (string|null),
   *   success: boolean, locale: string, loading: boolean}} state - Page state.
   * @param {{onSubmit: Function, onChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered My Account page.
   */
  render(state, handlers) {
    return AccountEditFormHelper.render(state, handlers, {
      heading: 'My Account',
      successMessage: 'Account updated.',
      idPrefix: 'my-account-',
      leadingPasswordFields: LEADING_PASSWORD_FIELDS,
      afterProfileFields: renderLocaleSelect,
      submitDisabled: state.loading,
    });
  },
};

export default MyAccountHelper;
