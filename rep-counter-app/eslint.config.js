import globals from 'globals'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactNative from 'eslint-plugin-react-native'
import prettier from 'eslint-plugin-prettier'
import eslintJs from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'

export default [
  {
    ignores: [
      'node_modules/',
      'build/',
      '.expo/',
      'dist/',
      '.prettierrc.cjs',
      'babel.config.cjs',
    ],
  },
  eslintJs.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint,
      react,
      'react-hooks': reactHooks,
      'react-native': reactNative,
      prettier,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        ...globals.jest,
        'react-native': true,
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...reactNative.configs.all.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'react/react-in-jsx-scope': 'off',
      'react-native/no-inline-styles': 'off',
      'react-native/no-color-literals': 'off',
      'react-native/sort-styles': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
]
