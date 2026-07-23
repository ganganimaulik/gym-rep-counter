import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  SET_PREFERENCE_KEY,
  loadSetPreferences,
  recordSetPreference,
} from '../exerciseSetPreference'

describe('exerciseSetPreference', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    jest.clearAllMocks()
  })

  describe('loadSetPreferences', () => {
    it('returns an empty map when nothing is stored', async () => {
      expect(await loadSetPreferences()).toEqual({})
    })

    it('reads back a stored map', async () => {
      await AsyncStorage.setItem(
        SET_PREFERENCE_KEY,
        JSON.stringify({
          squat: { weightUnit: 'plates', reps: 5 },
          curl: { weightUnit: 'kg', reps: 12 },
        }),
      )
      expect(await loadSetPreferences()).toEqual({
        squat: { weightUnit: 'plates', reps: 5 },
        curl: { weightUnit: 'kg', reps: 12 },
      })
    })

    it('drops invalid units and non-positive/invalid reps', async () => {
      await AsyncStorage.setItem(
        SET_PREFERENCE_KEY,
        JSON.stringify({
          a: { weightUnit: 'lbs', reps: 8 }, // bad unit, good reps
          b: { weightUnit: 'kg', reps: 0 }, // good unit, bad reps
          c: { weightUnit: 'kg', reps: -3 },
          d: { weightUnit: 'plates', reps: 'ten' },
          e: { weightUnit: 'bad', reps: null }, // nothing valid → dropped
        }),
      )
      expect(await loadSetPreferences()).toEqual({
        a: { reps: 8 },
        b: { weightUnit: 'kg' },
        c: { weightUnit: 'kg' },
        d: { weightUnit: 'plates' },
      })
    })

    it('returns an empty map for corrupt JSON instead of throwing', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
      await AsyncStorage.setItem(SET_PREFERENCE_KEY, 'not json{')
      expect(await loadSetPreferences()).toEqual({})
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })
  })

  describe('recordSetPreference', () => {
    it('persists the choice and returns the merged map', async () => {
      const map = await recordSetPreference('squat', {
        weightUnit: 'plates',
        reps: 5,
      })
      expect(map).toEqual({ squat: { weightUnit: 'plates', reps: 5 } })
      expect(await loadSetPreferences()).toEqual({
        squat: { weightUnit: 'plates', reps: 5 },
      })
    })

    it('merges fields for the same exercise without wiping the other', async () => {
      await recordSetPreference('squat', { weightUnit: 'plates', reps: 5 })
      // Recording only reps must keep the remembered unit.
      const afterReps = await recordSetPreference('squat', { reps: 8 })
      expect(afterReps.squat).toEqual({ weightUnit: 'plates', reps: 8 })
      // Recording only the unit must keep the remembered reps.
      const afterUnit = await recordSetPreference('squat', { weightUnit: 'kg' })
      expect(afterUnit.squat).toEqual({ weightUnit: 'kg', reps: 8 })
    })

    it('does not clobber other exercises', async () => {
      await recordSetPreference('squat', { weightUnit: 'plates', reps: 5 })
      const map = await recordSetPreference('curl', {
        weightUnit: 'kg',
        reps: 12,
      })
      expect(map).toEqual({
        squat: { weightUnit: 'plates', reps: 5 },
        curl: { weightUnit: 'kg', reps: 12 },
      })
    })

    it('merges onto a value already in storage from another copy', async () => {
      await AsyncStorage.setItem(
        SET_PREFERENCE_KEY,
        JSON.stringify({ bench: { weightUnit: 'kg', reps: 10 } }),
      )
      const map = await recordSetPreference('squat', { weightUnit: 'plates' })
      expect(map).toEqual({
        bench: { weightUnit: 'kg', reps: 10 },
        squat: { weightUnit: 'plates' },
      })
    })
  })
})
