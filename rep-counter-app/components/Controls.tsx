import { View, Text, Pressable } from "react-native";
import { styled } from "nativewind";

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);

interface ControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onEndSet: () => void;
}

export default function Controls({
  isRunning,
  isPaused,
  onStart,
  onPause,
  onStop,
  onEndSet,
}: ControlsProps) {
  return (
    <StyledView className="grid grid-cols-3 gap-4">
      {!isRunning ? (
        <StyledPressable
          className="py-3 px-4 bg-green-600 rounded-lg active:bg-green-700 col-span-2"
          onPress={onStart}
        >
          <StyledText className="text-white text-lg font-semibold text-center">
            Start
          </StyledText>
        </StyledPressable>
      ) : (
        <>
          <StyledPressable
            className="py-3 px-4 bg-yellow-500 rounded-lg active:bg-yellow-600"
            onPress={onPause}
          >
            <StyledText className="text-white text-lg font-semibold text-center">
              {isPaused ? "Resume" : "Pause"}
            </StyledText>
          </StyledPressable>
          <StyledPressable
            className={`py-3 px-4 bg-blue-600 rounded-lg active:bg-blue-700 ${isPaused ? 'hidden' : ''}`}
            onPress={onEndSet}
            disabled={isPaused}
          >
            <StyledText className="text-white text-lg font-semibold text-center">
              End Set
            </StyledText>
          </StyledPressable>
        </>
      )}
      <StyledPressable
        className="py-3 px-4 bg-red-600 rounded-lg active:bg-red-700"
        onPress={onStop}
      >
        <StyledText className="text-white text-lg font-semibold text-center">
          Stop
        </StyledText>
      </StyledPressable>
    </StyledView>
  );
}