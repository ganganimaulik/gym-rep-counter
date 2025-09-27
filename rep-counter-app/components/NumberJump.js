import { View, Text, Pressable } from "react-native";
import { styled } from "nativewind";

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);

const NumberJump = ({ maxReps, onJumpToRep, activeRep }) => {
  const buttons = Array.from({ length: maxReps }, (_, i) => i + 1);

  return (
    <StyledView>
      <StyledText className="text-sm font-medium text-gray-400 mb-2 text-center">
        Jump to Rep
      </StyledText>
      <StyledView className="flex-row flex-wrap justify-center gap-2">
        {buttons.map((rep) => (
          <StyledPressable
            key={rep}
            className={`w-12 h-12 border-2 rounded-md items-center justify-center ${
              activeRep === rep
                ? "bg-blue-600 border-blue-600"
                : "border-gray-600 active:bg-gray-700"
            }`}
            onPress={() => onJumpToRep(rep)}
          >
            <StyledText
              className={`text-lg font-semibold ${
                activeRep === rep ? "text-white" : "text-gray-300"
              }`}
            >
              {rep}
            </StyledText>
          </StyledPressable>
        ))}
      </StyledView>
    </StyledView>
  );
};

export default NumberJump;