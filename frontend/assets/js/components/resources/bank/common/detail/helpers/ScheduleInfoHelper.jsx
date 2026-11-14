import DetailEntry from '../DetailEntry.jsx';
import { formatDate } from '../../dates.js';

/**
 * Rendering helper of the schedule values shared by the debt and provider detail pages.
 */
const ScheduleInfoHelper = {
  /**
   * Render the schedule entries: Bills from, Show in Calendar (Yes / No) and Default paying
   * account (its name). Blank values show `—`; every value is rendered as escaped text.
   *
   * @param {object|null} details - The account's nested object (`debt` / `provider_expense`).
   * @returns {React.ReactElement} The entries, to be placed inside a definition list.
   */
  render(details) {
    const source = details ?? {};

    return (
      <>
        <DetailEntry label="Bills from" value={formatDate(source.bills_from)} />
        <DetailEntry label="Show in Calendar" value={source.show_in_calendar === false ? 'No' : 'Yes'} />
        <DetailEntry label="Default paying account" value={source.paying_account?.name} />
      </>
    );
  },
};

export default ScheduleInfoHelper;
