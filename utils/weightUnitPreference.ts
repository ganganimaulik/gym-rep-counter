import AsyncStorage from '@react-native-async-storage/async-storage'
import type { WeightUnit } from '../declarations'

// Per-exercise memory of the last weight unit the user logged a set in, keyed
// by exercise id. Purely a UI convenience: it pre-selects the unit in the
// "Set Complete" modal so the user doesn't re-pick it every set. Device-local
// and not synced — it mirrors a UI interaction, not core workout data.
export const LAST_WEIGHT_UNIT_KEY = 'lastWeightUnitByExercise'

const isWeightUnit = (v: unknown): v is WeightUnit =>
  v === 'kg' || v === 'plates'

// Read the saved map, dropping any entry that isn't a known unit so a corrupt
// or partially-written value can't feed a bad default into the modal.
export const loadLastWeightUnits = async (): Promise<
  Record<string, WeightUnit>
> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_WEIGHT_UNIT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const result: Record<string, WeightUnit> = {}
    for (const [id, unit] of Object.entries(parsed)) {
      if (isWeightUnit(unit)) result[id] = unit
    }
    return result
  } catch (e) {
    console.error('Failed to load last weight units', e)
    return {}
  }
}

// Record the unit chosen for one exercise and return the merged map. Reads
// storage first so a stale in-memory copy (or a concurrent write for another
// exercise) can't clobber other exercises' remembered units.
export const recordLastWeightUnit = async (
  exerciseId: string,
  unit: WeightUnit,
): Promise<Record<string, WeightUnit>> => {
  const current = await loadLastWeightUnits()
  const next = { ...current, [exerciseId]: unit }
  try {
    await AsyncStorage.setItem(LAST_WEIGHT_UNIT_KEY, JSON.stringify(next))
  } catch (e) {
    console.error('Failed to save last weight unit', e)
  }
  return next
}
