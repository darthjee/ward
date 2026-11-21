import useProviderBills from './hooks/useProviderBills.js';
import ProviderBillsHelper from './helpers/ProviderBillsHelper.jsx';
import useCan from '../../../../common/ownerContext/hooks/useCan.js';
import { ACTIONS } from '../../../../../utils/permissions/orgPermissions.js';

/**
 * The **Bills** block of a provider detail: its bills (recurring first, as returned by the API),
 * paginated, each with Edit and Delete (hidden while the provider is archived; Delete also when
 * the caller's role may not delete).
 *
 * @param {object} props - Component props.
 * @param {object} props.context - The owner context.
 * @param {object} props.account - The loaded provider account.
 * @returns {React.ReactElement} The section.
 */
export default function ProviderBills({ context, account }) {
  const { state, handlers } = useProviderBills({ context, account });
  const canDelete = useCan(ACTIONS.DELETE);

  return ProviderBillsHelper.render({
    ...state, account, context, canDelete,
  }, handlers);
}
