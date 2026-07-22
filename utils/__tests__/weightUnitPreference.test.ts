import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  LAST_WEIGHT_UNIT_KEY,
  loadLastWeightUnits,
  recordLastWeightUnit,
} from '../weightUnitPreference'

describe('weightUnitPreference', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    jest.clearAllMocks()
  })

  describe('loadLastWeightUnits', () => {
    it('returns an empty map when nothing is stored', async () => {
      expect(await loadLastWeightUnits()).toEqual({})
    })

    it('reads back a stored map', async () => {
      await AsyncStorage.setItem(
        LAST_WEIGHT_UNIT_KEY,
        JSON.stringify({ squat: 'plates', curl: 'kg' }),
      )
      expect(await loadLastWeightUnits()).toEqual({
        squat: 'plates',
        curl: 'kg',
      })
    })

    it('drops entries that are not a known unit', async () => {
      await AsyncStorage.setItem(
        LAST_WEIGHT_UNIT_KEY,
        JSON.stringify({ squat: 'plates', bad: 'lbs', empty: null }),
      )
      expect(await loadLastWeightUnits()).toEqual({ squat: 'plates' })
    })

    it('returns an empty map for corrupt JSON instead of throwing', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
      await AsyncStorage.setItem(LAST_WEIGHT_UNIT_KEY, 'not json{')
      expect(await loadLastWeightUnits()).toEqual({})
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })

    it('returns an empty map when the stored value is not an object', async () => {
      await AsyncStorage.setItem(LAST_WEIGHT_UNIT_KEY, JSON.stringify('kg'))
      expect(await loadLastWeightUnits()).toEqual({})
    })
  })

  describe('recordLastWeightUnit', () => {
    it('persists the choice and returns the merged map', async () => {
      const map = await recordLastWeightUnit('squat', 'plates')
      expect(map).toEqual({ squat: 'plates' })
      expect(await loadLastWeightUnits()).toEqual({ squat: 'plates' })
    })

    it('merges without clobbering other exercises', async () => {
      await recordLastWeightUnit('squat', 'plates')
      const map = await recordLastWeightUnit('curl', 'kg')
      expect(map).toEqual({ squat: 'plates', curl: 'kg' })
      expect(await loadLastWeightUnits()).toEqual({
        squat: 'plates',
        curl: 'kg',
      })
    })

    it('overwrites the unit for the same exercise', async () => {
      await recordLastWeightUnit('squat', 'kg')
      const map = await recordLastWeightUnit('squat', 'plates')
      expect(map).toEqual({ squat: 'plates' })
      expect(await loadLastWeightUnits()).toEqual({ squat: 'plates' })
    })

    it('merges onto an existing choice made by another device copy', async () => {
      // Simulates a value already in storage that the in-memory map wouldn't
      // know about — recording still preserves it.
      await AsyncStorage.setItem(
        LAST_WEIGHT_UNIT_KEY,
        JSON.stringify({ bench: 'kg' }),
      )
      const map = await recordLastWeightUnit('squat', 'plates')
      expect(map).toEqual({ bench: 'kg', squat: 'plates' })
    })
  })
})
