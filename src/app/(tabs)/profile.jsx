/*
  PROFILE — level, totals, badges and the ladder of titles.
  Tapping a badge opens a small sheet: how to earn it, progress, or when it was earned.
*/
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/ui/Screen';
import PageHeader from '../../components/ui/PageHeader';
import Paper from '../../components/ui/Paper';
import Sheet from '../../components/ui/Sheet';
import BadgeSeal from '../../components/ui/BadgeSeal';
import ProgressBar from '../../components/ui/ProgressBar';
import Disclaimer from '../../components/ui/Disclaimer';
import { type } from '../../components/ui/Typography';
import { useBadges, useStats } from '../../data/hooks';
import { formatDate } from '../../data/fieldNotes';
import { BADGES, LEVELS, badgeText, levelFor, levelTitle } from '../../data/gamification';
import { t } from '../../i18n';
import { colors, fonts } from '../../theme';

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** A badge in the grid. Faded while not yet earned; shows progress like "3 / 5". */
function Badge({ badge, earnedAt, progress, onPress }) {
  const { title, description } = badgeText(badge);
  const earned = !!earnedAt;
  const showProgress = !earned && progress && progress.target > 1 && progress.value > 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.badge, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${description}${earned ? '' : t('profile.notEarned')}`}
    >
      <BadgeSeal icon={badge.icon} earned={earned} />
      <Text style={[styles.badgeTitle, !earned && { color: colors.inkFaint }]}>{title}</Text>
      {showProgress && (
        <Text style={styles.badgeProgress}>{t('profile.progress', { value: Math.min(progress.value, progress.target), target: progress.target })}</Text>
      )}
    </Pressable>
  );
}

/** The sheet that opens when a badge is tapped */
function BadgeSheet({ badge, earnedAt, progress, onClose }) {
  const { title, description, goal } = badgeText(badge);
  const earned = !!earnedAt;
  const value = Math.min(progress?.value ?? 0, progress?.target ?? 1);
  return (
    <Sheet title={title} onClose={onClose}>
      <View style={styles.sheetBody}>
        <BadgeSeal icon={badge.icon} earned={earned} size={96} />
        <Text style={[type.body, type.center]}>{earned ? description : goal}</Text>
        {earned ? (
          <Text style={[type.small, type.center]}>{t('profile.earnedOn', { date: formatDate(earnedAt) })}</Text>
        ) : (
          <View style={styles.sheetProgress}>
            <View style={styles.levelRow}>
              <Text style={type.small}>{t('profile.stillLocked')}</Text>
              <Text style={type.small}>{t('profile.progress', { value, target: progress?.target ?? 1 })}</Text>
            </View>
            <ProgressBar value={value / (progress?.target ?? 1)} />
            {badge.key === 'trailFriend' && <Text style={[type.small, type.center]}>{t('profile.tripsLater')}</Text>}
          </View>
        )}
      </View>
    </Sheet>
  );
}

export default function ProfileScreen() {
  const stats = useStats();
  const badges = useBadges();
  const [openBadge, setOpenBadge] = useState(null);
  const { current, next, index, progress } = levelFor(stats.points);
  const earnedCount = BADGES.filter((b) => badges.earned[b.key]).length;

  return (
    <Screen>
      <PageHeader eyebrow={t('profile.eyebrow')} title={levelTitle(current)} />

      {/* Level progress */}
      <Paper style={{ gap: 10 }}>
        <View style={styles.levelRow}>
          <Text style={type.small}>{t('common.points', { count: stats.points })}</Text>
          <Text style={type.small}>{next ? `${levelTitle(next)}: ${next.minPoints}` : t('profile.topLevel')}</Text>
        </View>
        <ProgressBar value={progress} />
      </Paper>

      {/* Totals */}
      <Paper style={styles.stats}>
        <Stat value={stats.speciesCount} label={t('profile.species')} />
        <Stat value={stats.points} label={t('profile.points')} />
        <Stat value={stats.tripCount} label={t('profile.trips')} />
      </Paper>

      {/* Badges */}
      <View style={styles.section}>
        <View style={{ gap: 2 }}>
          <Text style={type.h2}>{t('profile.badges')}</Text>
          <Text style={type.small}>
            {t('profile.badgesCount', { earned: earnedCount, total: BADGES.length })} · {t('profile.badgeHint')}
          </Text>
        </View>
        <View style={styles.badgeGrid}>
          {BADGES.map((b) => (
            <Badge
              key={b.key}
              badge={b}
              earnedAt={badges.earned[b.key]}
              progress={badges.progress[b.key]}
              onPress={() => setOpenBadge(b)}
            />
          ))}
        </View>
      </View>

      {/* Ladder of titles */}
      <View style={styles.section}>
        <Text style={type.h2}>{t('profile.levels')}</Text>
        <Paper style={{ paddingVertical: 10 }}>
          {LEVELS.map((lvl, i) => {
            const reached = i <= index;
            const color = reached ? colors.forest : colors.inkFaint;
            return (
              <View key={lvl.key} style={styles.ladderRow}>
                {i < LEVELS.length - 1 && <View style={styles.ladderLine} />}
                <View style={[styles.ladderDot, { borderColor: reached ? colors.mustard : color }, reached && styles.ladderDotOn]} />
                <Text style={[styles.ladderTitle, { color }]}>{levelTitle(lvl)}</Text>
                <Text style={[styles.ladderPts, { color }]}>{t('common.points', { count: lvl.minPoints })}</Text>
              </View>
            );
          })}
        </Paper>
      </View>

      <Disclaimer />

      {openBadge && (
        <BadgeSheet
          badge={openBadge}
          earnedAt={badges.earned[openBadge.key]}
          progress={badges.progress[openBadge.key]}
          onClose={() => setOpenBadge(null)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  levelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stats: { flexDirection: 'row', paddingVertical: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statValue: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 32, color: colors.forest },
  statLabel: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSoft, marginTop: 4 },
  section: { gap: 12 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  badge: { width: '33.33%', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  badgeTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, lineHeight: 16, color: colors.ink, textAlign: 'center' },
  badgeProgress: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.moss, marginTop: -3 },
  sheetBody: { alignItems: 'center', gap: 14, paddingVertical: 8 },
  sheetProgress: { alignSelf: 'stretch', gap: 8 },
  ladderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  // thin line connecting the dots
  ladderLine: {
    position: 'absolute',
    left: 6.25,
    top: '50%',
    height: '100%',
    width: 1.5,
    backgroundColor: colors.paperEdge,
  },
  ladderDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, backgroundColor: colors.paper },
  ladderDotOn: { backgroundColor: colors.mustard },
  ladderTitle: { flex: 1, fontFamily: fonts.serif, fontSize: 18.5 },
  ladderPts: { fontFamily: fonts.sans, fontSize: 12.5 },
});
