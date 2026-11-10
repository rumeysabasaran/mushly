/*
  ANALYZING DOTS — three small moss-green dots that bounce in turn while identifying.
*/
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { t } from '../../i18n';
import { colors } from '../../theme';

function Dot({ delay }) {
  const t = useSharedValue(0);
  useEffect(() => {
    const ease = Easing.bezier(0.25, 0.8, 0.3, 1);
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 480, easing: ease }),
          withTiming(0, { duration: 480, easing: ease }),
          withTiming(0, { duration: 240 })
        ),
        -1
      )
    );
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + t.value * 0.75, transform: [{ translateY: -4 * t.value }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

export default function AnalyzingDots() {
  return (
    <View style={styles.row} accessibilityLabel={t('scan.analyzingLabel')} accessibilityRole="progressbar">
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, height: 14, alignItems: 'flex-end' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.moss },
});
