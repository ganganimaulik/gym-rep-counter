import React from 'react'
import { Platform } from 'react-native'

import { toLocalYMD } from '../utils/analyticsUtils'

interface WebDatePickerProps {
  value: Date
  onChange: (date: Date) => void
  testID?: string
  accessibilityLabel?: string
  // Web CSS, not an RN style: overrides the default cover-the-parent geometry
  style?: React.CSSProperties
}

/**
 * Applies an `<input type="date">` value (a local `YYYY-MM-DD`) to `base`,
 * keeping base's time of day as the native pickers do. Returns null for the
 * empty value a cleared input reports.
 */
export function applyDateInputValue(value: string, base: Date): Date | null {
  const match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const next = new Date(base)
  next.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return next
}

// Invisible and stretched over the parent (RN views are position: relative),
// so the parent row is what shows and what gets tapped. 16px text keeps iOS
// Safari from zooming the page when the input takes focus.
const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  margin: 0,
  padding: 0,
  border: 0,
  opacity: 0,
  cursor: 'pointer',
  fontSize: 16,
  colorScheme: 'dark',
}

/**
 * Web stand-in for DateTimePicker, which has no web implementation: it
 * renders null there, so a row that opens it is a dead button.
 *
 * Renders the browser's own date input, invisible, over its parent, so a tap
 * anywhere on the parent row opens the browser's picker. Nesting it in a
 * Touchable is fine: RNW's press responder never cancels the input's default
 * click (the Touchable's onPress still fires). Renders nothing on native.
 */
const WebDatePicker: React.FC<WebDatePickerProps> = ({
  value,
  onChange,
  testID,
  accessibilityLabel,
  style,
}) => {
  if (Platform.OS !== 'web') return null

  return (
    <input
      type="date"
      data-testid={testID}
      aria-label={accessibilityLabel}
      value={toLocalYMD(value)}
      onChange={(event) => {
        const date = applyDateInputValue(event.target.value, value)
        if (date) onChange(date)
      }}
      onClick={(event) => {
        // Desktop browsers open the picker only from the input's own (here
        // invisible) calendar icon; mobile opens it on any tap.
        try {
          event.currentTarget.showPicker()
        } catch {
          // Unsupported or already open; the input still takes focus.
        }
      }}
      style={{ ...overlayStyle, ...style }}
    />
  )
}

export default WebDatePicker
