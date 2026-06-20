import React from 'react'
import { View, Text, Image, TouchableOpacity } from 'react-native'
import { styled } from 'nativewind'
import { LogOut } from 'lucide-react-native'
import type { User as FirebaseUser } from 'firebase/auth'

const StyledView = styled(View)
const StyledText = styled(Text)
const StyledTouchableOpacity = styled(TouchableOpacity)

interface UserProfileProps {
  user: FirebaseUser | null
  disconnectAccount: () => void
}

const UserProfile: React.FC<UserProfileProps> = ({
  user,
  disconnectAccount,
}) => {
  if (!user) {
    return null
  }

  return (
    <StyledView className="flex-row items-center justify-between bg-gray-700 rounded-lg p-4">
      <StyledView className="flex-row items-center space-x-4">
        {user.photoURL && (
          <Image
            testID="user-profile-image"
            source={{ uri: user.photoURL }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
          />
        )}
        <StyledView>
          <StyledText className="text-white font-semibold text-lg">
            {user.displayName}
          </StyledText>
          <StyledText className="text-gray-400 text-sm">
            {user.email}
          </StyledText>
        </StyledView>
      </StyledView>
      <StyledTouchableOpacity
        testID="disconnect-account-button"
        onPress={disconnectAccount}
        className="p-3 bg-red-600 rounded-lg">
        <LogOut color="white" size={24} />
      </StyledTouchableOpacity>
    </StyledView>
  )
}

export default React.memo(UserProfile)
