export interface SetDeletionContext {
  /** The set circle that was long-pressed (1-based). */
  setNumber: number
  /** Effective total sets for the exercise this session. */
  totalSets: number
  /** Set numbers already logged today for this exercise. */
  completedSets: number[]
  /** True while a set is being performed (countdown/concentric/eccentric). */
  isRunning: boolean
  /** The set the timer is currently on (performing, or resting toward). */
  currentSet: number
}

export type SetDeletionVerdict =
  | { allowed: true; newTotal: number; completesExercise: boolean }
  | { allowed: false; reason: 'completed' | 'lastSet' | 'inProgress' }

/**
 * Decides whether long-pressing a set circle may remove a set this session.
 *
 * Pending sets are interchangeable, so a removal always shrinks the total by
 * one rather than deleting a specific slot. Logged sets are never touched —
 * redoing them is the tap gesture's job. `completesExercise` signals that
 * every set left after the removal is already logged (e.g. the user deleted
 * the set they were resting toward), so the caller must finish the exercise.
 */
export function evaluateSetDeletion({
  setNumber,
  totalSets,
  completedSets,
  isRunning,
  currentSet,
}: SetDeletionContext): SetDeletionVerdict {
  if (completedSets.includes(setNumber)) {
    return { allowed: false, reason: 'completed' }
  }

  const newTotal = totalSets - 1
  if (newTotal < 1) {
    return { allowed: false, reason: 'lastSet' }
  }
  // Trimming the total below a logged set would orphan its history entry.
  if (completedSets.some((s) => s > newTotal)) {
    return { allowed: false, reason: 'completed' }
  }
  if (isRunning && currentSet > newTotal) {
    return { allowed: false, reason: 'inProgress' }
  }

  const completesExercise =
    !isRunning &&
    Array.from({ length: newTotal }, (_, i) => i + 1).every((s) =>
      completedSets.includes(s),
    )

  return { allowed: true, newTotal, completesExercise }
}
