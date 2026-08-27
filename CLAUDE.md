# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Expo SDK 54 / React Native 0.81 gym rep-counter that runs timed concentric/eccentric rep phases and keeps counting while the screen is locked. Ships to iOS device (with a Live Activity), Android, and web (Vercel — the web build is also the Playwright target). Firebase Auth + Firestore back an offline-first data layer. TypeScript strict, NativeWind v2, Jest + Playwright.

`.agents/AGENTS.md` is the repo's own rulebook — read it; it is short. Note that its claim that pre-commit hooks run formatting/linting is false (see Repo hygiene).

## Commands

### Run

```bash
npm install
```

- `npm start` — `expo start` (Metro + platform chooser)
- `npm run web` — `expo start --web` on :8081; the target Playwright drives
- `npm run ios` / `npm run android` — `expo run:ios` / `expo run:android`: **prebuild + native compile**, not Expo Go. Expo Go cannot run this app — `modules/workout-activity` and `modules/workout-attributes` are custom local native modules.
- Safe browser session against local data:
  ```bash
  EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true EXPO_PUBLIC_PLAYWRIGHT=1 npm run web
  ```
  A bare `npm run web` loads `.env`, which points at **production Firebase**.

### Check

- `npx tsc --noEmit` — typecheck (no npm script). Ignore `tsc_errors.log` at the repo root; it is a stale local artifact, not the baseline.
- `npx eslint . --ext .js,.jsx,.ts,.tsx` — read-only lint. `npm run lint` adds `--fix` and **mutates source**.
- `npm run format` — `prettier --write .` (no semicolons, single quotes, trailing commas, `bracketSameLine`).

### Jest

- `npm test` — full suite (~50 files) · `npm run coverage`
- `npx jest utils/__tests__/setDeletion.test.ts` — single file (the arg is a regex against the test path)
- `npx jest App.dynamicSets -t "blocks removing the last remaining set"` — single test (`-t` matches concatenated `describe` + `it`)
- `npm test -- hooks/__tests__/useWorkoutTimer.test.ts` — same via the npm script
- `npx jest --listTests` — confirm what Jest collects

### Playwright

- `npx playwright test` — full E2E. The `webServer` best-effort starts the Docker emulator, then runs `npm run web` with the `EXPO_PUBLIC_*` flags.
- `npx playwright test e2e/workout.spec.ts --reporter=list` — single spec. Always pass `--reporter=list`: the configured `html` reporter spawns a blocking report server on failure, and `video: 'on'` writes a video per test.
- `npx playwright test e2e/app.spec.ts -g "3. Workout Screen - Logging a completed set" --reporter=list` — single test
- `npx playwright test e2e/navigation.spec.ts --list` — enumerate without starting the server
- `npx playwright test --headed --workers=1` — serialize; `app.spec.ts` wipes the emulator and races the other specs locally (`fullyParallel: true`, uncapped workers; CI pins `workers: 1`)

### Firebase emulator (Docker)

`./scripts/run-emulator.sh {start|stop|clear}` — UI :4000, Firestore :8080, Auth :9099. **Must be run from the repo root** (it bind-mounts `$(pwd)`, which is how `firebase.json`/`firestore.rules` reach the container). `clear` wipes Firestore docs + Auth accounts without restarting.

Reproduce the CI E2E run without Docker:

```bash
npx --yes firebase-tools emulators:exec --project gym-rep-counter "npx playwright test"
```

### Web build

- `npx expo export -p web` → `dist/` (what `vercel.json` runs)
- CI-identical build (required before `CI=1 npx playwright test`, where `webServer` becomes `http-server dist`):
  ```bash
  EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true EXPO_PUBLIC_PLAYWRIGHT=1 EXPO_PUBLIC_API_KEY=test-api-key EXPO_PUBLIC_AUTH_DOMAIN=test-domain EXPO_PUBLIC_PROJECT_ID=test-project npx expo export -p web
  ```

### Native

