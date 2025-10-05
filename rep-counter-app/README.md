# Rep Counter App

The Rep Counter App is a native mobile application built with React Native and Expo, designed to help users track their workout repetitions with precision. It features customizable timers for concentric and eccentric phases, rest periods, and set counts. The app leverages Firebase for user authentication and data synchronization, ensuring a seamless experience across sessions.

## Key Features

-   **Customizable Timers**: Tailor the duration of concentric, eccentric, and rest phases to match your workout routine.
-   **Workout Management**: Create, edit, and save entire workout routines, with multiple exercises per workout.
-   **User Authentication**: Sign in with Google to sync your settings and workout data across devices.
-   **Text-to-Speech Feedback**: Receive audio cues for reps, sets, and phase changes.
-   **Background Functionality**: The app continues to run even when the screen is locked, thanks to `expo-background-timer`.
-   **Cross-Platform**: Built with Expo for compatibility with both iOS and Android.

## Tech Stack

-   **React Native**: Core framework for building the native application.
-   **Expo**: Toolchain for building and deploying the app.
-   **Firebase**: Used for Google Sign-In authentication and Firestore for data storage.
-   **NativeWind**: Tailwind CSS for styling React Native components.
-   **Lucide Icons**: For clean and consistent iconography.
-   **Expo AV, Expo Speech, Expo Background Timer**: For audio and background functionality.
-   **Reanimated & Gesture Handler**: For smooth animations and gestures.
-_   **AsyncStorage**: For local data persistence.

## Prerequisites

-   **Node.js**: Use a recent LTS version (18.x or 20.x recommended).
-   **Yarn**: This project uses Yarn for package management.
-   **Expo Go App**: For running on a physical device.
-   **Simulator (Optional)**: Xcode (for iOS) or Android Studio (for Android).
-   **Firebase Project**: You will need to set up a Firebase project to handle authentication and data storage.

## Getting Started

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/ganganimaulik/gym-rep-counter
    cd rep-counter-app
    ```

2.  **Install Dependencies**:
    ```bash
    yarn install
    ```

3.  **Prebuild Native Directories**:
    Run the following command to generate the native `ios` and `android` project folders.
    ```bash
    npx expo prebuild --clean
    ```

4.  **Set Up Environment Variables**:
    Create a `.env` file in the `rep-counter-app` directory and add your Firebase project credentials. These are required for Google Sign-In and Firebase services.
    ```
    EXPO_PUBLIC_FIREBASE_API_KEY="your-api-key"
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
    EXPO_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
    EXPO_PUBLIC_FIREBASE_APP_ID="your-app-id"
    EXPO_PUBLIC_GOOGLE_SIGNIN_WEB_CLIENT_ID="your-web-client-id"
    EXPO_PUBLIC_IOS_CLIENT_ID="your-ios-client-id"
    EXPO_PUBLIC_ANDROID_CLIENT_ID="your-android-client-id"
    ```

4.  **Run the App**:
    -   **On a physical device**:
        ```bash
        yarn start
        ```
        Scan the QR code with the Expo Go app.
    -   **On an iOS Simulator**:
        ```bash
        yarn ios
        ```
    -   **On an Android Emulator**:
        ```bash
        yarn android
        ```

## Project Structure

-   `App.js`: Main application component and entry point.
-   `components/`: Contains reusable UI components.
-   `hooks/`: Houses custom hooks for business logic (auth, data, audio, timers).
-   `utils/`: Utility functions.
-   `assets/`: Static assets like images and icons.
-   `app.json`: Expo configuration file.
-   `package.json`: Project dependencies and scripts.
-   `tailwind.config.js`: NativeWind styling configuration.