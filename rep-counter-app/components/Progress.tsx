import { View, Text } from "react-native";
import { styled } from "nativewind";

const StyledView = styled(View);
const StyledText = styled(Text);

interface ProgressBarProps {
  progress: number;
}

const ProgressBar = ({ progress }: ProgressBarProps) => {
  return (
    <StyledView className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
      <StyledView
        className="bg-blue-500 h-4 rounded-full"
        style={{ width: `${progress}%` }}
      />
    </StyledView>
  );
};

interface PhaseDisplayProps {
  phase: string;
}

const PhaseDisplay = ({ phase }: PhaseDisplayProps) => {
  return (
    <StyledText className="text-xl text-gray-400 mt-2 text-center">
      {phase || "\u00A0"}
    </StyledText>
  );
};

export { ProgressBar, PhaseDisplay };