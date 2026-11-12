/*
  PROFILE — level, totals, badges, the ladder of titles, highlights and recent points.
  Tapping a badge opens a small sheet: how to earn it, progress, or when it was earned.
*/
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/ui/Screen';
import PageHeader from '../../components/ui/PageHeader';
import Paper from '../../components/ui/Paper';
import Sheet from '../../components/ui/Sheet';
import BadgeSeal from '../../components/ui/BadgeSeal';
import Icon from '../../components/ui/Icon';
import ProgressBar from '../../components/ui/ProgressBar';
import Disclaimer from '../../components/ui/Disclaimer';
import { type } from '../../components/ui/Typography';
import { useBadges, useProfileHighlights, useStats } from '../../data/hooks';
import { formatDate, formatDuration, tripName } from '../../data/fieldNotes';
import { displayName } from '../../services/safety';
import { BADGES, LEVELS, badgeText, levelFor, levelTitle, rarityLabel } from '../../data/gamification';
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

/** One line in "Highlights": a label on the left, the value on the right */
function Highlight({ icon, label, value }) {
  return (
    <View style={styles.highlight}>
      <Icon name={icon} size={18} color={colors.moss} />
      <Text style={styles.highlightLabel}>{label}</Text>
      <Text style={styles.highlightValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
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
          </View>
        )}
      </View>
    </Sheet>
  );
}

export default function ProfileScreen() {
  const stats = useStats();
  const badges = useBadges();
  const highlights = useProfileHighlights();
  const [openBadge, setOpenBadge] = useState(null);
  const { current, next, index, progress } = levelFor(stats.points);
  const earnedCount = BADGES.filter((b) => badges.earned[b.key]).length;

  return (
    <Screen>
      <PageHeader
        eyebrow={t('profile.eyebrow')}
        title={levelTitle(current)}
        subtitle={highlights.since ? t('profile.since', { date: formatDate(highlights.since) }) : undefined}
      />

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
        <Stat value={highlights.findCount} label={t('profile.finds')} />
        <Stat value={stats.tripCount} label={t('profile.trips')} />
        <Stat value={stats.points} label={t('profile.points')} />
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

      {/* Highlights */}
      {(highlights.mostSeen || highlights.rarest || highlights.longestTrip) && (
        <View style={styles.section}>
          <Text style={type.h2}>{t('profile.highlights')}</Text>
          <Paper style={{ paddingVertical: 6 }}>
            {highlights.rarest && (
              <Highlight
                icon="sparkle"
                label={t('profile.rarest')}
                value={`${displayName(highlights.rarest)} · ${rarityLabel(highlights.rarest.rarity)}`}
              />
            )}
            {highlights.mostSeen && (
              <Highlight
                icon="eye"
                label={t('profile.mostSeen')}
                value={t('profile.mostSeenValue', { name: displayName(highlights.mostSeen), count: highlights.mostSeen.seenCount })}
              />
            )}
            {highlights.longestTrip && (
              <Highlight
                icon="trail"
                label={t('profile.longestTrip')}
                value={t('profile.longestTripValue', {
                  name: tripName(highlights.longestTrip),
                  duration: formatDuration(highlights.longestTrip.endedAt - highlights.longestTrip.startedAt),
                })}
              />
            )}
          </Paper>
        </View>
      )}

      {/* Recent points */}
      <View style={styles.section}>
        <Text style={type.h2}>{t('profile.recentPoints')}</Text>
        <Paper style={{ paddingVertical: 6 }}>
          {highlights.recentPoints.length === 0 ? (
            <Text style={[type.small, { paddingVertical: 10 }]}>{t('profile.noPoints')}</Text>
          ) : (
            highlights.recentPoints.map((p) => {
              const name = p.species ? displayName(p.species) : '';
              return (
                <View key={p.id} style={styles.pointRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pointReason} numberOfLines={1}>
                      {p.reason === 'new-species' ? t('profile.reasonNew', { name }) : t('profile.reasonRepeat', { name })}
                    </Text>
                    {!!p.foundAt && <Text style={type.small}>{formatDate(p.foundAt)}</Text>}
                  </View>
                  <Text style={styles.pointAmount}>{t('common.pointsEarned', { count: p.amount })}</Text>
                </View>
              );
            })
          )}
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
  highlight: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  highlightLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.inkSoft, width: 118 },
  highlightValue: { flex: 1, fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.forest, textAlign: 'right' },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  pointReason: { fontFamily: fonts.sansBold, fontSize: 14.5, color: colors.ink },
  pointAmount: { fontFamily: fonts.sansHeavy, fontSize: 14, color: colors.moss },
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