- `npm run rebuild` — the canonical iOS device build: `set-team-id.js` → `pod install` → `xcodebuild` Release → `devicectl` install + launch. Run this after **any** native change.
- `npm run prebuild` — `expo prebuild --clean`, destructively regenerates the gitignored `ios/` and `android/`. Follow with `node scripts/set-team-id.js` before `xcodebuild`.
- `cd ios && pod install` — mandatory after touching any file under `modules/*/ios`: the podspecs glob their sources at install time, so a new Swift file is invisible to `xcodebuild` until pods are re-installed.
- `npx tailwindcss -i global.css -o styles.css && npx prettier --write styles.css` — see NativeWind below.

## Architecture

### Shell: no router

`index.js` → `importGlobalCSS()` → `registerRootComponent(App)`. Navigation is one `useState` in `App.tsx` (`currentTab: 'workout' | 'routines' | 'history' | 'analytics' | 'settings' | 'journal'`) plus a hand-rolled tab bar. There is no react-navigation. Deep links (`repcounterapp://workout`, opened by the Live Activity) only set the tab.

Three mounting strategies coexist and the difference matters:

- **workout** — conditionally rendered, so it unmounts on tab switch. Safe only because `useWorkoutTimer` lives in `App.tsx`: the timer, speech, keep-awake and Live Activity keep running. **Never move the timer hook into a screen.**
- **routines / settings** — `WorkoutManagementModal` / `SettingsModal` rendered with `visible={true}`; their `onClose` prop is dead. These are tabs, not overlays; the tab bar is the only way out. Don't add tests expecting a close affordance.
- **history / analytics / journal** — kept mounted under `display: 'none'` and handed `visible={currentTab === X}`. Each screen early-returns `null` when not visible, and `visible` doubles as the refresh trigger (compared against `historyVersion`). Any new always-mounted screen needs the same prop.

`App.tsx` owns everything shared across the timer, modals and screens, and delegates the rest to four hooks: `useAuth`, `useData`, `useAudio`, `useWorkoutTimer`. It also owns the guardrails — refusals surface through `Toast` (mounted once at App root), not `Alert`.

### Timer engine — `hooks/useWorkoutTimer.ts`

Three parallel representations of the same workout; knowing which owns what is the most important fact in this area:

1. **`wState` (ref)** — the real machine: `rep`, `set`, `phase` (`stopped|countdown|concentric|eccentric|rest`), `phaseStart`, `remainingTime`. All timing math reads this. Never renders.
2. **`ui` (state)** — the human projection: `phase` is a **display label** (`''`, `'Get Ready'`, `'Concentric'`, `'Eccentric'`, `'Rest'`) plus `isRunning/isPaused/isRestComplete/isExerciseComplete`. Drives React, the Live Activity effect, keep-awake and the audio session.
3. **Reanimated SharedValues** (`currentRep`, `currentSet`, `statusText`) — written per tick without re-rendering. `MainDisplay` reads them via `useAnimatedProps`/`useAnimatedReaction`; `NumberButton` highlights via `useAnimatedStyle`. Reading `.value` in a render body gives a stale number, and `currentSet` is an animated float — `App.tsx` rounds it.

The two `phase`s can legitimately disagree: rest is entered with `ui.isRunning: false`. **Anything meaning "a workout is in progress" must test `isRunning || isResting`.**

Nothing accumulates elapsed time — every tick recomputes from `Date.now() - phaseStart` and reschedules against the wall clock, so a tick that fires 10 s late still renders correctly. Pause works by rewriting the anchor (`phaseStart = Date.now() - elapsed`). Four independent mechanisms keep rest correct while backgrounded: `expo-background-timer` (wake lock / iOS background task), an inaudible looping `assets/silence.mp3` (iOS only — on Android any playback seizes audio focus), the native Live Activity countdown driven off the absolute `restStartTimestamp`, and a scheduled local notification as last resort. Because of throttling, the rest-target announcement is `>= restSeconds` behind a one-shot flag, never `===`.

Set completion flows: timer → `onSetComplete` → `App.handleSetComplete` opens `AddSetDetailsModal` **and immediately calls `continueToNextPhaseRef.current()`** so rest starts before the user types. That ref exists to break a cycle (`handleSetComplete` is an argument to the hook that returns `continueToNextPhase`) — don't "clean it up". Exercise completion is a flag (`ui.isExerciseComplete`) that an App effect consumes and then resets.

