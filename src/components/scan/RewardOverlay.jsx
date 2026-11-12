/*
  REWARD OVERLAY — a full-screen moment for a new badge or title.

  Opens over everything after a save that unlocked something. On a deep forest-green
  backdrop: slowly turning rays of light, a burst of sparkles and leaves, and the badge's
  seal (or the title's emblem) springing in, with a big heading underneath.
  Several rewards are shown one after another ("Next" → … → "Wonderful!").

  rewards: [{ kind: 'level', key } | { kind: 'badge', key }]
*/
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import BadgeSeal from '../ui/BadgeSeal';
import Icon from '../ui/Icon';
import { badgeByKey, badgeText, LEVELS, levelTitle } from '../../data/gamification';
import { t, upper } from '../../i18n';
import { colors, fonts } from '../../theme';

const RAY_COUNT = 14;
const RAYS_SIZE = 420;
const PARTICLE_COUNT = 22;

/** The texts and emblem of one reward */
function describe(reward) {
  if (reward.kind === 'level') {
    const level = LEVELS.find((l) => l.key === reward.key);
    const title = levelTitle(level);
    return { eyebrow: t('reward.levelEyebrow'), title, text: t('reward.levelText', { title }), icon: 'leaf', isLevel: true };
  }
  const badge = badgeByKey(reward.key);
  const { title, description } = badgeText(badge);
  return { eyebrow: t('reward.badgeEyebrow'), title, text: description, icon: badge.icon, isLevel: false };
}

/** Thin wedges of light around the emblem, turning slowly */
function Rays() {
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.value = withRepeat(withTiming(360, { duration: 24000, easing: Easing.linear }), -1);
  }, [turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  const r = RAYS_SIZE / 2;
  const wedges = Array.from({ length: RAY_COUNT }, (_, i) => {
    const a = (i / RAY_COUNT) * Math.PI * 2;
    const w = Math.PI / RAY_COUNT / 2.2;
    const p = (angle) => `${r + Math.cos(angle) * r} ${r + Math.sin(angle) * r}`;
    return `M${r} ${r} L${p(a - w)} L${p(a + w)} Z`;
  });

  return (
    <Animated.View style={[styles.rays, style]} pointerEvents="none">
      <Svg width={RAYS_SIZE} height={RAYS_SIZE}>
        <Defs>
          <RadialGradient id="fade" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.mustard} stopOpacity="0.38" />
            <Stop offset="1" stopColor={colors.mustard} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {wedges.map((d, i) => (
          <Path key={i} d={d} fill="url(#fade)" />
        ))}
        <Rect x={r - 90} y={r - 90} width={180} height={180} rx={90} fill="url(#fade)" opacity={0.6} />
      </Svg>
    </Animated.View>
  );
}

/** One sparkle or leaf flying out from the center and fading */
function Particle({ angle, distance, delay, size, icon, color, spin }) {
  const k = useSharedValue(0);
  useEffect(() => {
    k.value = withDelay(delay, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [k, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: k.value < 0.15 ? k.value / 0.15 : 1 - (k.value - 0.15) / 0.85,
    transform: [
      { translateX: Math.cos(angle) * distance * k.value },
      { translateY: Math.sin(angle) * distance * k.value + 40 * k.value * k.value },
      { rotate: `${spin * k.value}deg` },
      { scale: 0.4 + 0.8 * Math.min(1, k.value * 3) },
    ],
  }));
  return (
    <Animated.View style={[styles.particle, style]} pointerEvents="none">
      <Icon name={icon} size={size} color={color} strokeWidth={1.6} />
    </Animated.View>
  );
}

/** A burst of particles; `seed` makes every reward's burst look a little different */
function Burst({ seed }) {
  const particles = useMemo(() => {
    let x = seed * 9301 + 49297;
    const rand = () => {
      x = (x * 9301 + 49297) % 233280;
      return x / 233280;
    };
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      angle: (i / PARTICLE_COUNT) * Math.PI * 2 + rand() * 0.4,
      distance: 120 + rand() * 90,
      delay: 250 + rand() * 250,
      size: 10 + Math.round(rand() * 10),
      icon: i % 3 === 0 ? 'leaf' : 'sparkle',
      color: i % 4 === 0 ? colors.cream : colors.mustard,
      spin: (rand() - 0.5) * 360,
    }));
  }, [seed]);
  return particles.map(({ id, ...p }) => <Particle key={id} {...p} />);
}

