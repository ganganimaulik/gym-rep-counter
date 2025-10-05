import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import { LogOut } from 'lucide-react-native';
import type { User as FirebaseUser } from 'firebase/auth';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface UserProfileProps {
  user: FirebaseUser | null;
  disconnectAccount: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, disconnectAccount }) => {
  if (!user) {
    return null;
  }

  return (
    <StyledView className="flex-row items-center justify-between bg-gray-700/50 rounded-xl p-3">
      <StyledView className="flex-row items-center space-x-4">
        {user.photoURL && (
          <Image
            source={{ uri: user.photoURL }}
            className="w-11 h-11 rounded-full"
          />
        )}
        <StyledView>
          <StyledText className="text-white font-semibold text-base">
            {user.displayName}
          </StyledText>
          <StyledText className="text-gray-400 text-xs">
            {user.email}
          </StyledText>
        </StyledView>
      </StyledView>
      <StyledTouchableOpacity
        onPress={disconnectAccount}
        className="p-2.5 bg-red-600/80 rounded-lg"
      >
        <LogOut color="white" size={20} />
      </StyledTouchableOpacity>
    </StyledView>
  );
};

export default UserProfile;