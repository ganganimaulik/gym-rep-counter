import { View, Text, Pressable } from "react-native";
import { styled } from "nativewind";

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);

const Controls = ({ isRunning, isPaused, onStart, onPause, onEndSet, onStop }) => {
  return (
    <StyledView className="grid grid-cols-3 gap-4">
      {!isRunning ? (
        <StyledPressable
          className="py-3 px-4 bg-green-600 rounded-lg active:bg-green-700 col-span-2"
          onPress={onStart}
        >
          <StyledText className="text-lg font-semibold text-white text-center">Start</StyledText>
        </StyledPressable>
      ) : (
        <>
          <StyledPressable
            className="py-3 px-4 bg-yellow-500 rounded-lg active:bg-yellow-600"
            onPress={onPause}
          >
            <StyledText className="text-lg font-semibold text-white text-center">
              {isPaused ? "Resume" : "Pause"}
            </StyledText>
          </StyledPressable>
          <StyledPressable
            className={`py-3 px-4 rounded-lg ${isPaused ? 'bg-gray-500' : 'bg-blue-600 active:bg-blue-700'}`}
            onPress={onEndSet}
            disabled={isPaused}
          >
            <StyledText className="text-lg font-semibold text-white text-center">End Set</StyledText>
          </StyledPressable>
        </>
      )}
      <StyledPressable
        className="py-3 px-4 bg-red-600 rounded-lg active:bg-red-700"
        onPress={onStop}
      >
        <StyledText className="text-lg font-semibold text-white text-center">Stop</StyledText>
      </StyledPressable>
    </StyledView>
  );
};

// Note: NativeWind doesn't support grid-cols-* directly in React Native.
// We will use flexbox to achieve a similar layout in the main App.js file.
// For now, the structure is kept similar to the web version.
// The final implementation will use flexbox classes.

export default Controls;