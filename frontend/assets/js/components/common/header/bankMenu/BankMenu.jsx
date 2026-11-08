import BankMenuHelper from './helpers/BankMenuHelper.jsx';
import useOwnerContext from '../../ownerContext/hooks/useOwnerContext.js';

/**
 * Header dropdown with the Bank module's entries, linked under the active context. Hidden while
 * logged out or pending approval.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.loggedIn - Whether a session is active.
 * @param {boolean} [props.pending] - Whether the session awaits admin approval.
 * @returns {React.ReactElement|null} The menu, or `null` while logged out or pending.
 */
export default function BankMenu({ loggedIn, pending = false }) {
  const { context } = useOwnerContext();

  if (!loggedIn || pending) {
    return null;
  }

  return BankMenuHelper.render({ context });
}
