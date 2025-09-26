import { View, Text } from "react-native";
import { styled } from "nativewind";

const StyledView = styled(View);
const StyledText = styled(Text);

interface DisplayProps {
  reps: number;
  sets: number;
}

export default function Display({ reps, sets }: DisplayProps) {
  return (
    <StyledView className="text-center">
      <StyledView className="flex-row justify-center items-end space-x-6">
        <StyledView>
          <StyledText className="text-8xl font-bold tracking-tight leading-none text-white">
            {reps}
          </StyledText>
          <StyledText className="text-lg text-gray-400">REP</StyledText>
        </StyledView>
        <StyledView className="pb-2">
          <StyledText className="text-6xl font-bold tracking-tight leading-none text-white">
            {sets}
          </StyledText>
          <StyledText className="text-lg text-gray-400">SET</StyledText>
        </StyledView>
      </StyledView>
    </StyledView>
  );
}