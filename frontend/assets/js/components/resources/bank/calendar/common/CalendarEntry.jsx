import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { formatMoney } from '../../common/amounts.js';
import { formatDate } from '../../common/dates.js';
import { BILLS_BASE, SECTION_BY_TYPE } from '../../common/sections.js';
import { formatWeekdayDay } from './calendarDates.js';
import { occurrenceKey } from './occurrenceKey.js';

export { occurrenceKey };

const STATUS_CLASSES = new Map([
  ['open', 'text-bg-secondary'],
  ['overdue', 'text-bg-danger'],
  ['paid', 'text-bg-success'],
  ['skipped', 'text-bg-light'],
]);

const ROW_CLASSES = new Map([
  ['overdue', 'border-danger text-danger'],
  ['paid', 'text-muted opacity-50'],
  ['skipped', 'text-muted opacity-50'],
]);

/**
 * Build the name shown for an occurrence.
 *
 * @param {object} occ - The occurrence.
 * @returns {string} The bill description for a bill, otherwise the source account name.
 */
function entryName(occ) {
  return occ.kind === 'bill' ? occ.bill.description : occ.source_account.name;
}

/**
 * Build the UI hash an occurrence links to.
 *
 * @param {object} context - The owner context.
 * @param {object} occ - The occurrence.
 * @returns {string} The account detail hash, or the bill edit hash.
 */
function entryHref(context, occ) {
  if (occ.kind === 'bill') {
    return contextHash(context, `${BILLS_BASE}/${occ.bill.id}/edit`);
  }

  return contextHash(context, `${SECTION_BY_TYPE.get(occ.source_account.type)}/${occ.source_account.id}`);
}

/**
 * Render the date of an occurrence, with the nominal date only when it was shifted.
 *
 * @param {{occurrence: object}} props - The occurrence.
 * @returns {React.ReactElement} The date.
 */
function EntryDate({ occurrence }) {
  const shifted = occurrence.nominal_date !== occurrence.effective_date;

  return (
    <span className="calendar-entry-date me-2">
      {formatDate(occurrence.effective_date)}
      {shifted && (
        <small className="ms-1">
          {`due ${formatWeekdayDay(occurrence.nominal_date)}, moved to ${formatWeekdayDay(occurrence.effective_date)}`}
        </small>
      )}
    </span>
  );
}

/**
 * Render the actions of an occurrence according to its status.
 *
 * @param {{occurrence: object, onPay: Function, onSkip: Function, onUndo: Function}} props - The
 *   occurrence and its handlers.
 * @returns {React.ReactElement|null} Pay / Skip for pending entries, Undo for settled ones.
 */
function EntryActions({ occurrence, onPay, onSkip, onUndo }) {
  if (occurrence.status === 'open' || occurrence.status === 'overdue') {
    return (
      <span className="ms-2">
        <button type="button" className="btn btn-sm btn-primary me-1" onClick={() => onPay(occurrence)}>Pay</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onSkip(occurrence)}>Skip</button>
      </span>
    );
  }

  return (
    <button type="button" className="btn btn-sm btn-outline-secondary ms-2" onClick={() => onUndo(occurrence)}>Undo</button>
  );
}

/**
 * One occurrence of the Calendar: name, amount, date, status and actions.
 *
 * @param {{context: object, occurrence: object, onPay: Function, onSkip: Function,
 *   onUndo: Function, variant: string}} props - The owner context, the occurrence, the action
 *   handlers and the layout variant (`list` or `month`).
 * @returns {React.ReactElement} The entry.
 */
export default function CalendarEntry({ context, occurrence, onPay, onSkip, onUndo, variant = 'list' }) {
  const amount = occurrence.expected_amount === null || occurrence.expected_amount === undefined
    ? null
    : formatMoney(occurrence.expected_amount, occurrence.currency);

  return (
    <div className={`calendar-entry calendar-entry-${variant} ${ROW_CLASSES.get(occurrence.status) || ''}`}>
      <a href={entryHref(context, occurrence)} className="me-2">{entryName(occurrence)}</a>
      {amount && <span className="calendar-entry-amount me-2">{amount}</span>}
      <EntryDate occurrence={occurrence} />
      <span className={`badge ${STATUS_CLASSES.get(occurrence.status) || ''}`}>{occurrence.status}</span>
      <EntryActions occurrence={occurrence} onPay={onPay} onSkip={onSkip} onUndo={onUndo} />
    </div>
  );
}
