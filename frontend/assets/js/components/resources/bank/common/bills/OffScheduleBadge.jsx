/**
 * The "Off-schedule" badge of a bill payment, rendered only for a payment recorded off the
 * account's schedule.
 *
 * @param {{payment: {off_schedule: boolean}}} props - The bill payment.
 * @returns {React.ReactElement|null} The badge, or `null` for an on-schedule payment.
 */
export default function OffScheduleBadge({ payment }) {
  if (!payment.off_schedule) {
    return null;
  }

  return <span className="badge text-bg-warning ms-2">Off-schedule</span>;
}
