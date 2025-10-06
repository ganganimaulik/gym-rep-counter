const tseslint = require('typescript-eslint');
const reactNative = require('eslint-plugin-react-native');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const globals = require('globals');

module.exports = tseslint.config(
  {
    // All files in the project
    files: ['**/*.{js,jsx,ts,tsx}'],
    // Plugins
    plugins: {
      'react-native': reactNative,
      'react': react,
      'react-hooks': reactHooks,
    },
    // Base configs
    extends: [
      ...tseslint.configs.recommended,
    ],
    // Rules
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...reactNative.configs.all.rules,
      'react/react-in-jsx-scope': 'off',
      'react-native/no-inline-styles': 'off',
      'react-native/no-raw-text': 'off',
    },
    // Language options
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    // Settings
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    // Disable require rule for the config file itself
    files: ['eslint.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);