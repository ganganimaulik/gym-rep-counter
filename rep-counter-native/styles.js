import { StyleSheet } from 'react-native';

export const colors = {
  background: '#111827', // bg-gray-900
  surface: '#1f2937', // bg-gray-800
  primary: '#3b82f6', // bg-blue-600
  primaryHover: '#2563eb', // bg-blue-700
  secondary: '#f59e0b', // bg-yellow-500
  success: '#16a34a', // bg-green-600
  danger: '#dc2626', // bg-red-600
  text: '#ffffff',
  textSecondary: '#9ca3af', // text-gray-400
  border: '#4b5563', // border-gray-500
  input: '#4b5563', // bg-gray-700
  card: '#374151', // bg-gray-700 (for modals)
};

export const typography = {
  fontFamily: 'System', // Using system font for simplicity
  h1: {
    fontSize: 72,
    fontWeight: 'bold',
    color: colors.text,
  },
  h2: {
    fontSize: 56,
    fontWeight: 'bold',
    color: colors.text,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  body: {
    fontSize: 16,
    color: colors.text,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
  },
};

export const layout = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

export const components = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 1 }],
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
    fontSize: 16,
    marginTop: 8,
  },
  progressBar: {
    height: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
});