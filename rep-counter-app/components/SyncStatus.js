import React from 'react';
import { View, Text } from 'react-native';
import { styled } from 'nativewind';
import { Cloud, Smartphone } from 'lucide-react-native';

const StyledView = styled(View);
const StyledText = styled(Text);

const SyncStatus = ({ user }) => {
  const statusConfig = user
    ? {
      Icon: Cloud,
      iconColor: '#4ade80', // green-400
      textColor: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      text: 'Settings are synced to your account.',
    }
    : {
      Icon: Smartphone,
      iconColor: '#facc15', // yellow-400
      textColor: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
      text: 'Settings are saved on this device only.',
    };

  return (
    <StyledView
      className={`flex-row items-center p-3 rounded-lg border ${statusConfig.bgColor} ${statusConfig.borderColor}`}
    >
      <statusConfig.Icon color={statusConfig.iconColor} size={20} />
      <StyledText className={`ml-3 text-sm font-medium ${statusConfig.textColor}`}>
        {statusConfig.text}
      </StyledText>
    </StyledView>
  );
};

export default SyncStatus;