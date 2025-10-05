# Exercise Rep Counter - React Native App

This is a React Native application built with Expo that helps you count exercise repetitions with timed concentric and eccentric phases. It's a conversion of the original PWA to a native application to ensure it works reliably, even when the screen is locked.

## Prerequisites

- **Node.js**: It is recommended to use a recent LTS version of Node.js. Version **18.x** or **20.x** will work well. You can use a tool like `nvm` (Node Version Manager) to manage your Node.js versions.
- **macOS**: To run the iOS simulator, you will need a Mac with Xcode installed.
- **Xcode**: Install Xcode from the Mac App Store. After installation, make sure to open it at least once to accept the license agreement and install the command-line tools.
- **Expo Go App (Optional)**: For a quicker start without a simulator, you can install the "Expo Go" app on your iPhone or iPad.

## How to Run Locally (for Mac and iOS)

1.  **Clone or Download the Project**:
    Make sure you have the `rep-counter-app` directory on your local machine.

2.  **Navigate to the Project Directory**:
    Open your terminal and change into the app's directory:
    ```bash
    cd rep-counter-app
    ```

3.  **Install Dependencies**:
    Install all the necessary npm packages. This command will read the `package.json` file and install everything the project needs.
    ```bash
    npm install
    ```

4.  **Run the Application on the iOS Simulator**:
    Once the dependencies are installed, you can start the application on the iOS simulator with the following command:
    ```bash
    npm run ios
    ```
    This will do a few things:
    -   Start the Expo development server.
    -   If you have Xcode installed correctly, it will automatically open the iOS simulator.
    -   The app will be installed and launched on the simulator.

    You can now interact with the app as you would on a real device. Any changes you make to the source code will automatically reload in the simulator.

5.  **Running on a Physical iOS Device (Optional)**:
    -   Ensure your iPhone is on the same Wi-Fi network as your computer.
    -   Install the "Expo Go" app from the App Store on your iPhone.
    -   When you run `npm start` or `npm run ios`, a QR code will be displayed in the terminal.
    -   Open the Camera app on your iPhone and scan the QR code. This will open the project in the Expo Go app.

## Project Structure

-   `App.js`: The main entry point of the application. It contains the core logic and ties all the components together.
-   `components/`: This directory contains all the reusable React components used throughout the application.
-   `assets/`: This directory contains static assets like images and icons.
-   `tailwind.config.js`: Configuration file for NativeWind (Tailwind CSS for React Native).
-   `babel.config.js`: Babel configuration, which includes the `nativewind/babel` plugin.
-   `package.json`: Lists all the project dependencies and scripts.