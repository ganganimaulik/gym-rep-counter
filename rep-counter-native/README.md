# Rep Counter - React Native Edition

This is a React Native application built with Expo, converted from the original PWA version to provide a more reliable native experience, especially regarding screen lock behavior.

## Prerequisites

Before you begin, ensure you have the following installed:
1.  **Node.js**: This project was built using Node.js v22.13.1. You can download it from [nodejs.org](https://nodejs.org/).
2.  **Expo Go App**: To run the app on your physical device, you will need the **Expo Go** application, which is available on both the [App Store (iOS)](https://apps.apple.com/us/app/expo-go/id982107779) and the [Google Play Store (Android)](https://play.google.com/store/apps/details?id=host.exp.exponent).

## How to Run Locally

Follow these steps to get the application running on your local machine for development and testing.

### 1. Navigate to the Project Directory
Open your terminal and change into the project's root directory:
```bash
cd rep-counter-native
```

### 2. Install Dependencies
Install all the necessary project dependencies using npm:
```bash
npm install
```
This command will download and install all the packages defined in `package.json`.

### 3. Start the Development Server
Once the dependencies are installed, you can start the Expo development server:
```bash
npm start
```
This command will launch the Metro Bundler, which is Expo's development server. Your terminal will display a QR code.

### 4. Run on Your Device
1.  Open the **Expo Go** app on your iOS or Android device.
2.  Make sure your device is connected to the same Wi-Fi network as your computer.
3.  Scan the QR code displayed in your terminal using the Expo Go app.

The app will then be bundled and loaded onto your device. You can now interact with it just like any other mobile application.

## Important Note on Audio Files

This application uses two audio files for sound cues:
-   `start.mp3`: Plays when a workout begins.
-   `beep.mp3`: Plays for countdowns and other timing cues.

The application expects to find these files in the `rep-counter-native/assets/` directory. **You must provide these two MP3 files yourself for the audio features to work correctly.**

---

Enjoy your new and improved rep counter!