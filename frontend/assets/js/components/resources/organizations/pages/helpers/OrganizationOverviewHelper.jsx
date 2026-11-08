import { contextHash } from '../../../../../utils/context/ownerContext.js';

/**
 * Render the loaded organization: name, the user's role and the Rename link.
 *
 * @param {object} org - The organization.
 * @param {object} context - The active owner context.
 * @returns {React.ReactElement} The organization details.
 */
function renderOrganization(org, context) {
  return (
    <>
      <h1 className="text-break">{org.name}</h1>
      <p>
        Your role:
        {' '}
        <span className="badge text-bg-secondary">{org.role}</span>
      </p>
      <a className="btn btn-outline-primary" href={contextHash(context, '/edit')}>Rename</a>
    </>
  );
}

/**
 * Render the body: an error, the organization, or a loading notice.
 *
 * @param {{org: (object|null), loadError: (string|null), context: object}} state - Page state.
 * @returns {React.ReactElement} The page body.
 */
function renderBody({ org, loadError, context }) {
  if (loadError) {
    return <div className="alert alert-danger">{loadError}</div>;
  }

  if (!org) {
    return <p className="text-muted">Loading…</p>;
  }

  return renderOrganization(org, context);
}

/**
 * Rendering helper for the organization overview page.
 */
const OrganizationOverviewHelper = {
  /**
   * Render the organization overview.
   *
   * @param {{org: (object|null), loadError: (string|null), context: object}} state - The loaded
   *   organization, the load error and the active owner context.
   * @returns {React.ReactElement} The rendered overview.
   */
  render(state) {
    return <div className="container mt-4">{renderBody(state)}</div>;
  },
};

export default OrganizationOverviewHelper;
