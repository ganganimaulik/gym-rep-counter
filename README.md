# Exercise Rep Counter

A feature-packed React Native app built with Expo (SDK 54) and React Native 0.81 for tracking gym workouts with timed concentric and eccentric rep phases. It keeps counting and displaying timers even when the screen is locked, leveraging iOS Live Activities and Android Foreground Services.

Supported platforms: **iOS** (native build with Live Activity), **Android** (native build with Foreground Service), and **Web** (Vercel deployment & Playwright E2E target).

---

## Key Features

- **Timed Rep Phases**: Dedicated concentric, eccentric, and rest phase timers with audio cues and Speech API integration.
- **Background & Lock-Screen Support**: Native Live Activity on iOS and Foreground Service on Android to keep rest and rep timers accurate even when the screen is locked or the app is backgrounded.
- **Offline-First Data Layer**: Seamless synchronization between local storage (AsyncStorage) and Firebase Auth + Firestore, queuing writes when offline.
- **TDEE & Body Analytics**: Cell-for-cell port of TDEE calculation models for weight and calorie tracking, plus workout volume and PR analytics.
- **Cross-Platform**: Web support exported via Expo Web for desktop/mobile browsers.

---

## Prerequisites

- **Node.js**: Recommended Node.js v18.x or v20.x+.
- **macOS & Xcode** _(for iOS)_: macOS with Xcode installed to compile native iOS builds and run the iOS simulator.
- **Android Studio** _(for Android)_: Android SDK and emulators set up to compile native Android builds.

> [!WARNING]
> **Expo Go is NOT supported.**
> This app uses custom local native modules (`modules/workout-activity` and `modules/workout-attributes`). You must run native development builds using `npm run ios` or `npm run android` rather than Expo Go.

---

## Getting Started

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/ganganimaulik/gym-rep-counter.git
cd gym-rep-counter
npm install
```

### 2. Running the App

#### Web Development

Start the Metro server for web on port `8081`:

```bash
npm run web
```

To run a safe browser session using the local Firebase emulator and mock authentication:

```bash
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true EXPO_PUBLIC_PLAYWRIGHT=1 npm run web
```

#### iOS Native (Simulator / Device)

Prebuilds native projects and launches the app in the iOS simulator:

```bash
npm run ios
```

For physical iOS device deployment:

```bash
npm run rebuild
```

_Note: Ensure `scripts/set-team-id.js` has your Apple Developer Team ID configured._

#### Android Native (Emulator / Device)

Prebuilds native projects and launches on Android:

```bash
npm run android
```

---

## Firebase Local Emulator (Docker)

Local development and E2E testing use the Firebase Emulator Suite (Firestore, Auth, and UI).

Start the emulator via Docker helper scripts:

```bash
# Start Firebase Emulator (UI :4000, Firestore :8080, Auth :9099)
./scripts/run-emulator.sh start

# Stop Firebase Emulator
./scripts/run-emulator.sh stop

# Clear Firestore documents and Auth accounts without restarting
./scripts/run-emulator.sh clear
```

Alternatively, run tests directly using local `firebase-tools`:

```bash
npx --yes firebase-tools emulators:exec --project gym-rep-counter "npx playwright test"
```

---

## Testing & Code Quality

### Type Checking & Linting

```bash
# Run TypeScript type check
npx tsc --noEmit

# Run ESLint (with auto-fix)
npm run lint

# Format codebase with Prettier
npm run format
```

### Unit & Integration Testing (Jest)

```bash
# Run full Jest test suite
npm test

# Run tests with coverage
npm run coverage

# Run a specific test file
npx jest utils/__tests__/setDeletion.test.ts
```

### End-to-End Testing (Playwright)

```bash
# Run all E2E specs
npx playwright test

# Run a specific spec in list mode
npx playwright test e2e/workout.spec.ts --reporter=list
```

### Tailwind CSS Compilation (NativeWind v2)

If you add new Tailwind utility classes, regenerate the compiled `styles.css`:

```bash
npx tailwindcss -i global.css -o styles.css && npx prettier --write styles.css
```

---

## Project Structure

```
├── App.tsx                    # Main app shell & root state management
├── index.js                   # Application entry point
├── components/                # React Native UI components by tab screen
│   ├── workout/               # Workout timer & set management components
│   ├── routines/              # Routine creation & management
│   ├── history/               # Workout history & log views
│   ├── analytics/             # Progress charts & TDEE analytics
│   ├── settings/              # App & audio settings
│   └── journal/               # Daily journal & supplement tracking
├── hooks/                     # Custom React hooks
│   ├── useWorkoutTimer.ts     # Core timing machine (wState, UI, Reanimated)
│   ├── useAudio.ts            # Speech synthesis queue & audio session management
│   ├── useData.ts             # Offline-first Firestore + AsyncStorage data layer
│   ├── useAuth.ts             # Firebase Authentication & mock user logic
│   ├── useTDEE.ts             # TDEE calculation & weight/calorie data
│   └── useAnalytics.ts        # Workout history metrics & streak calculations
├── modules/                   # Local native & logic modules
│   ├── workout-activity/      # Native bridge for iOS Live Activity / Android Foreground Service
│   ├── workout-attributes/    # iOS ActivityAttributes definition for Widget extension
│   └── tdeeCalculator.ts      # Pure TDEE math engine
├── targets/                   # Native iOS targets (Live Activity Widget Extension)
├── utils/                     # Helper utilities (exercise timing, firebase setup, etc.)
├── e2e/                       # Playwright E2E spec files
└── scripts/                   # Native build and emulator management scripts
```

---

## Build & Deployment

- **Web Deployment**: Configured for [Vercel](https://vercel.com/) via `vercel.json` (`npx expo export -p web` outputting to `dist/`).
- **Native iOS / Android**: Generated via Expo prebuild (`npm run prebuild`) and compiled natively using standard iOS Xcode workspace / Android Gradle pipelines.
