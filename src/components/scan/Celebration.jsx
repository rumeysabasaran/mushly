/*
  CELEBRATION — the small, elegant result card shown after saving.
  - New species: a new page is added to the book (it slides in, with a mustard sparkle).
  - Repeat: "an old acquaintance", with the sighting count.
  - Draft: a calm confirmation.
  Anything the save unlocked (new badges, a new title) first opens full screen
  (RewardOverlay), then stays listed on the card.
*/
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Appear from '../ui/Appear';
import * as Haptics from 'expo-haptics';
import Paper, { PaperTexture } from '../ui/Paper';
import Button from '../ui/Button';
import Chip from '../ui/Chip';
import Icon from '../ui/Icon';
import BadgeSeal from '../ui/BadgeSeal';
import RewardOverlay from './RewardOverlay';
import { MushroomSketch } from '../ui/Ornaments';
import { Eyebrow, type } from '../ui/Typography';
import { badgeByKey, badgeText, LEVELS, levelTitle, rarityLabel } from '../../data/gamification';
import { commonNameOf, displayName } from '../../services/safety';
import { t, upper } from '../../i18n';
import { colors, fonts, shadows } from '../../theme';

// A small sheet of paper slides into the book from the right; sparkles follow
const PAGE_IN = { opacity: 0, translateX: 40, rotate: 8 };
const SPARK_IN = { opacity: 0, scale: 0.4, rotate: -20 };
export default function Celebration({ outcome, onAgain, againLabel = t('scan.newScan'), againIcon = 'camera', hideBookLink = false }) {
  const { type: kind, species, pointsEarned, newBadges = [], newLevel = null } = outcome;
  const rewarded = newBadges.length > 0 || !!newLevel;
  const [overlayOpen, setOverlayOpen] = useState(rewarded);
  const rewards = [...(newLevel ? [{ kind: 'level', key: newLevel }] : []), ...newBadges.map((key) => ({ kind: 'badge', key }))];

  useEffect(() => {
    if (kind === 'new') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [kind]);

  // "Open its page" goes straight to the right page
  function openBook() {
    router.navigate({ pathname: '/book', params: { page: kind === 'draft' ? 'drafts' : species.id, t: Date.now() } });
  }

  return (
    <Animated.View entering={FadeInDown.duration(280)}>
      <Paper style={styles.card} accessibilityLiveRegion="polite">
        {kind === 'new' && (
          <>
            <Appear from={PAGE_IN} duration={700} overshoot style={styles.page}>
              <PaperTexture borderRadius={6} />
              <MushroomSketch size={54} color={colors.forest} />
              <Appear from={SPARK_IN} to={{ opacity: 0.9 }} delay={500} duration={700} overshoot style={[styles.spark, { top: -10, right: -12 }]}>
                <Icon name="sparkle" size={18} color={colors.mustard} />
              </Appear>
              <Appear from={SPARK_IN} to={{ opacity: 0.9 }} delay={750} duration={700} overshoot style={[styles.spark, { bottom: 8, left: -14 }]}>
                <Icon name="sparkle" size={13} color={colors.mustard} />
              </Appear>
            </Appear>
            <Eyebrow>{t('celebration.newEyebrow')}</Eyebrow>
            <Text style={[styles.title]}>{displayName(species)}</Text>
            {!!commonNameOf(species) && <Text style={styles.latin}>{species.latinName}</Text>}
            <View style={styles.chips}>
              <Chip label={rarityLabel(species.rarity)} />
              <Chip variant="points" label={t('common.pointsEarned', { count: pointsEarned })} />
            </View>
          </>
        )}

        {kind === 'repeat' && (
          <>
            <Icon name="eye" size={40} color={colors.moss} style={{ marginBottom: 4 }} />
            <Eyebrow>{t('celebration.repeatEyebrow')}</Eyebrow>
            <Text style={styles.title}>{displayName(species)}</Text>
            <Text style={[type.muted, type.center]}>{t('celebration.repeatText', { count: species.seenCount })}</Text>
            <View style={styles.chips}>
              <Chip variant="points" label={t('common.pointsEarned', { count: pointsEarned })} />
            </View>
          </>
        )}

        {kind === 'draft' && (
          <>
            <Icon name="book" size={40} color={colors.moss} style={{ marginBottom: 4 }} />
            <Eyebrow>{t('celebration.draftEyebrow')}</Eyebrow>
            <Text style={styles.title}>{t('celebration.draftTitle')}</Text>
            <Text style={[type.muted, type.center]}>{t('celebration.draftText')}</Text>
          </>
        )}

        {rewarded && <Rewards badges={newBadges} level={newLevel} />}
        {overlayOpen && <RewardOverlay rewards={rewards} onClose={() => setOverlayOpen(false)} />}

        <View style={styles.actions}>
          <Button block icon={againIcon} title={againLabel} onPress={onAgain} />
          {!hideBookLink && (
            <Button block variant="ghost" icon="book" title={kind === 'draft' ? t('celebration.toDrafts') : t('celebration.openPage')} onPress={openBook} />
          )}
        </View>
      </Paper>
    </Animated.View>
  );
}

/** New badges and a new title, each appearing a moment after the card */
function Rewards({ badges, level }) {
  const levelInfo = level ? LEVELS.find((l) => l.key === level) : null;
  let delay = 600;
  return (
    <View style={styles.rewards}>
      {levelInfo && (
        <Appear from={REWARD_IN} delay={delay} duration={500} style={styles.reward}>
          <View style={styles.levelMark}>
            <Icon name="leaf" size={22} color={colors.cream} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rewardEyebrow}>{upper(t('celebration.newLevel'))}</Text>
            <Text style={styles.rewardTitle}>{levelTitle(levelInfo)}</Text>
            <Text style={type.small}>{t('celebration.newLevelText', { title: levelTitle(levelInfo) })}</Text>
          </View>
        </Appear>
      )}
      {badges.map((key) => {
        const badge = badgeByKey(key);
        if (!badge) return null;
        const { title, description } = badgeText(badge);
        delay += 250;
        return (
          <Appear key={key} from={REWARD_IN} delay={delay} duration={500} overshoot style={styles.reward}>
            <BadgeSeal icon={badge.icon} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rewardEyebrow}>{upper(t('celebration.newBadge'))}</Text>
              <Text style={styles.rewardTitle}>{title}</Text>
              <Text style={type.small}>{description}</Text>
            </View>
          </Appear>
        );
      })}
    </View>
  );
}

const REWARD_IN = { opacity: 0, translateY: 10, scale: 0.96 };

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 8, paddingTop: 26, paddingHorizontal: 20, paddingBottom: 20 },
  page: {
    width: 92,
    height: 116,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperWhite,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    ...shadows.paper,
  },
  spark: { position: 'absolute' },
  title: { fontFamily: fonts.serif, fontSize: 29, lineHeight: 34, color: colors.forest, textAlign: 'center' },
  latin: { fontFamily: fonts.serifItalic, fontSize: 18, color: colors.inkSoft },
  chips: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 10 },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 6 },
  rewards: { alignSelf: 'stretch', gap: 10, marginBottom: 6 },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.mustard,
    backgroundColor: colors.paperWhite,
  },
  levelMark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardEyebrow: { fontFamily: fonts.sansHeavy, fontSize: 11, letterSpacing: 1.2, color: colors.earth },
  rewardTitle: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 25, color: colors.forest },
});
