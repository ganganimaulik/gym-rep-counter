import { View } from "react-native";
import { styled } from "nativewind";

const StyledView = styled(View);

const ProgressBar = ({ progress }) => {
  return (
    <StyledView className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
      <StyledView
        className="bg-blue-500 h-4 rounded-full"
        style={{ width: `${progress}%` }}
      />
    </StyledView>
  );
};

export default ProgressBar;