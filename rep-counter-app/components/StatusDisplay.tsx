import { Text } from "react-native";
import { styled } from "nativewind";

const StyledText = styled(Text);

interface StatusDisplayProps {
  status: string;
}

export default function StatusDisplay({ status }: StatusDisplayProps) {
  return (
    <StyledText className="text-2xl font-medium text-blue-400 mb-2 text-center">
      {status}
    </StyledText>
  );
}