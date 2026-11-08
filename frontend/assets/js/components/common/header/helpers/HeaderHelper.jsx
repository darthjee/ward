import Navbar from 'react-bootstrap/cjs/Navbar.js';
import Nav from 'react-bootstrap/cjs/Nav.js';
import Container from 'react-bootstrap/cjs/Container.js';
import NavDropdown from 'react-bootstrap/cjs/NavDropdown.js';
import ContextSwitcher from '../contextSwitcher/ContextSwitcher.jsx';

/**
 * Render a single link that opens the login modal in a given mode instead of navigating.
 *
 * @param {string} mode - Mode to open the modal in (`'password'`, `'register'`, or
 *   `'recover'`).
 * @param {string} label - Link text.
 * @param {Function} onOpenLogin - Called with `mode` when the link is clicked.
 * @returns {React.ReactElement} The rendered link.
 */
function renderLoginLink(mode, label, onOpenLogin) {
  const handleClick = (event) => {
    event.preventDefault();
    onOpenLogin(mode);
  };

  return <Nav.Link href="#" onClick={handleClick}>{label}</Nav.Link>;
}

/**
 * Render the Admin Users nav link, only shown to a logged-in admin.
 *
 * @param {boolean} isAdmin - Whether the current session belongs to an admin user.
 * @returns {React.ReactElement|null} The Admin Users link, or `null` for a non-admin.
 */
function renderAdminLink(isAdmin) {
  if (!isAdmin) {
    return null;
  }

  return <Nav.Link href="#/admin/users">Admin Users</Nav.Link>;
}

/**
 * Render the "My account" dropdown, unconditionally shown once logged in — unlike
 * {@link renderAdminLink}, it takes no `isAdmin`-style gate. Holds one item per
 * account page; anticipates further account pages nesting under it later.
 *
 * @returns {React.ReactElement} The rendered "My account" dropdown.
 */
function renderMyAccountDropdown() {
  return (
    <NavDropdown title="My account" id="my-account-dropdown" renderMenuOnMount>
      <NavDropdown.Item href="#/account/authorization-requests">Authorizations</NavDropdown.Item>
      <NavDropdown.Item href="#/account/my-account">Account</NavDropdown.Item>
    </NavDropdown>
  );
}

/**
 * Render the logged-in menu: for an admin the Admin Users link, the "My account" dropdown and
 * the Logout action. Renders nothing while logged out or pending admin approval (the
 * Awaiting-approval view owns Log out then).
 *
 * @param {boolean} isLoggedIn - Whether a session is currently active.
 * @param {boolean} isAdmin - Whether the current session belongs to an admin user.
 * @param {Function} onLogout - Click handler for the Logout link.
 * @param {boolean} pending - Whether the session is awaiting admin approval.
 * @returns {React.ReactElement|null} The logged-in menu, or `null`.
 */
function renderAccountLinks(isLoggedIn, isAdmin, onLogout, pending) {
  if (pending || !isLoggedIn) {
    return null;
  }

  return (
    <>
      {renderAdminLink(isAdmin)}
      {renderMyAccountDropdown()}
      <Nav.Link href="#" onClick={onLogout}>Logout</Nav.Link>
    </>
  );
}

/**
 * Render the Login/Register/Recover links while logged out. Renders nothing once logged in or
 * while the session is pending admin approval.
 *
 * @param {boolean} isLoggedIn - Whether a session is currently active.
 * @param {Function} onOpenLogin - Called with a mode string (`'password'` / `'register'` /
 *   `'recover'`) to open the login modal.
 * @param {boolean} pending - Whether the session is awaiting admin approval.
 * @returns {React.ReactElement|null} The login links, or `null`.
 */
function renderLoginLinks(isLoggedIn, onOpenLogin, pending) {
  if (pending || isLoggedIn) {
    return null;
  }

  return (
    <>
      {renderLoginLink('password', 'Login', onOpenLogin)}
      {renderLoginLink('register', 'Register', onOpenLogin)}
      {renderLoginLink('recover', 'Recover', onOpenLogin)}
    </>
  );
}

/**
 * Rendering helper for the Header element.
 */
const HeaderHelper = {
  /**
   * Render the application navigation bar: the brand and the context switcher (or, logged out,
   * the login links) on the left, the logged-in menu right-aligned.
   *
   * @param {boolean} isLoggedIn - Whether a session is currently active.
   * @param {boolean} isAdmin - Whether the current session belongs to an admin user.
   * @param {Function} onLogout - Click handler for the Logout link, used when logged in.
   * @param {Function} onOpenLogin - Called with a mode string (`'password'` / `'register'` /
   *   `'recover'`) to open the login modal, used by the Login/Register/Recover links when
   *   logged out.
   * @param {boolean} [pending] - Whether the session is awaiting admin approval; hides every
   *   auth link (the brand stays).
   * @returns {React.ReactElement} The rendered navigation bar.
   */
  render(isLoggedIn, isAdmin, onLogout, onOpenLogin, pending = false) {
    return (
      <Navbar bg="light" expand="md">
        <Container fluid>
          <Navbar.Brand href="#/">Ward</Navbar.Brand>
          <Navbar.Toggle aria-controls="header-navbar" />
          <Navbar.Collapse id="header-navbar">
            <Nav className="me-auto">
              <ContextSwitcher loggedIn={isLoggedIn} pending={pending} />
              {renderLoginLinks(isLoggedIn, onOpenLogin, pending)}
            </Nav>
            <Nav className="ms-auto">
              {renderAccountLinks(isLoggedIn, isAdmin, onLogout, pending)}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    );
  },
};

export default HeaderHelper;
