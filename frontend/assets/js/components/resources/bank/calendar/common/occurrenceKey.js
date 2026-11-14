/**
 * Build a stable identity for a calendar occurrence.
 *
 * @param {object} occ - The occurrence.
 * @returns {string} The key made of `kind`, source account id, bill id and nominal date.
 */
export function occurrenceKey(occ) {
  return [occ.kind, occ.source_account.id, occ.bill?.id ?? '', occ.nominal_date].join('|');
}
