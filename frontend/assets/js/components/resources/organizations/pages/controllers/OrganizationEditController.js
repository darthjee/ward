import OrganizationFormController from './OrganizationFormController.js';

/**
 * Controller for the Rename organization page. A `404` on save shows the Not-found view.
 */
export default class OrganizationEditController extends OrganizationFormController {
  /**
   * Create an edit controller.
   *
   * @param {object} options - Same dependencies as {@link OrganizationFormController}, plus
   *   `onNotFound`, called on a `404`.
   */
  constructor(options) {
    super(options);
    this.onNotFound = options.onNotFound;
  }

  /**
   * Validate and rename the organization, then go back to its overview.
   *
   * @param {number} orgId - The organization id, from the validated active context.
   * @param {{name: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(orgId, { name }) {
    await this.submitName(name, (trimmed) => this.client.rename(orgId, trimmed));
  }

  /**
   * Handle a failed request: a `404` shows Not-found, anything else the backend message.
   *
   * @param {Error & {status?: number}} error - The error thrown by the client.
   * @returns {void} Nothing.
   */
  handleSubmitError(error) {
    if (error.status === 404) {
      this.onNotFound();
      return;
    }

    super.handleSubmitError(error);
  }
}
