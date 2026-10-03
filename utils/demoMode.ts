import { Platform, type AccessibilityProps } from 'react-native'

/**
 * A demo build: the web app built with EXPO_PUBLIC_DEMO_MODE=1 for DemoPilot, which demos it in a
 * fresh browser per visitor (seeded by utils/demoData.ts before the app mounts). The flag is never
 * set for a build people use, so everything gated on it is absent from theirs.
 */
export const DEMO_MODE =
  Platform.OS === 'web' && process.env.EXPO_PUBLIC_DEMO_MODE === '1'

export type DemoHint = Pick<
  AccessibilityProps,
  'role' | 'aria-label' | 'aria-checked'
>

const NO_HINT: DemoHint = {}

/**
 * Accessibility hints for DemoPilot, whose agent reads the page the way a screen reader does: a
 * name for an icon button or a field, a role for a heading, a card of numbers or a choice. Spread
 * onto a component; outside a demo build it's empty, so those builds render exactly as before.
 */
export const demoHint = (hint: DemoHint): DemoHint =>
  DEMO_MODE ? hint : NO_HINT
