import React, { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
  Keyboard,
} from 'react-native'
import { styled } from 'nativewind'
import Slider from '@react-native-community/slider'
import { GoogleSigninButton } from '@react-native-google-signin/google-signin'
import { X, Check } from 'lucide-react-native'
import SyncStatus from './SyncStatus'
import { Settings } from '../hooks/useData'
import type { User as FirebaseUser } from 'firebase/auth'

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
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  settings,
  onSave,
  onGoogleButtonPress,
  user,
  disconnectAccount,
  isSigningIn,
}) => {
  const [localSettings, setLocalSettings] = useState<Settings>(settings)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const handleSave = () => {
    onSave(localSettings)
    onClose()
  }

  const handleValueChange = (
    key: keyof Settings,
    value: number | boolean,
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}>
      <StyledView className="flex-1 justify-center items-center bg-black/50 p-4">
        <StyledView className="bg-gray-800 rounded-2xl shadow-lg p-4 w-full max-w-lg max-h-[90vh]">
          <StyledView className="flex-row justify-between items-center pb-4 border-b border-gray-700">
            <StyledText className="text-2xl font-bold text-white">
              Settings
            </StyledText>
            <StyledTouchableOpacity onPress={onClose}>
              <X color="#9ca3af" size={24} />
            </StyledTouchableOpacity>
          </StyledView>

          <StyledScrollView className="mt-4">
            <StyledView className="space-y-4">
              <SyncStatus user={user} />
              <StyledView className="grid grid-cols-2 gap-4">
                <StyledView>
                  <StyledText className="text-sm font-medium text-gray-300">
                    Countdown (s)
                  </StyledText>
                  <StyledTextInput
                    className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
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
                  <StyledText className="text-sm font-medium text-gray-300">
                    Rest (s)
                  </StyledText>
                  <StyledTextInput
                    className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
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
                  <StyledText className="text-sm font-medium text-gray-300">
                    Max Reps
                  </StyledText>
                  <StyledTextInput
                    className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
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
                  <StyledText className="text-sm font-medium text-gray-300">
                    Max Sets
                  </StyledText>
                  <StyledTextInput
                    className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
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
                  <StyledText className="text-sm font-medium text-gray-300">
                    Concentric (s)
                  </StyledText>
                  <StyledTextInput
                    className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    value={String(localSettings.concentricSeconds)}
                    onChangeText={(text) =>
                      handleValueChange('concentricSeconds', Number(text))
                    }
                  />
                </StyledView>
                <StyledView>
                  <StyledText className="text-sm font-medium text-gray-300">
                    Eccentric (s)
                  </StyledText>
                  <StyledTextInput
                    className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    value={String(localSettings.eccentricSeconds)}
                    onChangeText={(text) =>
                      handleValueChange('eccentricSeconds', Number(text))
                    }
                  />
                </StyledView>
                <StyledView className="col-span-2 flex items-center justify-center pt-2 flex-row">
                  <StyledText className="mr-3 text-sm font-medium text-gray-300">
                    Eccentric Countdown
                  </StyledText>
                  <StyledSwitch
                    value={localSettings.eccentricCountdownEnabled}
                    onValueChange={(value) =>
                      handleValueChange('eccentricCountdownEnabled', value)
                    }
                  />
                </StyledView>
                <StyledView className="col-span-2 pt-2">
                  <StyledText className="text-sm font-medium text-gray-300 mb-1">
                    Volume
                  </StyledText>
                  <StyledView className="flex flex-row items-center space-x-3">
                    <Slider
                      style={{ flex: 1 }}
                      minimumValue={0}
                      maximumValue={1}
                      step={0.05}
                      value={localSettings.volume}
                      onValueChange={(value) =>
                        handleValueChange('volume', value)
                      }
                      minimumTrackTintColor="#3b82f6"
                      maximumTrackTintColor="#4b5563"
                      thumbTintColor="#3b82f6"
                    />
                    <StyledText className="text-sm font-medium w-12 text-right text-gray-300">
                      {`${Math.round(localSettings.volume * 100)}%`}
                    </StyledText>
                  </StyledView>
                </StyledView>
              </StyledView>
              <StyledView className="items-center pt-4">
                {!user ? (
                  <GoogleSigninButton
                    style={{ width: 220, height: 52 }}
                    size={GoogleSigninButton.Size.Wide}
                    color={GoogleSigninButton.Color.Dark}
                    onPress={onGoogleButtonPress}
                    disabled={isSigningIn}
                  />
                ) : (
                  <StyledTouchableOpacity
                    onPress={disconnectAccount}
                    className="py-3 px-6 bg-red-600 rounded-lg">
                    <StyledText className="font-semibold text-white">
                      Disconnect Account
                    </StyledText>
                  </StyledTouchableOpacity>
                )}
              </StyledView>
            </StyledView>
          </StyledScrollView>

          <StyledView className="flex-row justify-end pt-4 mt-4 border-t border-gray-700">
            <StyledTouchableOpacity
              onPress={onClose}
              className="py-2 px-6 bg-gray-600 rounded-lg mr-2">
              <StyledText className="font-semibold text-white">
                Cancel
              </StyledText>
            </StyledTouchableOpacity>
            <StyledTouchableOpacity
              onPress={handleSave}
              className="py-2 px-6 bg-blue-600 rounded-lg flex-row items-center">
              <Check color="white" size={18} className="mr-2" />
              <StyledText className="font-semibold text-white">Save</StyledText>
            </StyledTouchableOpacity>
          </StyledView>
        </StyledView>
      </StyledView>
    </Modal>
  )
}

export default SettingsModal
