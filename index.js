import { registerRootComponent } from 'expo'
import { importGlobalCSS } from './utils/cssImport'

importGlobalCSS()

import App from './App'

// Demo builds only (EXPO_PUBLIC_DEMO_MODE=1, see utils/demoMode.ts): seed this browser before the
// app first reads storage. Every other build compiles the branch, and the demo data, out.
if (process.env.EXPO_PUBLIC_DEMO_MODE === '1') {
  require('./utils/demoData').startDemo()
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App)
