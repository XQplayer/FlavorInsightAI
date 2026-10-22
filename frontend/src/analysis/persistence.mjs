/** Immutable revision identity changes in the same render as its input state.
 * A receipt for an earlier write never means the current revision is saved. */
export function saveStatusForRevision(revision, receipt) {
  if (!revision.dataset) return ''
  return receipt?.revision === revision ? receipt.status : 'saving'
}
