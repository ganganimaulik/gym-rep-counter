import React from 'react'
import { ActivityIndicator } from 'react-native'
import { render } from '@testing-library/react-native'
import SplashScreen from '../SplashScreen'

const mockWithRepeat = jest.fn()
const mockWithTiming = jest.fn()

jest.mock('react-native-reanimated', () => {
  const ReactLib = require('react')
  const Reanimated = require('react-native-reanimated/mock')
  return {
    ...Reanimated,
    // The stock mock hands back a fresh proxy each render; real reanimated keeps
    // one stable mutable object, which is what effect dependency arrays rely on.
    useSharedValue: (init: unknown) => {
      const ref = ReactLib.useRef(null) as {
        current: { value: unknown } | null
      }
      if (ref.current === null) ref.current = { value: init }
      return ref.current
    },
    withRepeat: (...args: unknown[]) => {
      mockWithRepeat(...args)
      return Reanimated.withRepeat(...args)
    },
    withTiming: (...args: unknown[]) => {
      mockWithTiming(...args)
      return Reanimated.withTiming(...args)
    },
    useAnimatedStyle: jest
      .fn()
      .mockImplementation((style: () => unknown) => style()),
  }
})

jest.mock('lucide-react-native', () => {
  const ReactLib = require('react')
  const { View } = require('react-native')
  return new Proxy(
    {},
    {
      get: (_target, name) => (props: Record<string, unknown>) =>
        ReactLib.createElement(View, {
          ...props,
          testID: `icon-${String(name)}`,
        }),
    },
  )
})

// The seven quotes defined in SplashScreen, in source order.
const QUOTES = [
  'Train hard, track smart, grow stronger.',
  'Consistency is the key to unlocking your potential.',
  'What hurts today makes you stronger tomorrow.',
  'Focus on progress, not perfection.',
  'Success starts with self-discipline.',
  "The only bad workout is the one that didn't happen.",
  "Your body can stand almost anything. It's your mind you have to convince.",
]

describe('SplashScreen', () => {
  let randomSpy: jest.SpyInstance<number, []>

  beforeEach(() => {
    jest.clearAllMocks()
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    randomSpy.mockRestore()
  })

  describe('branding', () => {
    it('renders the app title split across the accented REP segment', () => {
      const { getByText } = render(<SplashScreen />)

      expect(getByText('GYM REP COUNTER')).toBeTruthy()
      expect(getByText('REP')).toBeTruthy()
    })

    it('renders the subtitle', () => {
      const { getByText } = render(<SplashScreen />)

      expect(getByText('Your Automated Workout Companion')).toBeTruthy()
    })

    it('renders the dumbbell logo icon', () => {
      const { getByTestId } = render(<SplashScreen />)

      expect(getByTestId('icon-Dumbbell')).toBeTruthy()
    })

    it('renders a loading indicator', () => {
      const { UNSAFE_getByType } = render(<SplashScreen />)

      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
    })
  })

  describe('quote selection', () => {
    it('renders the first quote in double quotes when random resolves to 0', () => {
      randomSpy.mockReturnValue(0)

      const { getByText } = render(<SplashScreen />)

      expect(getByText(`"${QUOTES[0]}"`)).toBeTruthy()
    })

    it('renders the last quote when random resolves near 1', () => {
      randomSpy.mockReturnValue(0.999)

      const { getByText } = render(<SplashScreen />)

      expect(getByText(`"${QUOTES[QUOTES.length - 1]}"`)).toBeTruthy()
    })

    it('never indexes past the end of the quote list', () => {
      // Math.random() is exclusive of 1, but guard the boundary anyway.
      randomSpy.mockReturnValue(0.9999999999)

      const { getByText } = render(<SplashScreen />)

      const rendered = QUOTES.filter((q) => {
        try {
          getByText(`"${q}"`)
          return true
        } catch {
          return false
        }
      })
      expect(rendered).toHaveLength(1)
    })

    it('keeps the same quote across re-renders', () => {
      randomSpy.mockReturnValue(0.5)
      const { getByText, rerender } = render(<SplashScreen />)

      const expected = `"${QUOTES[Math.floor(0.5 * QUOTES.length)]}"`
      expect(getByText(expected)).toBeTruthy()

      // A different random value must not change the memoized quote.
      randomSpy.mockReturnValue(0)
      rerender(<SplashScreen />)

      expect(getByText(expected)).toBeTruthy()
    })
  })

  describe('mount animations', () => {
    it('starts two infinite auto-reversing pulse animations', () => {
      render(<SplashScreen />)

      expect(mockWithRepeat).toHaveBeenCalledTimes(2)
      mockWithRepeat.mock.calls.forEach(([, iterations, reverse]) => {
        expect(iterations).toBe(-1)
        expect(reverse).toBe(true)
      })
    })

    it('pulses the logo scale up to 1.05 and the glow opacity up to 0.28', () => {
      render(<SplashScreen />)

      const targets = mockWithTiming.mock.calls.map(([toValue]) => toValue)
      expect(targets).toContain(1.05)
      expect(targets).toContain(0.28)
    })

    it('fades content in to full opacity and slides it to its resting offset', () => {
      render(<SplashScreen />)

      const opacityCall = mockWithTiming.mock.calls.find(
        ([toValue, config]) =>
          toValue === 1 && (config as { duration: number }).duration === 1000,
      )
      const translateCall = mockWithTiming.mock.calls.find(
        ([toValue, config]) =>
          toValue === 0 && (config as { duration: number }).duration === 1000,
      )

      expect(opacityCall).toBeDefined()
      expect(translateCall).toBeDefined()
    })

    it('does not restart the pulse animations on re-render', () => {
      const { rerender } = render(<SplashScreen />)
      expect(mockWithRepeat).toHaveBeenCalledTimes(2)

      rerender(<SplashScreen />)

      // Shared values are stable, so the mount effect must not re-run.
      expect(mockWithRepeat).toHaveBeenCalledTimes(2)
    })
  })

  it('renders without throwing and produces a tree', () => {
    const { toJSON } = render(<SplashScreen />)

    expect(toJSON()).toBeTruthy()
  })
})
