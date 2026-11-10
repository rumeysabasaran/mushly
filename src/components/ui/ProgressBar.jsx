/*
  PROGRESS BAR — for level progress and confidence percentages.
  Fills smoothly when the value changes.
*/
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { colors, radius } from '../../theme';

export default function ProgressBar({ value = 0, height = 8, color = colors.mustard, style }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [value, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View
      style={[styles.track, { height }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, backgroundColor: colors.paperEdge, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
