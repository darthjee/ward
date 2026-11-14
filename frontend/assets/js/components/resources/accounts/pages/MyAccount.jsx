import useAccountEditForm from '../../../common/forms/hooks/useAccountEditForm.js';
import MyAccountController from './controllers/MyAccountController.js';
import MyAccountHelper from './helpers/MyAccountHelper.jsx';

const INITIAL_FIELDS = {
  username: '',
  email: '',
  locale: '',
  currentPassword: '',
  newPassword: '',
  newPasswordConfirmation: '',
};

/**
 * My Account page: lets the logged-in user update their username, email, password and display
 * locale. The form is pre-filled from `GET /auth/account.json`; username, email and password
 * changes are confirmed by the current password, a locale-only change is not. A successful
 * save reflects the backend's authoritative values back into the form and clears the password
 * fields. Performs no client-side login check of its own — a
 * logged-out `401` on submit is handled entirely by `ApiClient`'s existing refresh/login-modal
 * flow.
 *
 * @returns {React.ReactElement} The rendered My Account page.
 */
export default function MyAccount() {
  const { state, handlers } = useAccountEditForm({
    initialFields: INITIAL_FIELDS,
    createController: (...setters) => new MyAccountController(...setters),
    submit: (controller, fields) => controller.handleSubmit(fields),
    load: (controller) => controller.load(),
  });

  return MyAccountHelper.render(state, handlers);
}
