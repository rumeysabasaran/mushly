/*
  CANDIDATE LIST — the 3 most likely species suggested by recognition, with confidence.
  The user taps one to choose it.
*/
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Paper from '../ui/Paper';
import Chip from '../ui/Chip';
import ProgressBar from '../ui/ProgressBar';
import { rarityLabel } from '../../data/gamification';
import { commonNameOf, displayName } from '../../services/safety';
import { t } from '../../i18n';
import { colors, fonts, shadows } from '../../theme';

export default function CandidateList({ candidates, selectedIndex, onSelect }) {
  return (
    <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={t('identify.candidatesLabel')}>
      {candidates.map((c, i) => {
        const selected = i === selectedIndex;
        return (
          <Paper
            key={c.latinName}
            padded={false}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onSelect(i);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={t('identify.candidateLabel', { name: displayName(c), confidence: c.confidence })}
            style={[styles.card, selected && styles.selected]}
          >
            <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
            <View style={styles.body}>
              <Text style={styles.name}>{displayName(c)}</Text>
              {!!commonNameOf(c) && <Text style={styles.latin}>{c.latinName}</Text>}
              {!!c.habitat && <Text style={styles.hint}>{c.habitat}</Text>}
              <View style={styles.meta}>
                <ProgressBar value={c.confidence / 100} height={6} color={colors.moss} style={{ flex: 1 }} />
                <Text style={styles.pct}>{t('identify.percent', { value: c.confidence })}</Text>
                <Chip small label={rarityLabel(c.rarity)} />
              </View>
            </View>
          </Paper>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 16 },
  selected: { borderColor: colors.forest, borderWidth: 2, margin: -0.5, ...shadows.paper },
  radio: {
    width: 20,
    height: 20,
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.forest },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.forest },
  body: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 25, color: colors.forest },
  latin: { fontFamily: fonts.serifItalic, fontSize: 16, color: colors.inkSoft },
  hint: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19, color: colors.inkSoft, marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  pct: { fontFamily: fonts.sansHeavy, fontSize: 13.5, color: colors.forest, minWidth: 36 },
});
