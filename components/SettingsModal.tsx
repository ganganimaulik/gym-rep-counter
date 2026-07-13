import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Platform,
  Clipboard,
} from 'react-native'
import { styled } from 'nativewind'
import Slider from '@react-native-community/slider'
import { GoogleSigninButton } from '@react-native-google-signin/google-signin'
import { Check, Bell } from 'lucide-react-native'
import SyncStatus from './SyncStatus'
import UserProfile from './layout/UserProfile'
import { Settings } from '../hooks/useData'
import type { User as FirebaseUser } from 'firebase/auth'
import Toast from 'react-native-toast-message'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTextInput = styled(TextInput)
const StyledSwitch = styled(Switch)
const StyledTouchableOpacity = styled(TouchableOpacity)
const StyledScrollView = styled(ScrollView)

interface SettingsModalProps {
  visible: boolean
  onClose: () => void
  settings: Settings
  onSave: (settings: Settings) => void
  onGoogleButtonPress: () => void
  user: FirebaseUser | null
  disconnectAccount: () => void
  isSigningIn: boolean
  detectedSleepWindow?: string
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  settings,
  onSave,
  onGoogleButtonPress,
  user,
  disconnectAccount,
  isSigningIn,
  detectedSleepWindow,
}) => {
  const [localSettings, setLocalSettings] = useState<Settings>(settings)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    Clipboard.setString('https://mcp-server-alpha-blush.vercel.app/api')
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  const handleSave = () => {
    const keysToValidate: (keyof Settings)[] = [
      'countdownSeconds',
      'countdownAnnouncementThreshold',
      'restSeconds',
      'maxReps',
      'maxSets',
      'concentricSeconds',
      'eccentricSeconds',
    ]

    for (const key of keysToValidate) {
      const val = Number(localSettings[key])
      if (isNaN(val) || val <= 0) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Inputs',
          text2: 'All numeric settings must be valid positive numbers.',
        })
        return
      }
    }

    onSave(localSettings)
  }

  const handleValueChange = (key: keyof Settings, value: number | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
  }

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 === 0 ? 12 : hour % 12
    return `${displayHour}:00 ${ampm}`
  }

  const adjustSleepStart = (amount: number) => {
    const current = localSettings.statRemindersSleepStart ?? 23
    let next = (current + amount) % 24
    if (next < 0) next += 24
    handleValueChange('statRemindersSleepStart', next)
  }

  const adjustSleepEnd = (amount: number) => {
    const current = localSettings.statRemindersSleepEnd ?? 7
    let next = (current + amount) % 24
    if (next < 0) next += 24
    handleValueChange('statRemindersSleepEnd', next)
  }

  if (!visible) return null

  return (
    <StyledView className="flex-1 bg-zinc-950 p-4">
      {/* Header */}
      <StyledView className="flex-row justify-between items-center pb-3 border-b border-zinc-900 mb-4">
        <StyledText className="text-2xl font-black text-white">
          SETTINGS
        </StyledText>
      </StyledView>

      <StyledScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 60 }}>
        <StyledView className="space-y-4">
          {/* User Profile Card */}
          {user ? (
            <StyledView className="mb-2">
              <UserProfile user={user} disconnectAccount={disconnectAccount} />
            </StyledView>
          ) : (
            <StyledView className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-2 items-center shadow-xl">
              <StyledText className="text-sm font-black text-zinc-400 tracking-wider uppercase mb-3 text-center">
                Sync Account
              </StyledText>
              {Platform.OS === 'web' ? (
                <StyledView className="space-y-2 items-center">
                  <StyledTouchableOpacity
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-6 py-3 flex-row items-center justify-center w-[220px]"
                    onPress={onGoogleButtonPress}
                    disabled={isSigningIn}>
                    <StyledText className="text-white font-bold text-sm">
                      {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
                    </StyledText>
                  </StyledTouchableOpacity>
                  {process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true' && (
                    <StyledTouchableOpacity
                      testID="mock-login-button"
                      className="bg-zinc-950 border border-indigo-900 rounded-xl px-6 py-3 flex-row items-center justify-center w-[220px]"
                      onPress={async () => {
                        if (process.env.EXPO_PUBLIC_PLAYWRIGHT === '1') {
                          if (
                            typeof window !== 'undefined' &&
                            (window as any).setMockUser
                          ) {
                            ;(window as any).setMockUser({
                              uid: 'test-user',
                              email: 'test@example.com',
                              displayName: 'Test User',
                            })
                          }
                          return
                        }
                        const {
                          signInWithEmailAndPassword,
                          createUserWithEmailAndPassword,
                        } = await import('firebase/auth')
                        const { auth } = await import('../utils/firebase')
                        try {
                          await signInWithEmailAndPassword(
                            auth,
                            'test@example.com',
                            'password123',
                          )
                        } catch {
                          try {
                            await createUserWithEmailAndPassword(
                              auth,
                              'test@example.com',
                              'password123',
                            )
                          } catch (createErr) {
                            console.error('Mock Sign In failed', createErr)
                          }
                        }
                      }}>
                      <StyledText className="text-indigo-400 font-bold text-sm">
                        Mock Sign In
                      </StyledText>
                    </StyledTouchableOpacity>
                  )}
                </StyledView>
              ) : (
                <GoogleSigninButton
                  style={{ width: 220, height: 52 }}
                  size={GoogleSigninButton.Size.Wide}
                  color={GoogleSigninButton.Color.Dark}
                  onPress={onGoogleButtonPress}
                  disabled={isSigningIn}
                />
              )}
            </StyledView>
          )}

          {/* Sync Status Info */}
          <SyncStatus user={user} />

          {/* Interval Settings Grid */}
          <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl">
            <StyledText className="text-xs font-black text-zinc-400 tracking-widest uppercase mb-4">
              Timer Intervals
            </StyledText>

            <StyledView className="grid grid-cols-2 gap-4">
              <StyledView>
                <StyledText className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                  Countdown (s)
                </StyledText>
                <StyledTextInput
                  testID="setting-countdown"
                  className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-sm font-bold"
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  value={String(localSettings.countdownSeconds)}
                  onChangeText={(text) =>
                    handleValueChange('countdownSeconds', Number(text))
                  }
                />
              </StyledView>

              <StyledView>
                <StyledText className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                  Announcement
                </StyledText>
                <StyledTextInput
                  testID="setting-announcement"
                  className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-sm font-bold"
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  value={String(localSettings.countdownAnnouncementThreshold)}
                  onChangeText={(text) =>
                    handleValueChange(
                      'countdownAnnouncementThreshold',
                      Number(text),
                    )
                  }
                />
              </StyledView>

              <StyledView>
                <StyledText className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                  Rest Timer (s)
                </StyledText>
                <StyledTextInput
                  testID="setting-rest"
                  className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-sm font-bold"
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  value={String(localSettings.restSeconds)}
                  onChangeText={(text) =>
                    handleValueChange('restSeconds', Number(text))
                  }
                />
              </StyledView>

              <StyledView>
                <StyledText className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                  Max Reps Limit
                </StyledText>
                <StyledTextInput
                  testID="setting-max-reps"
                  className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-sm font-bold"
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  value={String(localSettings.maxReps)}
                  onChangeText={(text) =>
                    handleValueChange('maxReps', Number(text))
                  }
                />
              </StyledView>

              <StyledView>
                <StyledText className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                  Max Sets Limit
                </StyledText>
                <StyledTextInput
                  testID="setting-max-sets"
                  className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-sm font-bold"
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  value={String(localSettings.maxSets)}
                  onChangeText={(text) =>
                    handleValueChange('maxSets', Number(text))
                  }
                />
              </StyledView>

              <StyledView>
                <StyledText className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                  Concentric (s)
                </StyledText>
                <StyledTextInput
                  testID="setting-concentric"
                  className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-sm font-bold"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  value={String(localSettings.concentricSeconds)}
                  onChangeText={(text) =>
                    handleValueChange('concentricSeconds', Number(text))
                  }
                />
              </StyledView>

              <StyledView className="col-span-2">
                <StyledText className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                  Eccentric Duration (s)
                </StyledText>
                <StyledTextInput
                  testID="setting-eccentric"
                  className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-sm font-bold"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  value={String(localSettings.eccentricSeconds)}
                  onChangeText={(text) =>
                    handleValueChange('eccentricSeconds', Number(text))
                  }
                />
              </StyledView>

              <StyledView className="col-span-2 flex-row justify-between items-center py-2.5 border-t border-zinc-800/40 mt-2">
                <StyledText className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                  Eccentric Voice Count
                </StyledText>
                <StyledSwitch
                  testID="toggle-eccentric-voice"
                  value={localSettings.eccentricCountdownEnabled}
                  onValueChange={(value) =>
                    handleValueChange('eccentricCountdownEnabled', value)
                  }
                  trackColor={{ false: '#27272a', true: '#6366f1' }}
                  thumbColor={
                    localSettings.eccentricCountdownEnabled
                      ? '#a5b4fc'
                      : '#71717a'
                  }
                />
              </StyledView>
            </StyledView>
          </StyledView>

          {/* Sound Preferences Card */}
          <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl">
            <StyledText className="text-xs font-black text-zinc-400 tracking-widest uppercase mb-4">
              Volume Settings
            </StyledText>
            <StyledView className="flex-row items-center space-x-4">
              <Slider
                style={{ flex: 1 }}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                value={localSettings.volume}
                onValueChange={(value) => handleValueChange('volume', value)}
                minimumTrackTintColor="#6366f1"
                maximumTrackTintColor="#27272a"
                thumbTintColor="#6366f1"
              />
              <StyledText className="text-sm font-black w-12 text-right text-zinc-300">
                {`${Math.round(localSettings.volume * 100)}%`}
              </StyledText>
            </StyledView>
          </StyledView>

          {/* Notification Preferences Card */}
          <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl">
            <StyledView className="flex-row justify-between items-center mb-4">
              <StyledText className="text-xs font-black text-zinc-400 tracking-widest uppercase">
                Reminders
              </StyledText>
              <Bell color="#818cf8" size={14} />
            </StyledView>
            <StyledView className="flex-row justify-between items-center py-2.5">
              <StyledView className="flex-1 pr-4">
                <StyledText className="text-sm font-bold text-zinc-300">
                  Stat Update Reminders
                </StyledText>
                <StyledText className="text-xs text-zinc-500 mt-1">
                  Remind me every 4 hours to update my daily stats (weight,
                  calories, journal).
                </StyledText>
              </StyledView>
              <StyledSwitch
                testID="toggle-stat-reminders"
                value={localSettings.statRemindersEnabled ?? true}
                onValueChange={(value) =>
                  handleValueChange('statRemindersEnabled', value)
                }
                trackColor={{ false: '#27272a', true: '#6366f1' }}
                thumbColor={
                  (localSettings.statRemindersEnabled ?? true)
                    ? '#a5b4fc'
                    : '#71717a'
                }
              />
            </StyledView>

            {(localSettings.statRemindersEnabled ?? true) && (
              <StyledView className="flex-row justify-between items-center py-2.5 border-t border-zinc-800/40 mt-2">
                <StyledView className="flex-1 pr-4">
                  <StyledText className="text-sm font-bold text-zinc-300">
                    Auto-Detect Sleep
                  </StyledText>
                  <StyledText className="text-xs text-zinc-500 mt-1">
                    Automatically calculate your quiet hours based on app
                    activity.
                  </StyledText>
                </StyledView>
                <StyledSwitch
                  testID="toggle-auto-sleep"
                  value={localSettings.statRemindersUseAutoSleep ?? true}
                  onValueChange={(value) =>
                    handleValueChange('statRemindersUseAutoSleep', value)
                  }
                  trackColor={{ false: '#27272a', true: '#6366f1' }}
                  thumbColor={
                    (localSettings.statRemindersUseAutoSleep ?? true)
                      ? '#a5b4fc'
                      : '#71717a'
                  }
                />
              </StyledView>
            )}

            {(localSettings.statRemindersEnabled ?? true) &&
              (localSettings.statRemindersUseAutoSleep ?? true) &&
              detectedSleepWindow && (
                <StyledView className="border-t border-zinc-800/40 mt-3 pt-3 flex-row justify-between items-center">
                  <StyledText className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                    Quiet Sleep Window
                  </StyledText>
                  <StyledText className="text-xs font-medium text-zinc-500">
                    {detectedSleepWindow}
                  </StyledText>
                </StyledView>
              )}

            {(localSettings.statRemindersEnabled ?? true) &&
              !(localSettings.statRemindersUseAutoSleep ?? true) && (
                <StyledView className="border-t border-zinc-800/40 mt-3 pt-3 space-y-3">
                  <StyledText className="text-xs font-black text-zinc-400 tracking-widest uppercase mb-1">
                    Manual Sleep Settings
                  </StyledText>

                  {/* Bedtime */}
                  <StyledView className="flex-row justify-between items-center bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/40">
                    <StyledText className="text-sm font-bold text-zinc-400">
                      Quiet Start (Bedtime)
                    </StyledText>
                    <StyledView className="flex-row items-center">
                      <StyledTouchableOpacity
                        testID="sleep-start-minus"
                        onPress={() => adjustSleepStart(-1)}
                        className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 items-center justify-center">
                        <StyledText className="text-white font-bold text-lg">
                          -
                        </StyledText>
                      </StyledTouchableOpacity>
                      <StyledText
                        testID="sleep-start-text"
                        className="text-sm font-black text-white w-20 text-center">
                        {formatHour(
                          localSettings.statRemindersSleepStart ?? 23,
                        )}
                      </StyledText>
                      <StyledTouchableOpacity
                        testID="sleep-start-plus"
                        onPress={() => adjustSleepStart(1)}
                        className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 items-center justify-center">
                        <StyledText className="text-white font-bold text-lg">
                          +
                        </StyledText>
                      </StyledTouchableOpacity>
                    </StyledView>
                  </StyledView>

                  {/* Wake up */}
                  <StyledView className="flex-row justify-between items-center bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/40">
                    <StyledText className="text-sm font-bold text-zinc-400">
                      Quiet End (Wake-up)
                    </StyledText>
                    <StyledView className="flex-row items-center">
                      <StyledTouchableOpacity
                        testID="sleep-end-minus"
                        onPress={() => adjustSleepEnd(-1)}
                        className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 items-center justify-center">
                        <StyledText className="text-white font-bold text-lg">
                          -
                        </StyledText>
                      </StyledTouchableOpacity>
                      <StyledText
                        testID="sleep-end-text"
                        className="text-sm font-black text-white w-20 text-center">
                        {formatHour(localSettings.statRemindersSleepEnd ?? 7)}
                      </StyledText>
                      <StyledTouchableOpacity
                        testID="sleep-end-plus"
                        onPress={() => adjustSleepEnd(1)}
                        className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 items-center justify-center">
                        <StyledText className="text-white font-bold text-lg">
                          +
                        </StyledText>
                      </StyledTouchableOpacity>
                    </StyledView>
                  </StyledView>
                </StyledView>
              )}
          </StyledView>

          {/* MCP Server Settings Card */}
          <StyledView className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl">
            <StyledText className="text-xs font-black text-zinc-400 tracking-widest uppercase mb-4">
              MCP Server Settings
            </StyledText>

            <StyledView className="mb-4">
              <StyledText className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">
                Vercel MCP Server URL
              </StyledText>
              <StyledView className="flex-row items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                <StyledText
                  testID="vercel-mcp-url-text"
                  className="text-zinc-300 text-sm font-medium flex-1 mr-2 select-text">
                  https://mcp-server-alpha-blush.vercel.app/api
                </StyledText>
                <StyledTouchableOpacity
                  testID="copy-vercel-mcp-url"
                  onPress={handleCopy}
                  className="bg-indigo-600/20 border border-indigo-500/30 rounded-lg px-3 py-1.5 active:bg-indigo-600/40 min-w-[60px] items-center">
                  <StyledText className="text-indigo-400 font-bold text-xs">
                    {copied ? 'Copied' : 'Copy'}
                  </StyledText>
                </StyledTouchableOpacity>
              </StyledView>
            </StyledView>
          </StyledView>

          {/* Action Save Button */}
          <StyledTouchableOpacity
            onPress={handleSave}
            activeOpacity={0.8}
            className="bg-indigo-600 rounded-2xl py-4 flex-row items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20">
            <Check color="white" size={20} strokeWidth={2.5} />
            <StyledText className="text-white text-base font-black uppercase tracking-wider">
              Save Changes
            </StyledText>
          </StyledTouchableOpacity>
        </StyledView>
      </StyledScrollView>
    </StyledView>
  )
}

export default SettingsModal
