import OrganizationsClient from '../../../../../client/OrganizationsClient.js';
import { landingFor, organizationContext } from '../../../../../utils/context/ownerContext.js';
import { validateOrganizationName } from '../../../../../utils/validation/fieldValidators.js';
import navigate from './navigation.js';

/**
 * Shared submit flow of the organization name forms (create and rename): validates the name,
 * sets `pending` while the request runs, then refreshes the org list and navigates to the
 * organization's overview. A failure (e.g. a `400`) shows the backend message and resets
 * `pending`; an `undefined` result (session expired) resets `pending` without navigating.
 */
export default class OrganizationFormController {
  /**
   * Create a form controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {Function} options.setFieldErrors - React state setter for per-field errors.
   * @param {Function} options.setSubmitError - React state setter for the submit error.
   * @param {Function} options.setPending - React state setter for the in-flight flag.
   * @param {Function} options.refreshOrgs - Refetches the org list (from the owner context).
   * @param {Function} [options.navigate] - Navigation override, for testability.
   * @param {typeof OrganizationsClient} [options.client] - HTTP client override.
   */
  constructor({
    setFieldErrors, setSubmitError, setPending, refreshOrgs,
    navigate: navigateTo = navigate, client = OrganizationsClient,
  }) {
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.setPending = setPending;
    this.refreshOrgs = refreshOrgs;
    this.navigate = navigateTo;
    this.client = client;
  }

  /**
   * Validate the name and run the request with the trimmed name.
   *
   * @param {string} name - The raw name field value.
   * @param {Function} request - Called with the trimmed name; resolves the organization.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async submitName(name, request) {
    const errors = validateOrganizationName(name);

    this.setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    this.setSubmitError(null);
    this.setPending(true);

    try {
      const org = await request(name.trim());

      if (!org) {
        this.setPending(false);
        return;
      }

      await this.refreshOrgs();
      this.navigate(landingFor(organizationContext(org.id)));
    } catch (error) {
      this.handleSubmitError(error);
    }
  }

  /**
   * Handle a failed request: show its message and reset `pending`.
   *
   * @param {Error} error - The error thrown by the client.
   * @returns {void} Nothing.
   */
  handleSubmitError(error) {
    this.setSubmitError(error.message);
    this.setPending(false);
  }
}
