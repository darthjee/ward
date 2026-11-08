import { useMemo } from 'react';
import ContextSwitcherHelper from './helpers/ContextSwitcherHelper.jsx';
import ContextSwitcherController from './controllers/ContextSwitcherController.js';
import useOwnerContext from '../../ownerContext/hooks/useOwnerContext.js';

/**
 * Header dropdown switching between Personal and the user's organizations. Hidden while logged
 * out or pending approval.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.loggedIn - Whether a session is active.
 * @param {boolean} [props.pending] - Whether the session awaits admin approval.
 * @returns {React.ReactElement|null} The switcher, or `null` while logged out or pending.
 */
export default function ContextSwitcher({ loggedIn, pending = false }) {
  const {
    context, userId, orgs, orgsError,
  } = useOwnerContext();
  const controller = useMemo(() => new ContextSwitcherController(), []);

  if (!loggedIn || pending) {
    return null;
  }

  const onPick = (picked) => controller.pick(picked, userId);

  return ContextSwitcherHelper.render({ context, orgs, orgsError }, { onPick });
}
