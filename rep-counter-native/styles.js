import { StyleSheet } from 'react-native';

export const colors = {
  background: '#0B0F19', // Dark blue-gray
  surface: '#1A202C',    // Dark slate gray
  primary: '#38A169',     // Green
  primaryHover: '#2F855A',// Darker Green
  secondary: '#DD6B20',   // Orange
  success: '#38A169',     // Green
  danger: '#E53E3E',      // Red
  text: '#E2E8F0',        // Light gray
  textSecondary: '#A0AEC0',// Gray
  border: '#4A5568',      // Gray
  input: '#2D3748',       // Dark blue-gray
  card: '#1A202C',        // Dark slate gray
};

export const typography = {
  fontFamily: 'System',
  h1: {
    fontSize: 64,
    fontWeight: 'bold',
    color: colors.text,
    letterSpacing: -1,
  },
  h2: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.text,
    letterSpacing: -0.5,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  body: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
};

export const layout = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

export const components = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 1 }],
    transition: 'transform 0.2s, background-color 0.2s',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
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