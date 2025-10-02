import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import { LogOut } from 'lucide-react-native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);

const UserProfile = ({ user, onDisconnect }) => {
  if (!user) {
    return null;
  }

  return (
    <StyledView className="flex-row items-center justify-between bg-gray-700 rounded-lg p-3">
      <StyledView className="flex-row items-center space-x-3">
        <StyledImage
          source={{ uri: user.photoURL }}
          className="w-10 h-10 rounded-full"
        />
        <StyledView>
          <StyledText className="text-white font-semibold">
            {user.displayName}
          </StyledText>
          <StyledText className="text-gray-400 text-sm">
            {user.email}
          </StyledText>
        </StyledView>
      </StyledView>
      <StyledTouchableOpacity
        onPress={onDisconnect}
        className="p-2 bg-red-600 rounded-lg"
      >
        <LogOut color="white" size={20} />
      </StyledTouchableOpacity>
    </StyledView>
  );
};

export default UserProfile;