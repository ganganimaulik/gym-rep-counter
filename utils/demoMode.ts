import { Platform } from 'react-native'

/**
 * A demo build: the web app built with EXPO_PUBLIC_DEMO_MODE=1 for DemoPilot, which demos it in a
 * fresh browser per visitor (seeded by utils/demoData.ts before the app mounts). The flag is never
 * set for a build people use, so everything gated on it is absent from theirs.
 */
export const DEMO_MODE =
  Platform.OS === 'web' && process.env.EXPO_PUBLIC_DEMO_MODE === '1'
