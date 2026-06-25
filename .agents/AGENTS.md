# Agent Guidelines & Project Rules

## 1. Testing Requirements
- **Update Tests on Every Change:** Whenever you modify, add, or delete any features, components, hooks, utilities, or application flow logic, you MUST update the corresponding unit tests and Playwright E2E tests.
- **Maintain Test Coverage:** Ensure new code components or paths are covered by tests.
- **Verify Test Execution:** Run and verify the relevant test suite (either Jest unit tests or Playwright integration tests) after making changes to ensure that no regression is introduced.
  - **Unit Tests:** Run `npm test` or `npm run coverage`.
  - **E2E Tests:** Run `npx playwright test`.

## 2. E2E Testing & Authentication Mocking
- **Mock User Authentication:** Do not use real Firebase Authentication or attempt to automate third-party OAuth flows in E2E tests.
- **Playwright Setup:** In Playwright tests, set the mock user by navigating to the page and executing `window.setMockUser(...)` in the page context:
  ```typescript
  await page.evaluate(() => {
    if ((window as any).setMockUser) {
      (window as any).setMockUser({
        uid: 'test-user-id',
        email: 'testuser@playwright.com',
        displayName: 'Playwright Tester',
        photoURL: 'https://example.com/photo.png'
      });
    }
  });
  ```
- **Selectors:** Use `data-testid` attributes on interactive UI elements for resilient Playwright selector matching.

## 3. Architecture & State Management
- **Centralized State Hooks:** All user data, workouts, settings, history, and synchronization logic are centralized in the `useData` hook (`hooks/useData.ts`). Do not write direct AsyncStorage or Firestore access inside custom components; instead, expose capabilities through `useData`.
- **Authentication Hook:** Use `useAuth` (`hooks/useAuth.ts`) to manage authentication state and Google Sign-In configurations.
- **Background Operations:** Background activities and notifications should follow the structures in `utils/backgroundTimer.ts` and `utils/notifications.ts`.

## 4. UI Styling & Layout
- **NativeWind:** This project uses Tailwind CSS styles compiled via NativeWind (`nativewind`). Style components using Tailwind classes or the `styled(...)` wrapper from `nativewind`.
- **Mobile-First Layout:** The app is a mobile application run via Expo. E2E tests use a mobile-first aspect ratio (viewport: 450x800). Ensure UI components render well in this format.

## 5. Native Expo Modules
- **Expo Autolinking Modules:** Custom modules (`workout-activity`, `workout-attributes`) are located in the `modules/` folder.
- **Native Code Modification:** If modifying files in `ios/` or `android/` folders of these modules, run `npm run prebuild` (`expo prebuild --clean`) and rebuild the platform targets to ensure the changes are linked. Avoid modifying native binaries directly if JS/TS wrappers can achieve the desired logic.

## 6. Code Style & Pre-commit Hooks
- **Formatting & Linting:** Code formatting is managed by Prettier and ESLint. Run `npm run format` and `npm run lint` before committing.
- **TypeScript Strictness:** Maintain TypeScript cleanliness; do not introduce `any` types unless absolutely necessary (e.g., when mocking global window object interfaces for testing).
