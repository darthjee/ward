/**
 * The reconcile state the ledger table needs, only while the mode is active.
 *
 * @param {object|undefined} reconcile - The page's reconcile state.
 * @param {object} account - The loaded account.
 * @returns {{account: object, statement: object, ticked: Map<number, boolean>,
 *   onlyUncleared: boolean}|undefined} The ledger state, or `undefined` outside reconcile mode.
 */
export function ledgerReconcile(reconcile, account) {
  if (reconcile?.mode !== 'active') {
    return undefined;
  }

  return {
    account,
    statement: reconcile.statement,
    ticked: reconcile.ticked,
    onlyUncleared: reconcile.onlyUncleared,
  };
}
