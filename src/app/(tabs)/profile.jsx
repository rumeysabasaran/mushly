/*
  PROFILE — level, totals, badges and the ladder of titles.
*/
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/ui/Screen';
import PageHeader from '../../components/ui/PageHeader';
import Paper from '../../components/ui/Paper';
import Icon from '../../components/ui/Icon';
import ProgressBar from '../../components/ui/ProgressBar';
import Disclaimer from '../../components/ui/Disclaimer';
import { type } from '../../components/ui/Typography';
import { useStats } from '../../data/hooks';
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

/** A round, seal-like badge. Faded while not yet earned. */
function Badge({ badge, earned = false }) {
  const { title, description } = badgeText(badge);
  return (
    <View style={styles.badge} accessibilityLabel={`${title}: ${description}${earned ? '' : t('profile.notEarned')}`}>
      <View style={[styles.sealRing, !earned && styles.sealRingLocked]}>
        <View style={[styles.seal, !earned && styles.sealLocked]}>
          <Icon name={badge.icon} size={24} color={earned ? colors.forest : colors.inkFaint} />
        </View>
      </View>
      <Text style={[styles.badgeTitle, !earned && { color: colors.inkFaint }]}>{title}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const stats = useStats();
  const { current, next, index, progress } = levelFor(stats.points);

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
        <Text style={type.h2}>{t('profile.badges')}</Text>
        <View style={styles.badgeGrid}>
          {BADGES.map((b) => (
            <Badge key={b.key} badge={b} />
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
  // dashed outer ring + inner seal
  sealRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.mustard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealRingLocked: { borderColor: colors.paperEdge },
  seal: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    borderColor: colors.mustard,
    backgroundColor: colors.mustardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealLocked: { backgroundColor: 'transparent', borderColor: colors.paperEdge },
  badgeTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, lineHeight: 16, color: colors.ink, textAlign: 'center' },
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
