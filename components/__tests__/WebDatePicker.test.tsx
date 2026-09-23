import React from 'react'
import { render, act } from '@testing-library/react-native'
import { Platform } from 'react-native'

import WebDatePicker, { applyDateInputValue } from '../WebDatePicker'

describe('applyDateInputValue', () => {
  it('moves the date to the picked day, keeping its time of day', () => {
    const base = new Date(2026, 8, 24, 21, 45, 30, 500)

    expect(applyDateInputValue('2026-09-20', base)).toEqual(
      new Date(2026, 8, 20, 21, 45, 30, 500),
    )
  })

  it('does not mutate the base date', () => {
    const base = new Date(2026, 8, 24, 21, 45)

    applyDateInputValue('2026-09-20', base)

    expect(base).toEqual(new Date(2026, 8, 24, 21, 45))
  })

  it('crosses month and year boundaries without day overflow', () => {
    // Setting the month before the day would roll Jan 31 → "Feb 31" → Mar 3
    const base = new Date(2026, 0, 31, 8, 0)

    expect(applyDateInputValue('2026-02-15', base)).toEqual(
      new Date(2026, 1, 15, 8, 0),
    )
    expect(applyDateInputValue('2025-12-31', base)).toEqual(
      new Date(2025, 11, 31, 8, 0),
    )
  })

  it('returns null for the empty value of a cleared input', () => {
    expect(applyDateInputValue('', new Date())).toBeNull()
  })

  it('returns null for a value that is not YYYY-MM-DD', () => {
    expect(applyDateInputValue('2026-9-1', new Date())).toBeNull()
    expect(applyDateInputValue('09/20/2026', new Date())).toBeNull()
  })
})

describe('WebDatePicker', () => {
  it('renders nothing on native', () => {
    const { toJSON } = render(
      <WebDatePicker value={new Date()} onChange={jest.fn()} />,
    )

    expect(toJSON()).toBeNull()
  })

  describe('on web', () => {
    const originalOS = Platform.OS

    beforeEach(() => {
      Platform.OS = 'web'
    })

    afterEach(() => {
      Platform.OS = originalOS
    })

    const renderPicker = (value: Date, onChange = jest.fn()) => {
      const utils = render(
        <WebDatePicker value={value} onChange={onChange} testID="picker" />,
      )
      const input = utils.UNSAFE_getByProps({ 'data-testid': 'picker' })
      return { ...utils, input, onChange }
    }

    it('renders a date input holding the local calendar date', () => {
      const { input } = renderPicker(new Date(2026, 8, 24, 12, 0))

      expect(input.type).toBe('input')
      expect(input.props.type).toBe('date')
      expect(input.props.value).toBe('2026-09-24')
    })

    it.each([
      [0, 30],
      [23, 30],
    ])(
      'keeps the local day at %i:%i (a UTC date would shift it)',
      (hours, minutes) => {
        const { input } = renderPicker(new Date(2026, 8, 24, hours, minutes))

        expect(input.props.value).toBe('2026-09-24')
      },
    )

    it('reports a picked day as a Date keeping the time of day', () => {
      const { input, onChange } = renderPicker(new Date(2026, 8, 24, 21, 45))

      act(() => {
        input.props.onChange({ target: { value: '2026-09-20' } })
      })

      expect(onChange).toHaveBeenCalledWith(new Date(2026, 8, 20, 21, 45))
    })

    it('ignores a cleared input', () => {
      const { input, onChange } = renderPicker(new Date(2026, 8, 24))

      act(() => {
        input.props.onChange({ target: { value: '' } })
      })

      expect(onChange).not.toHaveBeenCalled()
    })

    it('opens the browser picker on click, tolerating browsers without one', () => {
      const { input } = renderPicker(new Date(2026, 8, 24))
      const showPicker = jest.fn()

      input.props.onClick({ currentTarget: { showPicker } })
      expect(showPicker).toHaveBeenCalled()

      expect(() =>
        input.props.onClick({
          currentTarget: {
            showPicker: () => {
              throw new Error('NotAllowedError')
            },
          },
        }),
      ).not.toThrow()
    })
  })
})
