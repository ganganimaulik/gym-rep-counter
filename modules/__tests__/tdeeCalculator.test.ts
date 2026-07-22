import {
  gapFillWeek,
  calculateWeeklyAverage,
  calculateRawTDEE,
  calculateSmoothedTDEE,
  calculateSeedTDEE,
  getEnergyPerUnit,
  getSeedMultiplier,
  mround,
  roundTDEE,
  roundDisplayTDEE,
  roundWeight,
  calculateDailyDeficit,
  calculateGoalCalories,
  calculateWeeksToGoal,
  calculateGoalDate,
  calculateTDEEPipeline,
  KCAL_PER_LB,
  KCAL_PER_KG,
  KJ_PER_LB,
  KJ_PER_KG,
  type WeekInput,
} from '../tdeeCalculator'

describe('tdeeCalculator', () => {
  // ---------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------
  describe('constants', () => {
    it('should have correct base constants', () => {
      expect(KCAL_PER_LB).toBe(3500)
      expect(KCAL_PER_KG).toBeCloseTo(3500 * 2.20462, 2)
      expect(KJ_PER_LB).toBeCloseTo(3500 * 4.184, 2)
      expect(KJ_PER_KG).toBeCloseTo(3500 * 2.20462 * 4.184, 2)
    })
  })

  // ---------------------------------------------------------------
  // Unit conversion
  // ---------------------------------------------------------------
  describe('getEnergyPerUnit', () => {
    it('returns 3500 for lb + cal', () => {
      expect(getEnergyPerUnit('lb', 'cal')).toBe(3500)
    })
    it('returns ~7716 for kg + cal', () => {
      expect(getEnergyPerUnit('kg', 'cal')).toBeCloseTo(7716.17, 1)
    })
    it('returns 14644 for lb + kj', () => {
      expect(getEnergyPerUnit('lb', 'kj')).toBe(14644)
    })
    it('returns ~32284 for kg + kj', () => {
      expect(getEnergyPerUnit('kg', 'kj')).toBeCloseTo(32284.46, 1)
    })
  })

  describe('getSeedMultiplier', () => {
    it('returns 13 for lb + cal', () => {
      expect(getSeedMultiplier('lb', 'cal')).toBe(13)
    })
    it('returns ~28.66 for kg + cal', () => {
      expect(getSeedMultiplier('kg', 'cal')).toBeCloseTo(28.66, 1)
    })
    it('returns ~54.39 for lb + kj', () => {
      expect(getSeedMultiplier('lb', 'kj')).toBeCloseTo(54.39, 1)
    })
    it('returns ~119.92 for kg + kj', () => {
      expect(getSeedMultiplier('kg', 'kj')).toBeCloseTo(119.92, 1)
    })
  })

  // ---------------------------------------------------------------
  // Rounding (MROUND)
  // ---------------------------------------------------------------
  describe('mround', () => {
    it('rounds to nearest 5', () => {
      expect(mround(2347, 5)).toBe(2345)
      expect(mround(2348, 5)).toBe(2350)
      expect(mround(2350, 5)).toBe(2350)
    })
    it('rounds to nearest 25', () => {
      expect(mround(2340, 25)).toBe(2350)
      expect(mround(2312, 25)).toBe(2300)
    })
    it('rounds to nearest 0.5', () => {
      expect(mround(180.3, 0.5)).toBe(180.5)
      expect(mround(180.1, 0.5)).toBe(180)
      expect(mround(180.75, 0.5)).toBe(181)
    })
  })

  describe('roundTDEE', () => {
    it('rounds to nearest 5', () => {
      expect(roundTDEE(2347)).toBe(2345)
      expect(roundTDEE(2348)).toBe(2350)
    })
  })

  describe('roundDisplayTDEE', () => {
    it('rounds to nearest 25', () => {
      expect(roundDisplayTDEE(2340)).toBe(2350)
      expect(roundDisplayTDEE(2312)).toBe(2300)
    })
  })

  describe('roundWeight', () => {
    it('rounds to nearest 0.5', () => {
      expect(roundWeight(180.3)).toBe(180.5)
      expect(roundWeight(180.1)).toBe(180)
    })
  })

  // ---------------------------------------------------------------
  // Seed TDEE
  // ---------------------------------------------------------------
  describe('calculateSeedTDEE', () => {
    it('calculates 180lb × 13 = 2340 (lb + cal)', () => {
      expect(calculateSeedTDEE(180, 'lb', 'cal')).toBe(2340)
    })
    it('calculates 80kg seed (kg + cal)', () => {
      // 80 × 28.66 = 2292.8 → MROUND(2292.8, 5) = 2295
      expect(calculateSeedTDEE(80, 'kg', 'cal')).toBe(2295)
    })
  })

  // ---------------------------------------------------------------
  // Gap-fill algorithm
  // ---------------------------------------------------------------
  describe('gapFillWeek', () => {
    it('returns null for all-empty week', () => {
      const result = gapFillWeek(
        [null, null, null, null, null, null, null],
        180,
      )
      expect(result).toBeNull()
    })

    it('carries forward from previous avg when first day is empty', () => {
      const result = gapFillWeek([null, null, 179, null, null, null, null], 180)
      expect(result).toEqual([180, 180, 179, 179, 179, 179, 179])
    })

    it('carries forward from previous day', () => {
      const result = gapFillWeek([181, null, null, 179, null, null, 178], 180)
      expect(result).toEqual([181, 181, 181, 179, 179, 179, 178])
    })

    it('uses all values when all days filled', () => {
      const result = gapFillWeek([180, 181, 180, 179, 180, 181, 180], 175)
      expect(result).toEqual([180, 181, 180, 179, 180, 181, 180])
    })

    it('fills from previousAvg when only first day has data', () => {
      const result = gapFillWeek([182, null, null, null, null, null, null], 180)
      expect(result).toEqual([182, 182, 182, 182, 182, 182, 182])
    })
  })

  // ---------------------------------------------------------------
  // Weekly average
  // ---------------------------------------------------------------
  describe('calculateWeeklyAverage', () => {
    it('averages gap-filled values', () => {
      const avg = calculateWeeklyAverage([180, 181, 180, 179, 180, 181, 180])
      expect(avg).toBeCloseTo(180.14, 1)
    })

    it('handles identical values', () => {
      expect(calculateWeeklyAverage([180, 180, 180, 180, 180, 180, 180])).toBe(
        180,
      )
    })
  })

  // ---------------------------------------------------------------
  // Raw TDEE
  // ---------------------------------------------------------------
  describe('calculateRawTDEE', () => {
    it('calculates TDEE with weight loss (lb + cal)', () => {
      // Lost 1 lb over the week:
      // TDEE = 2000 + ((-(-1) × 3500) / 7) = 2000 + 500 = 2500
      const tdee = calculateRawTDEE(2000, -1, 3500, 7)
      expect(tdee).toBe(2500)
    })

    it('calculates TDEE with weight gain (lb + cal)', () => {
      // Gained 0.5 lb:
      // TDEE = 2500 + ((-(0.5) × 3500) / 7) = 2500 - 250 = 2250
      const tdee = calculateRawTDEE(2500, 0.5, 3500, 7)
      expect(tdee).toBe(2250)
    })

    it('calculates TDEE with no weight change', () => {
      // No change: TDEE = avg calories
      const tdee = calculateRawTDEE(2200, 0, 3500, 7)
      expect(tdee).toBe(2200)
    })

    it('works with kg + cal units', () => {
      // Lost 0.5 kg:
      // TDEE = 1800 + ((-(-.5) × 7716.17) / 7) = 1800 + 551.15 = 2351.15
      const tdee = calculateRawTDEE(1800, -0.5, KCAL_PER_KG, 7)
      expect(tdee).toBeCloseTo(2351.15, 0)
    })
  })

  // ---------------------------------------------------------------
  // Smoothed TDEE
  // ---------------------------------------------------------------
  describe('calculateSmoothedTDEE', () => {
    it('returns raw TDEE when no previous data', () => {
      expect(calculateSmoothedTDEE(2500, [], 12)).toBe(2500)
    })

    it('averages with previous values', () => {
      // (2400 + 2500) / 2 = 2450
      expect(calculateSmoothedTDEE(2500, [2400], 12)).toBe(2450)
    })

    it('respects window size', () => {
      const prev = [2000, 2100, 2200]
      // Window = 2: only take last 1 previous + current
      // (2200 + 2300) / 2 = 2250
      expect(calculateSmoothedTDEE(2300, prev, 2)).toBe(2250)
    })

    it('uses all available data when less than window', () => {
      const prev = [2000, 2100]
      // All 3 values: (2000 + 2100 + 2200) / 3 = 2100
      expect(calculateSmoothedTDEE(2200, prev, 12)).toBeCloseTo(2100, 0)
    })
  })

  // ---------------------------------------------------------------
  // Goal projection
  // ---------------------------------------------------------------
  describe('calculateDailyDeficit', () => {
    it('calculates 500 cal/day for 1 lb/week', () => {
      expect(calculateDailyDeficit(1, 3500)).toBe(500)
    })

    it('calculates deficit for 0.5 lb/week', () => {
      expect(calculateDailyDeficit(0.5, 3500)).toBe(250)
    })

    it('rounds to nearest 5', () => {
      // 0.75 lb/wk × 3500 / 7 = 375 → already divisible by 5
      expect(calculateDailyDeficit(0.75, 3500)).toBe(375)
    })
  })

  describe('calculateGoalCalories', () => {
    it('subtracts deficit for cutting', () => {
      expect(calculateGoalCalories(2500, 180, 170, 500)).toBe(2000)
    })

    it('adds surplus for bulking', () => {
      expect(calculateGoalCalories(2500, 150, 170, 500)).toBe(3000)
    })

    it('returns TDEE for maintenance', () => {
      expect(calculateGoalCalories(2500, 170, 170, 500)).toBe(2500)
    })
  })

  describe('calculateWeeksToGoal', () => {
    it('calculates 10 weeks for 10 lb at 1 lb/week', () => {
      expect(calculateWeeksToGoal(180, 170, 1)).toBe(10)
    })

    it('calculates with 0.5 ceiling rounding', () => {
      // 7 lb at 2 lb/week = 3.5 weeks → already 0.5 multiple
      expect(calculateWeeksToGoal(180, 173, 2)).toBe(3.5)
    })

    it('returns 0 when at goal', () => {
      expect(calculateWeeksToGoal(170, 170, 1)).toBe(0)
    })

    it('works for weight gain goals', () => {
      expect(calculateWeeksToGoal(150, 160, 1)).toBe(10)
    })
  })

  describe('calculateGoalDate', () => {
    it('adds correct days', () => {
      const fromDate = new Date('2024-01-01')
      const goalDate = calculateGoalDate(10, fromDate)
      expect(goalDate.getTime()).toBeGreaterThan(fromDate.getTime())
      // 10 weeks = 70 days
      const daysDiff = Math.round(
        (goalDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
      )
      expect(daysDiff).toBe(70)
    })
  })

  // ---------------------------------------------------------------
  // Full pipeline
  // ---------------------------------------------------------------
  describe('calculateTDEEPipeline', () => {
    it('returns seed TDEE when no data', () => {
      const result = calculateTDEEPipeline([], {
        startingWeight: 180,
        weightUnit: 'lb',
        energyUnit: 'cal',
      })

      expect(result.seedTDEE).toBe(2340) // 180 × 13
      expect(result.currentTDEE).toBeNull()
      expect(result.weeks).toHaveLength(0)
    })

    it('calculates TDEE for a single week', () => {
      const weeks: WeekInput[] = [
        {
          weekStart: new Date('2024-01-01'),
          dailyWeights: [180, 180, 179, 179, 179, 178, 178],
          dailyCalories: [2000, 2100, 1900, 2000, 2200, 1800, 2000],
        },
      ]

      const result = calculateTDEEPipeline(weeks, {
        startingWeight: 180,
        weightUnit: 'lb',
        energyUnit: 'cal',
      })

      expect(result.weeks).toHaveLength(1)
      expect(result.weeks[0].avgWeight).toBeCloseTo(179, 0)
      expect(result.weeks[0].avgCalories).toBe(2000)
      expect(result.weeks[0].displayTDEE).not.toBeNull()
      // First week delta is measured against startingWeight (AT12 = AS12 - AM6):
      // 179 - 180 = -1 lb → TDEE = 2000 + (1 × 3500) / 7 = 2500
      expect(result.weeks[0].weightDelta).toBeCloseTo(-1, 5)
      expect(result.weeks[0].displayTDEE!).toBe(2500)
    })

    it('calculates smoothed TDEE over multiple weeks', () => {
      const weeks: WeekInput[] = [
        {
          weekStart: new Date('2024-01-01'),
          dailyWeights: [180, 180, 180, 180, 180, 180, 180],
          dailyCalories: [2000, 2000, 2000, 2000, 2000, 2000, 2000],
        },
        {
          weekStart: new Date('2024-01-08'),
          dailyWeights: [179, 179, 179, 179, 179, 179, 179],
          dailyCalories: [2000, 2000, 2000, 2000, 2000, 2000, 2000],
        },
        {
          weekStart: new Date('2024-01-15'),
          dailyWeights: [178, 178, 178, 178, 178, 178, 178],
          dailyCalories: [2000, 2000, 2000, 2000, 2000, 2000, 2000],
        },
      ]

      const result = calculateTDEEPipeline(weeks, {
        startingWeight: 180,
        weightUnit: 'lb',
        energyUnit: 'cal',
        smoothingWindowWeeks: 12,
      })

      expect(result.weeks).toHaveLength(3)
      // Each week loses 1 lb at 2000 cal intake → TDEE = 2000 + 500 = 2500
      result.weeks.forEach((w) => {
        expect(w.displayTDEE).not.toBeNull()
      })

      expect(result.currentTDEE).not.toBeNull()
      expect(result.currentWeight).toBe(178)
    })

    it('handles gap-filled weeks correctly', () => {
      const weeks: WeekInput[] = [
        {
          weekStart: new Date('2024-01-01'),
          // Only 3 days of weight data
          dailyWeights: [180, null, null, 179, null, null, null],
          dailyCalories: [2000, null, null, 2100, null, null, null],
        },
      ]

      const result = calculateTDEEPipeline(weeks, {
        startingWeight: 180,
        weightUnit: 'lb',
        energyUnit: 'cal',
      })

      expect(result.weeks).toHaveLength(1)
      // Gap-filled weights: [180, 180, 180, 179, 179, 179, 179]
      expect(result.weeks[0].gapFilledWeights).toEqual([
        180, 180, 180, 179, 179, 179, 179,
      ])
      expect(result.weeks[0].avgWeight).not.toBeNull()
    })

    it('includes goal projection when configured', () => {
      const weeks: WeekInput[] = [
        {
          weekStart: new Date('2024-01-01'),
          dailyWeights: [180, 180, 180, 180, 180, 180, 180],
          dailyCalories: [2000, 2000, 2000, 2000, 2000, 2000, 2000],
        },
        {
          weekStart: new Date('2024-01-08'),
          dailyWeights: [179, 179, 179, 179, 179, 179, 179],
          dailyCalories: [2000, 2000, 2000, 2000, 2000, 2000, 2000],
        },
      ]

      const result = calculateTDEEPipeline(weeks, {
        startingWeight: 180,
        weightUnit: 'lb',
        energyUnit: 'cal',
        goalWeight: 170,
        goalWeeklyRate: 1,
      })

      expect(result.goalCalories).not.toBeNull()
      expect(result.dailyDeficit).toBe(500) // 1 lb/wk × 3500 / 7
      expect(result.weeksToGoal).not.toBeNull()
      expect(result.goalDate).not.toBeNull()
    })

    it('works with kg + cal units', () => {
      const weeks: WeekInput[] = [
        {
          weekStart: new Date('2024-01-01'),
          dailyWeights: [80, 80, 80, 80, 80, 80, 80],
          dailyCalories: [2000, 2000, 2000, 2000, 2000, 2000, 2000],
        },
        {
          weekStart: new Date('2024-01-08'),
          dailyWeights: [79.5, 79.5, 79.5, 79.5, 79.5, 79.5, 79.5],
          dailyCalories: [2000, 2000, 2000, 2000, 2000, 2000, 2000],
        },
      ]

      const result = calculateTDEEPipeline(weeks, {
        startingWeight: 80,
        weightUnit: 'kg',
        energyUnit: 'cal',
      })

      expect(result.seedTDEE).toBe(2295) // 80 × 28.66 → mround(2292.8, 5) = 2295
      expect(result.currentWeight).toBe(79.5)
      expect(result.weeks[1].displayTDEE).not.toBeNull()
    })

    it('works with energyUnit kj', () => {
      const weeks: WeekInput[] = [
        {
          weekStart: new Date('2024-01-01'),
          dailyWeights: [180, 180, 180, 180, 180, 180, 180],
          dailyCalories: [8368, 8368, 8368, 8368, 8368, 8368, 8368], // ~2000 cal in kj
        },
      ]

      const result = calculateTDEEPipeline(weeks, {
        startingWeight: 180,
        weightUnit: 'lb',
        energyUnit: 'kj',
      })

      expect(result.seedTDEE).toBeGreaterThan(9000)
      expect(result.weeks[0].displayTDEE).not.toBeNull()
    })
  })
})