/** The badge seal or title emblem, springing in with a little wobble */
function Emblem({ icon, isLevel }) {
  const scale = useSharedValue(0.2);
  const rotate = useSharedValue(-25);
  useEffect(() => {
    scale.value = withDelay(150, withSpring(1, { damping: 9, stiffness: 140 }));
    rotate.value = withDelay(150, withSequence(withSpring(6, { damping: 6 }), withSpring(0, { damping: 10 })));
  }, [scale, rotate]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }] }));

  return (
    <Animated.View style={style}>
      {isLevel ? (
        <View style={styles.levelRing}>
          <View style={styles.levelEmblem}>
            <Icon name={icon} size={58} color={colors.forest} strokeWidth={1.6} />
          </View>
        </View>
      ) : (
        <View style={styles.sealBack}>
          <BadgeSeal icon={icon} size={140} iconScale={0.48} />
        </View>
      )}
    </Animated.View>
  );
}

export default function RewardOverlay({ rewards, onClose }) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const reward = rewards[index];
  const info = reward ? describe(reward) : null;
  const isLast = index === rewards.length - 1;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [index]);

  if (!info) return null;

  const next = () => (isLast ? onClose() : setIndex((i) => i + 1));

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        {/* key={index}: every reward gets its own entrance */}
        <View key={index} style={styles.stage}>
          <View style={styles.burstCenter}>
            {!reduceMotion && <Rays />}
            {!reduceMotion && <Burst seed={index + 1} />}
            <Emblem icon={info.icon} isLevel={info.isLevel} />
          </View>

          <Animated.View entering={FadeIn.delay(450).duration(500)} style={styles.texts} accessibilityLiveRegion="assertive">
            <Text style={styles.eyebrow}>{upper(info.eyebrow)}</Text>
            <Text style={styles.title}>{info.title}</Text>
            <Text style={styles.text}>{info.text}</Text>
          </Animated.View>
        </View>

        <Animated.View entering={FadeIn.delay(800).duration(400)} style={styles.footer}>
          {rewards.length > 1 && (
            <Text style={styles.count}>{t('reward.count', { index: index + 1, total: rewards.length })}</Text>
          )}
          <Pressable
            onPress={next}
            style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{isLast ? t('reward.done') : t('reward.next')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.forestDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 34, alignSelf: 'stretch' },
  burstCenter: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute', width: RAYS_SIZE, height: RAYS_SIZE, left: 90 - RAYS_SIZE / 2, top: 90 - RAYS_SIZE / 2 },
  particle: { position: 'absolute' },
  sealBack: { borderRadius: 80, backgroundColor: colors.paper, padding: 8 },
  levelRing: {
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.mustard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelEmblem: {
    width: 138,
    height: 138,
    borderRadius: 69,
    backgroundColor: colors.mustard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { alignItems: 'center', gap: 8, maxWidth: 360 },
  eyebrow: { fontFamily: fonts.sansHeavy, fontSize: 13, letterSpacing: 2.4, color: colors.mustard, textAlign: 'center' },
  title: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 46, color: colors.cream, textAlign: 'center' },
  text: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 23, color: colors.mustardSoft, textAlign: 'center', opacity: 0.9 },
  footer: { alignSelf: 'stretch', alignItems: 'center', gap: 12 },
  count: { fontFamily: fonts.sans, fontSize: 13, color: colors.mustardSoft, opacity: 0.75 },
  button: {
    alignSelf: 'stretch',
    maxWidth: 360,
    width: '100%',
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: colors.mustard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: fonts.sansHeavy, fontSize: 17, color: colors.forestDeep },
});
