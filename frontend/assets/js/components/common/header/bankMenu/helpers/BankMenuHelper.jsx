import NavDropdown from 'react-bootstrap/cjs/NavDropdown.js';
import { contextHash } from '../../../../../utils/context/ownerContext.js';

/**
 * The Bank menu entries, as ordered `[label, context-relative path]` pairs. Each bank submenu
 * (Debts, Investments, then #55 Providers, #57 Calendar) appends its own entry here.
 *
 * @type {Array<Array<string>>}
 */
export const BANK_MENU_ENTRIES = [
  ['Accounts', '/bank/accounts'],
  ['Debts', '/bank/debts'],
  ['Investments', '/bank/investments'],
];

/**
 * Rendering helper for the header's Bank menu.
 */
const BankMenuHelper = {
  /**
   * Render the Bank dropdown, its links built from the active context.
   *
   * @param {{context: object}} state - The active owner context.
   * @param {Array<Array<string>>} [entries] - The `[label, path]` entries.
   * @returns {React.ReactElement} The rendered dropdown.
   */
  render({ context }, entries = BANK_MENU_ENTRIES) {
    return (
      <NavDropdown title="Bank" id="bank-menu" renderMenuOnMount>
        {entries.map(([label, path]) => (
          <NavDropdown.Item key={path} href={contextHash(context, path)}>{label}</NavDropdown.Item>
        ))}
      </NavDropdown>
    );
  },
};

export default BankMenuHelper;