`utils/exerciseTiming.ts::resolveExerciseTiming` merges per-exercise overrides over global `Settings` and **returns the identical settings object when nothing is overridden** — that identity is a contract the hook's `useMemo` depends on to keep every phase `useCallback` stable. Invalid overrides are ignored, not clamped.

### Audio — `hooks/useAudio.ts`

Two orthogonal machines. **The speech queue**: every utterance must settle exactly once (`onDone` / `onStopped` / `onError` / a 10 s watchdog); miss a path and the queue jams permanently _and_ other apps stay ducked forever, because the duck release lives inside `settle`. `priority: true` stops speech and wipes the queue — and eccentric countdown cues are unconditionally priority, so nothing queued survives an eccentric phase. **The session**: `idle | keepAlive | ducking`, chosen in `App.tsx` from `isRunning ? 'ducking' : isResting ? 'keepAlive' : 'idle'`, with an 800 ms speech-duck tail layered on top. `applySessionMode` should stay the funnel for `Audio.setAudioModeAsync`, and its play/pause ordering is load-bearing on iOS (enter: pause → setAudioMode → play; leave: setAudioMode → pause) — both orders are asserted by tests. Transitions are serialized through a promise chain because modes flip faster than one completes.

`settings.volume` is passed to every `Speech.speak` call, but stock expo-speech only honours `volume` on web — its iOS `SpeechOptions` Record and Android `SpeechOptions` data class have no such field, so the value was silently dropped on device. `patches/expo-speech+14.0.7.patch` adds it (iOS `utterance.volume`, Android `KEY_PARAM_VOLUME` in the `speak` params `Bundle`); without the patch applied the Volume slider does nothing on native.

### Data layer — `hooks/useData.ts`

2600 lines, called **exactly once** (in `App.tsx`), returned as one memoized object threaded down as props. No context, no store. Every mutator takes `user: FirebaseUser | null` as its **last argument** and branches `if (user) { …Firestore… } else { …AsyncStorage 'guest*' key… }`. Adding a persisted entity means writing both halves plus a `migrateGuest*`.

Firestore layout: one doc per user, `users/{uid}` with fields `email`, `name`, `settings`, `workouts`, `tdeeConfig`, and subcollections `history`, `weightLogs`, `calorieLogs`, `journalEntries`. `workouts` is a nested array **field**, not a subcollection. Doc ids are minted client-side before any network call, which is what makes offline retry idempotent. The DB is the **named** database `default` (`getFirestore(app, 'default')`), not `(default)` — any raw REST/admin tooling must say so or it reads an empty database.

