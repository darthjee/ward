import NavDropdown from 'react-bootstrap/cjs/NavDropdown.js';
import {
  PERSONAL,
  isSameContext,
  landingFor,
  organizationContext,
} from '../../../../../utils/context/ownerContext.js';

/** Title shown when the active organization is not in the loaded list. */
export const NEUTRAL_TITLE = 'Organization';

/** Inline message shown when the organization list failed to load. */
export const ORGS_ERROR_MESSAGE = 'Could not load organizations';

/**
 * Compute the switcher title: Personal, or the active organization's name from the list.
 *
 * @param {object} context - The active owner context.
 * @param {Array<object>} orgs - The loaded organizations.
 * @returns {string} The title text (never a name from storage).
 */
function titleFor(context, orgs) {
  if (context.kind !== 'organization') {
    return 'Personal';
  }

  return orgs.find((org) => org.id === context.orgId)?.name ?? NEUTRAL_TITLE;
}

/**
 * Render the truncated dropdown title, with the full text in `title`.
 *
 * @param {string} label - The title text.
 * @returns {React.ReactElement} The title element.
 */
function renderTitle(label) {
  return (
    <span className="d-inline-block text-truncate align-bottom" style={{ maxWidth: '12rem' }} title={label}>
      {label}
    </span>
  );
}

/**
 * Render one context item, checked when it is the active context.
 *
 * @param {object} itemContext - The item's owner context.
 * @param {string} label - The item text.
 * @param {object} active - The active owner context.
 * @param {Function} onPick - Called with the item's context on click.
 * @returns {React.ReactElement} The dropdown item.
 */
function renderContextItem(itemContext, label, active, onPick) {
  const checked = isSameContext(itemContext, active);
  const handleClick = (event) => {
    event.preventDefault();
    onPick(itemContext);
  };

  return (
    <NavDropdown.Item
      key={itemContext.orgId ?? 'personal'}
      href={landingFor(itemContext)}
      onClick={handleClick}
      active={checked}
      className="text-truncate"
      style={{ maxWidth: '20rem' }}
      title={label}
    >
      <i className={`bi bi-check2 me-2${checked ? '' : ' invisible'}`} aria-hidden="true" />
      {label}
    </NavDropdown.Item>
  );
}

/**
 * Render the organization items, or the inline error when the list failed to load.
 *
 * @param {{context: object, orgs: Array<object>, orgsError: (string|null)}} state - Switcher state.
 * @param {Function} onPick - Called with the picked context.
 * @returns {React.ReactNode} The organization section (empty without organizations).
 */
function renderOrganizations({ context, orgs, orgsError }, onPick) {
  if (orgsError) {
    return (
      <>
        <NavDropdown.Divider />
        <NavDropdown.ItemText className="text-danger small">{ORGS_ERROR_MESSAGE}</NavDropdown.ItemText>
      </>
    );
  }

  if (orgs.length === 0) {
    return null;
  }

  return (
    <>
      <NavDropdown.Divider />
      {orgs.map((org) => renderContextItem(organizationContext(org.id), org.name, context, onPick))}
    </>
  );
}

/**
 * Rendering helper for the header's context switcher.
 */
const ContextSwitcherHelper = {
  /**
   * Render the Personal / organization switcher dropdown.
   *
   * @param {{context: object, orgs: Array<object>, orgsError: (string|null)}} state - The active
   *   context, the loaded organizations and the load error.
   * @param {{onPick: Function}} handlers - `onPick` is called with the picked context.
   * @returns {React.ReactElement} The rendered dropdown.
   */
  render(state, { onPick }) {
    const orgs = state.orgs ?? [];

    return (
      <NavDropdown title={renderTitle(titleFor(state.context, orgs))} id="context-switcher" renderMenuOnMount>
        {renderContextItem(PERSONAL, 'Personal', state.context, onPick)}
        {renderOrganizations({ ...state, orgs }, onPick)}
        <NavDropdown.Divider />
        <NavDropdown.Item href="#/orgs/new">+ Create organization</NavDropdown.Item>
      </NavDropdown>
    );
  },
};

export default ContextSwitcherHelper;
