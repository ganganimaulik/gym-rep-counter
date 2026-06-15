import React, { useEffect, useMemo } from 'react'
import { SafeAreaView, View, Text, ActivityIndicator } from 'react-native'
import { styled } from 'nativewind'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { Dumbbell } from 'lucide-react-native'

const StyledSafeAreaView = styled(SafeAreaView)
const StyledView = styled(View)
const StyledText = styled(Text)
const StyledAnimatedView = styled(Animated.View)

const QUOTES = [
  'Train hard, track smart, grow stronger.',
  'Consistency is the key to unlocking your potential.',
  'What hurts today makes you stronger tomorrow.',
  'Focus on progress, not perfection.',
  'Success starts with self-discipline.',
  "The only bad workout is the one that didn't happen.",
  "Your body can stand almost anything. It's your mind you have to convince.",
]

const SplashScreen: React.FC = () => {
  // Select a random quote on mount
  const quote = useMemo(
    () => QUOTES[Math.floor(Math.random() * QUOTES.length)],
    [],
  )

  // Animation shared values
  const logoScale = useSharedValue(0.95)
  const glowOpacity = useSharedValue(0.12)
  const contentOpacity = useSharedValue(0)
  const contentTranslateY = useSharedValue(15)

  useEffect(() => {
    // 1. Logo pulsing animation
    logoScale.value = withRepeat(
      withTiming(1.05, {
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // infinite
      true, // reverse on each iteration
    )

    // 2. Glow pulsing animation
    glowOpacity.value = withRepeat(
      withTiming(0.28, {
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    )

    // 3. Fade-in of content on mount
    contentOpacity.value = withTiming(1, {
      duration: 1000,
      easing: Easing.out(Easing.ease),
    })
    contentTranslateY.value = withTiming(0, {
      duration: 1000,
      easing: Easing.out(Easing.ease),
    })
  }, [logoScale, glowOpacity, contentOpacity, contentTranslateY])

  // Animated styles
  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: logoScale.value * 1.1 }],
  }))

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }))

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }))

  return (
    <StyledSafeAreaView className="flex-1 bg-zinc-950 justify-between items-center py-12">
      {/* Invisible spacer to balance the flex-between layout */}
      <StyledView className="h-6" />

      {/* Main Branding Container */}
      <StyledAnimatedView
        style={animatedContentStyle}
        className="items-center justify-center">
        <StyledView className="relative items-center justify-center w-64 h-64 mb-8">
          {/* Subtle background glow */}
          <StyledAnimatedView
            style={animatedGlowStyle}
            className="absolute w-48 h-48 rounded-full bg-indigo-500/20"
          />
          <StyledAnimatedView
            style={animatedGlowStyle}
            className="absolute w-56 h-56 rounded-full bg-blue-500/10"
          />

          {/* Logo Card */}
          <StyledAnimatedView
            style={animatedLogoStyle}
            className="w-28 h-28 bg-zinc-900/90 border border-zinc-800 rounded-3xl items-center justify-center shadow-2xl">
            <Dumbbell size={52} color="#6366f1" strokeWidth={2.5} />
          </StyledAnimatedView>
        </StyledView>

        {/* Title */}
        <StyledText className="text-3xl font-black tracking-[0.2em] text-zinc-100 uppercase text-center pl-2">
          GYM <StyledText className="text-indigo-500">REP</StyledText> COUNTER
        </StyledText>

        {/* Subtitle */}
        <StyledText className="text-[10px] text-zinc-500 tracking-[0.3em] font-semibold mt-3.5 uppercase text-center pl-1">
          Your Automated Workout Companion
        </StyledText>
      </StyledAnimatedView>

      {/* Footer Area: Loader & Quote */}
      <StyledView className="w-full items-center px-8 space-y-8">
        <StyledView className="h-8 items-center justify-center">
          <ActivityIndicator size="small" color="#6366f1" />
        </StyledView>

        <StyledAnimatedView style={animatedContentStyle} className="w-full">
          <StyledText className="text-zinc-500 text-xs italic text-center px-4 font-medium leading-5">
            {`"${quote}"`}
          </StyledText>
        </StyledAnimatedView>
      </StyledView>
    </StyledSafeAreaView>
  )
}

export default SplashScreen
