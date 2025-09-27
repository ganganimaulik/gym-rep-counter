import { View, Text, Pressable } from "react-native";
import { styled } from "nativewind";

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);

const ExerciseNavigation = ({ onPrev, onNext, isPrevDisabled, isNextDisabled }) => {
  return (
    <StyledView className="flex-row justify-between gap-4">
      <StyledPressable
        className={`flex-1 py-2 px-4 rounded-lg ${isPrevDisabled ? 'bg-gray-700' : 'bg-gray-600 active:bg-gray-700'}`}
        onPress={onPrev}
        disabled={isPrevDisabled}
      >
        <StyledText className={`font-medium text-center ${isPrevDisabled ? 'text-gray-500' : 'text-white'}`}>
          ← Previous
        </StyledText>
      </StyledPressable>
      <StyledPressable
        className={`flex-1 py-2 px-4 rounded-lg ${isNextDisabled ? 'bg-gray-700' : 'bg-gray-600 active:bg-gray-700'}`}
        onPress={onNext}
        disabled={isNextDisabled}
      >
        <StyledText className={`font-medium text-center ${isNextDisabled ? 'text-gray-500' : 'text-white'}`}>
          Next →
        </StyledText>
      </StyledPressable>
    </StyledView>
  );
};

export default ExerciseNavigation;