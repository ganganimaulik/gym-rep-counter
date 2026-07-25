import AsyncStorage from '@react-native-async-storage/async-storage'
import type { WeightUnit } from '../declarations'

// Per-exercise memory of how the user last logged a set — the weight unit, the
// rep count and the variant — keyed by exercise id. Purely a UI convenience: it
// lets the "Set Complete" modal default to the user's last choices instead of
// re-asking the unit and resetting reps to 0 each set. Device-local and not
// synced — it mirrors a UI interaction, not core workout data.
export interface SetPreference {
  weightUnit?: WeightUnit
  reps?: number
  variant?: string
}

// Choices being recorded. `variant: null` clears a remembered variant
// (undefined leaves it unchanged), so saving a set with no variant selected
// stops the previous one from coming back on the next set.
export interface SetPreferenceUpdates {
  weightUnit?: WeightUnit
  reps?: number
  variant?: string | null
}

export const SET_PREFERENCE_KEY = 'lastSetPreferenceByExercise'

const isWeightUnit = (v: unknown): v is WeightUnit =>
  v === 'kg' || v === 'plates'

// Keep only well-formed fields so a corrupt or partial entry can't feed a bad
// default into the modal. Reps must be a positive finite number and a variant a
// non-empty string.
const sanitize = (raw: unknown): SetPreference | null => {
  if (!raw || typeof raw !== 'object') return null
  const { weightUnit, reps, variant } = raw as Record<string, unknown>
  const pref: SetPreference = {}
  if (isWeightUnit(weightUnit)) pref.weightUnit = weightUnit
  if (typeof reps === 'number' && Number.isFinite(reps) && reps > 0) {
    pref.reps = reps
  }
  if (typeof variant === 'string' && variant.length > 0) {
    pref.variant = variant
  }
  return Object.keys(pref).length > 0 ? pref : null
}

export const loadSetPreferences = async (): Promise<
  Record<string, SetPreference>
> => {
  try {
    const rawStr = await AsyncStorage.getItem(SET_PREFERENCE_KEY)
    if (!rawStr) return {}
    const parsed = JSON.parse(rawStr)
    if (!parsed || typeof parsed !== 'object') return {}
    const result: Record<string, SetPreference> = {}
    for (const [id, value] of Object.entries(parsed)) {
      const pref = sanitize(value)
      if (pref) result[id] = pref
    }
    return result
  } catch (e) {
    console.error('Failed to load set preferences', e)
    return {}
  }
}

// Merge new choices for one exercise into the saved map and return the updated
// map. Reads storage first, and merges field-by-field, so recording only the
// unit never wipes a remembered rep count (or vice versa), and a stale
// in-memory copy can't clobber other exercises' entries.
export const recordSetPreference = async (
  exerciseId: string,
  pref: SetPreferenceUpdates,
): Promise<Record<string, SetPreference>> => {
  const current = await loadSetPreferences()
  const { variant, ...rest } = pref
  const merged: SetPreference = { ...current[exerciseId], ...rest }
  if (variant === null) {
    delete merged.variant
  } else if (variant !== undefined) {
    merged.variant = variant
  }
  const next = { ...current, [exerciseId]: merged }
  try {
    await AsyncStorage.setItem(SET_PREFERENCE_KEY, JSON.stringify(next))
  } catch (e) {
    console.error('Failed to save set preference', e)
  }
  return next
}
