const tseslint = require('typescript-eslint')
const reactNative = require('eslint-plugin-react-native')
const react = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')
const globals = require('globals')

module.exports = tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.expo/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  {
    // All files in the project
    files: ['**/*.{js,jsx,ts,tsx}'],
    // Plugins
    plugins: {
      'react-native': reactNative,
      react: react,
      'react-hooks': reactHooks,
    },
    // Base configs
    extends: [...tseslint.configs.recommended],
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
    // Disable require rule for all JS files (mostly config/scripts in this project)
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Disable prop-types validation for TypeScript files since TS handles typing
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react/prop-types': 'off',
    },
  },
  {
    // Rule overrides for tests and configs
    files: [
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
      '**/*.{test,spec}.{js,jsx,ts,tsx}',
      'jest.setup.js',
      'e2e/**/*.{js,ts}',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'react/display-name': 'off',
    },
  },
)
