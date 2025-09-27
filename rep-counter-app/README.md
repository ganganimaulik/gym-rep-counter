# Rep Counter - React Native Expo App

This is a React Native Expo application converted from a PWA. It's an exercise rep counter designed to run on mobile devices, with features like persistent workout plans, audio/voice feedback, and screen wake lock to prevent your phone from sleeping during a set.

## Prerequisites

Before you begin, ensure you have the following installed:

1.  **Node.js**: This project was built using **v22.13.1**. It is recommended to use this version. You can use a version manager like `nvm` to easily switch between Node.js versions.
2.  **Expo Go App**: You will need the Expo Go application installed on your iOS or Android device to run this project. You can download it from the [App Store](https://apps.apple.com/us/app/expo-go/id982107779) or [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent).

## How to Run Locally

Follow these simple steps to get the application running on your device:

### 1. Install Dependencies

Navigate to the project directory in your terminal and install the required Node.js packages.

```bash
cd rep-counter-app
npm install
```

### 2. Start the Metro Bundler

Once the dependencies are installed, you can start the Expo development server.

```bash
npm start
```

This command will start the Metro Bundler and display a QR code in your terminal.

### 3. Open the App on Your Device

-   Open the **Expo Go** app on your iOS or Android device.
-   Scan the QR code displayed in your terminal using the Expo Go app.
    -   On Android, use the "Scan QR Code" option on the home screen.
    -   On iOS, use the device's Camera app to scan the QR code.
-   The app will begin to bundle and will shortly open on your device.

That's it! You can now use the Rep Counter app. Your workouts and settings will be saved locally on your device.