**Never `await` a Firestore write as your commit point.** `utils/firebase.ts` configures no persistent cache, so offline write promises hang forever without rejecting (documented at `useData.ts:82-91`). Every signed-in write instead: update state → append to a persisted AsyncStorage queue → fire the write as background `void (async () => …)()` → dequeue only on server ack. Two queues: `offlineQueue` (history sets, append-only) and `pendingOps` (log docs + user-doc fields, **coalescing** — newest-write-wins per target so toggling a setting can't grow it unbounded). `syncOfflineQueue` flushes both in one `writeBatch` and removes only what it flushed. Consequence to know: `updateHistoryEntry`/`deleteHistoryEntry`/`resetSetsFrom` **do** await and have no retry queue, so those edits silently never land offline.

There are no `onSnapshot` listeners anywhere — reads are one-shot, refetched on auth change, on app foreground, and on explicit action. `syncUserData` (on sign-in) runs a fixed order: migrate guest stores → flush queues → create the user doc only if absent → **overwrite local state from the server**. So queue your writes before treating the server as truth. `components/SyncStatus.tsx` is not a sync indicator — it renders purely from `user != null`; nothing surfaces queue depth or failure.

### Live Activity / foreground service

One payload shape crosses the JS↔native boundary and it is **duplicated, not shared, in five places**. Adding a field means editing all five: `WorkoutActivityState` (`modules/workout-activity/index.ts`), `ContentState` **and its explicit `public init`** (`modules/workout-attributes/WorkoutAttributes.swift`), `parseContentState` (iOS module), the `putExtra` list (Android module), and the private var + extra getter (`WorkoutForegroundService.kt`). Miss the Swift init and it won't compile; miss an Android edit and the field silently defaults.

`modules/workout-attributes` exists only because ActivityKit requires the app process and the widget extension to compile the _same_ `ActivityAttributes` type — it declares no modules and its `index.ts` is a stub. It is linked into the app via the `workout-activity` podspec dependency and into the extension via `targets/widget/pods.rb`.

Both native countdowns are computed purely from the absolute `restStartTimestamp` (iOS `Text(timerInterval:)`, Android its own `CountDownTimer`), which is why `phaseStart` is back-dated on resume. Import `utils/workoutActivity.ts` from app code, not the module directly. Both layers swallow errors into `console.warn` — diagnose from the device log, where the Swift module `print()`s on every start/update/stop.

Everything in `targets/widget/` is compiled into the extension automatically (a `PBXFileSystemSynchronizedRootGroup` with only `Info.plist` and `expo-target.config.js` excepted), so `widgets.swift`/`AppIntent.swift`/`WidgetControl.swift` are unused boilerplate that still has to compile. `targets/widget/generated.entitlements` is git-tracked but regenerated by prebuild — edit `expo-target.config.js` instead.

### TDEE / analytics — the non-workout half

Two unrelated stacks that only share a screen. **TDEE**: `weightLogs` + `calorieLogs` → `hooks/useTDEE.ts` → `modules/tdeeCalculator.ts`, pure and synchronous, windowed to the last year. **Workout analytics**: Firestore `history` → `hooks/useAnalytics.ts` → `utils/analyticsUtils.ts`, windowed to 90 days (so `longestStreak` is structurally capped, not all-time). `ProgressScreen` hosts both and owns the weight/calorie edit modal that `TDEEScreen` calls back into.

`modules/tdeeCalculator.ts` is a **cell-for-cell port of "TDEE variant with bf 3.06.xlsx"**, the declared source of truth; every helper's JSDoc names the sheet cell it implements. Do not "improve" the math — changes must be justified against the sheet. Deliberate divergences to leave alone: body fat was intentionally dropped from the app; weeks are Mon–Sun; the rolling average intentionally compounds 5-rounding. There is exactly **one** intentional deviation from the sheet — fully-missing weight weeks are linearly interpolated (the sheet emits `#VALUE!` and defines no behavior there).

Supplements: a schedule is a field on the autocomplete suggestion in `settings.supplementSuggestions`; "taken" is inferred by scanning `journalEntries[].supplements[]` by lowercased name on a local date key. `scheduleActivatedDate` retroactively gates everything. `every_other_day` runs **two different algorithms** depending on whether the caller passes `journalEntries`, so bedtime reminders and the on-screen chips can disagree for the same day.

## Conventions and invariants

- **Local `YYYY-MM-DD` date keys are a repo-wide invariant.** The format is hand-rolled in five places (`utils/getLocalDateString.ts`, `analyticsUtils.toLocalYMD`, `supplementSchedule.getLocalDateKey`, `JournalScreen.getLocalDateKey`, and `HistoryScreen`'s section grouping). Everything is device-local, never UTC, and supplement retroactive-miss suppression plus last-session day ordering both rely on it sorting lexicographically. Changing the format anywhere breaks those silently.
- **The journal's "day" rolls over at the configured wake-up hour, not midnight.** `supplementSchedule.getJournalDateKey(date, rolloverHour)` attributes any moment before the wake-up (sleep-end) hour to the previous calendar date — same hand-rolled format, so sorting still works. `JournalScreen` gets the hour via its `dayRolloverHour` prop, resolved in `App.tsx` exactly like reminder notifications (auto-detected sleep window when `statRemindersUseAutoSleep` is on, else `statRemindersSleepEnd ?? 7`). All journal/supplement "today" logic (due/taken checks, entry grouping, missed cutoffs) takes the optional `rolloverHour` trailing param, which defaults to `0` = calendar-day; the bedtime-reminder builders deliberately use the default. Weight/calorie chips and TDEE stay calendar-keyed.
- **`kg` and `plates` are incommensurable** and must never be summed or compared. `PRRecord` is keyed `exerciseId::unit`, `VolumeData` carries separate `kgVolume`/`platesVolume`, trends return one series per unit. Sets predating the unit field count as `kg`. (Logs in the TDEE/journal half are stored as bare numbers with no unit and several labels hardcode kg/kcal — a unit switch reinterprets history.)
- **Omit optional fields, never set them to `undefined`.** The whole `workouts` array is written to Firestore as-is with no deep sanitizing, and one `undefined` throws the entire user-doc write. Tests assert `'countdownSeconds' in saved === false`.
- **Phase display strings are load-bearing machine state.** `isResting`, the Live Activity effect and the rest-notification cancel effect all derive rest-ness from the literal `'Rest'`; `statusText.value === 'Exercise Complete!'` decides whether `startWorkout` resets the machine; `MainDisplay` substring-matches the lowercased label for colors. Renaming a label silently breaks keep-awake, the widget, notifications and E2E.
- **Never call `getDefaultWorkouts()` to "refresh" workouts.** It mints new `randomUUID()`s every call, and `WorkoutSet.exerciseId` is a foreign key into those ids — regenerating orphans all prior history. Nine of ten E2E specs also hard-code its strings (`'Day 1 (Lower)'`, `'Leg Press'`, `'Target: 10 Reps'`), so even reordering it breaks the suite.
- **Session state vs persisted state.** `setDeltas` (on-the-fly extra sets) is in-memory only and cleared in `selectWorkout`; `activeExercise` is a derived clone with the bumped count, and everything downstream sees the clone, not the routine. `orderExercisesByCompletion` reorders only the local `currentWorkout` copy. Never persist either back into `workouts`. Long-press removal goes through `utils/setDeletion.ts`, which shrinks the session total rather than deleting a chosen slot.
- **`settings.maxReps`/`maxSets` are derived, not authored.** `App.tsx` pushes the active exercise's `reps`/`sets` into settings state on every exercise change (in-memory only). Pressing "Save Changes" in Settings therefore persists the current exercise's numbers as globals.
- **Persistence goes through `useData`** — no direct AsyncStorage or Firestore in components. Exceptions are deliberate and device-local: `utils/exerciseSetPreference.ts` and `activeWorkoutSession`.
- **NativeWind is v2.0.11** (`nativewind/babel`), so no `cssInterop`. Convention is a block of local `const StyledView = styled(View)` wrappers at the top of every file, including `styled(Animated.View)` / `styled(Animated.createAnimatedComponent(TextInput))`. `components/StyledText.tsx` exports a shared wrapper that nothing but its own test imports — don't start importing it. Lucide icons take `color`/`size` props, so icon colors are hex literals. `react-native/no-color-literals` is on, so hex inside a `style` object needs an inline eslint-disable.
- **`styles.css` is committed compiled Tailwind output** and must be regenerated by hand after using a new utility class, or the class works on device and is silently missing on web and in Playwright: `npx tailwindcss -i global.css -o styles.css && npx prettier --write styles.css`. `global.css` is the source and is imported by nothing; `styles.css` is imported only by `utils/cssImport.web.ts`. `tailwind.config.js` scans only `App.tsx`, `app/**` (nonexistent) and `components/**` — a className written in `utils/`, `hooks/` or `modules/` is purged.
- **Platform splits**: exactly two `.web.ts` pairs (`utils/cssImport`, `utils/backgroundTimer`); everything else branches on `Platform.OS` inline.
- **`testID` is kebab-case** and react-native-web exposes it as `data-testid`; `TouchableOpacity` renders a `div`, hence selectors like `div[data-testid="tab-routines"]`. `components/layout/Controls.tsx` has no testIDs at all, which is why 112 E2E selectors are text-based — **UI copy in the shell and layout components is effectively test API.**

## Testing

`jest.setup.js` gives you globally: a real in-memory AsyncStorage mock that round-trips, `expo-notifications` (fully stubbed), `expo-crypto.randomUUID` → the constant `'test-uuid'` (so **never assert id uniqueness**), `./modules/workout-activity`, `GoogleSigninButton` with `testID="google-signin-btn"`, and partial `firebase/app` + `firebase/auth`. Critically, `./utils/firebase` is mocked as `{ db: {} }` — **there is no `auth` export**, so any test reaching `onAuthStateChanged` must re-mock it (see `hooks/__tests__/useAuth.test.ts`) or mock `./hooks/useAuth` wholesale.

You must mock yourself, per suite: `expo-background-timer` (map `bgSetTimeout`→`setTimeout`), `react-native-reanimated` (the `/mock` is insufficient — add `configureReanimatedLogger` and `ReanimatedLogLevel`), `expo-keep-awake`, `netinfo`, `lucide-react-native`, `expo-blur`, `react-native-toast-message`, `expo-av`, `expo-speech`. Copy the block from `App.dynamicSets.test.tsx`.

Two Jest layers: root `__tests__/App.*.test.tsx` and colocated `__tests__/` subdirectories. `__tests__/App.test.tsx` is the **shell** suite (every layout child mocked to `null`, screens replaced with sentinels) — add a new `__tests__/App.<feature>.test.tsx` vertical slice rather than growing it. Feature suites keep the real component under test mounted, install a `window.dispatchEvent` shim **before** `import App` (without it, effect errors surface as "window.dispatchEvent is not a function"), and return one long-lived mutable object from the `useData`/`useWorkoutTimer` mocks that `beforeEach` must re-seed field-by-field — `jest.clearAllMocks()` clears calls but not `mockReturnValue`.

The Jest environment is **iOS-only** (`jest-expo` is a single-platform preset). Every `Platform.OS === 'web'` branch — including the whole E2E auth backdoor — is unreachable from Jest; `*.web.test.ts` files work only by importing the `.web.ts` file by explicit path.

E2E uses **no real OAuth and no real Firebase Auth**. `hooks/useAuth.ts` installs `window.setMockUser(user)` (and reads a `PLAYWRIGHT_MOCK_USER` localStorage key) gated on `Platform.OS === 'web' && EXPO_PUBLIC_PLAYWRIGHT === '1'`; specs drive it via `page.evaluate`, and `SettingsModal` renders a `mock-login-button` when the emulator flag is on. A mock user has no ID token, so Firestore requests are unauthenticated and E2E validates only the local-first path (on web, AsyncStorage is localStorage — specs assert on it directly).

Two traps that cost real time:

- `EXPO_PUBLIC_*` flags are **inlined at bundle time**, and `playwright.config.ts` sets `reuseExistingServer: !CI`. A stray `npm run web` already on :8081 (e.g. from `.claude/launch.json`) gets reused, and its bundle has no `setMockUser` at all — auth tests then fail for reasons that look nothing like the cause. Kill stray dev servers first.
- The emulator start is best-effort and `e2e/app.spec.ts` only warns when it is offline. **A green E2E run does not prove the emulator was involved.**

## Environment and CI

`.env` is gitignored and holds **production** credentials for the `gym-rep-counter` Firebase project, plus `EXPO_APPLE_TEAM_ID`. Expo auto-loads it for `npm start`/`npm run web`, so an unflagged local web session that signs in writes to production Firestore; command-line env wins over `.env`. `.env.example` is incomplete — `EXPO_PUBLIC_USE_FIREBASE_EMULATOR`, `EXPO_PUBLIC_PLAYWRIGHT` and `EXPO_APPLE_TEAM_ID` are real, code-read variables that only appear in `playwright.config.ts` and the CI workflows.

`firestore.rules` has drifted from the code and nothing tests or deploys it: it declares a `measurementLogs` subcollection and body-composition fields nothing writes, requires `request.resource.data.id == <docId>` on subcollection docs while every write path strips `id`, requires `concentricSeconds`/`eccentricSeconds` to be `is int` while `SettingsModal` accepts decimals, and its user-doc create rule uses `hasOnly([...])` — so adding a top-level user-doc field breaks account creation until rules are redeployed. Verify against the emulator before `npx firebase deploy --only firestore:rules,firestore:indexes`.

`firestore.indexes.json` has one composite index (`history`: `exerciseId` + `date`). Any new history query combining a filter with an order needs an entry.

CI:

| Workflow          | Trigger                                                                                                                                                                                     | Runs                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `android-apk.yml` | every push/PR to main, **no path filter**                                                                                                                                                   | `npx tsc --noEmit`, `npm test`, `expo prebuild --platform android`, `gradlew assembleRelease` |
| `e2e.yml`         | push/PR to main, **path-filtered** to `components/**`, `hooks/**`, `utils/**`, `modules/**`, `e2e/**`, `App.tsx`, `package*.json`, `playwright.config.ts`, `tsconfig.json`, `firebase.json` | `expo export -p web`, then `firebase-tools emulators:exec "npx playwright test"`              |

So **the APK workflow is the only place Jest and the typecheck run**, and edits to `jest.config.js`, `jest.setup.js` or `components/__tests__/**` do not trigger the E2E job. There is no iOS CI, and the CI APK is built with no `EXPO_PUBLIC_*` at all — it exercises guest/local mode only.

Team ID `9F2FM5B6L2` is hardcoded in `app.json` and `scripts/set-team-id.js`; the iPhone UDID `00008130-000215120A8B803A` in `scripts/rebuild.sh` and the `iphone-install` script.

## Repo hygiene

- **Nothing runs on commit.** `lint-staged` is configured in `package.json`, and `.husky/_/pre-commit` exists (husky v9 regenerates the whole `_/` shim set on every `npm install`), but it resolves to `.husky/pre-commit`, which does not exist — so the hook exits 0 and neither prettier nor eslint runs. Run `npm run format` and `npm run lint` yourself.
- Commit subjects are Conventional Commits: lowercase, imperative, no trailing period. Over the last 200 commits: `feat` 67, `fix` 40, `refactor` 14, `chore` 10, `test` 9, `ci` 3. Scopes in use: `(e2e)`, `(ui)`, `(web)`, `(native)`, `(android)`. Multi-clause subjects joined with `&`/`,` are normal.
- `ios/` and `android/` are gitignored and regenerated. Native changes that must survive belong in `modules/`, `targets/`, `plugins/` or `app.json`.
- **`patches/` is load-bearing.** `postinstall` runs `patch-package`, which reapplies `patches/expo-speech+14.0.7.patch` (native TTS volume — see Audio). A patch is pinned to the exact version in its filename, so bumping expo-speech makes `npm install` warn and skip it; regenerate with `npx patch-package expo-speech` after re-editing `node_modules/expo-speech`. iOS picks the change up on the next `pod install`/`xcodebuild` (the pod is a dev pod at `../node_modules/expo-speech/ios`); Android on the next Gradle build.
- `.claude/worktrees/` holds full stale repo copies. `jest.config.js` excludes them (`testPathIgnorePatterns` + `modulePathIgnorePatterns`); `tsconfig.json` skips them only incidentally, since its globs don't match dot-directories. Exclude them when grepping.
- Stale local artifacts at the repo root to ignore: `tsc_errors.log`, `scheduler.log`, `firebase-debug.log`, `firestore-debug.log`.
- **`README.md` is stale.** It names `App.js` as the entry point (it is `index.js` → `App.tsx`), tells you to `cd rep-counter-app` (the app is at the repo root), claims Node 18 works, and — most misleadingly — walks you through running it in **Expo Go**, which cannot load this app's custom native modules. It documents nothing about TypeScript, `useData`, Firebase, the web/Vercel target, Playwright, the emulator, or the native build scripts.
- Web deploy is **Vercel** (`vercel.json`: `npx expo export -p web` → `dist`). `firebase.json`'s `hosting.public` points at a `public/` directory that does not exist — Firebase is Firestore + Auth + the emulator suite only.
