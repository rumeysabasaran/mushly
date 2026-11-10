/*
  CANDIDATE LIST — the 3 most likely species suggested by recognition, with confidence.
  The user taps a card to choose it.

  Each card shows a reference photo of the species (from iNaturalist) and a one-line
  "how to tell" tip, so people who don't know mushrooms can still choose. Tapping the
  photo opens a side-by-side comparison with the user's own photo (CompareSheet).

  userPhotoUri: the user's photo, for the comparison. Without it (e.g. inside another
  sheet, where a second sheet can't open) the reference photo is shown but not tappable.
*/
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Paper from '../ui/Paper';
import Chip from '../ui/Chip';
import Icon from '../ui/Icon';
import ProgressBar from '../ui/ProgressBar';
import CompareSheet from './CompareSheet';
import { rarityLabel } from '../../data/gamification';
import { commonNameOf, displayName } from '../../services/safety';
import { t } from '../../i18n';
import { colors, fonts, shadows } from '../../theme';

function ReferenceThumb({ candidate, onPress }) {
  const photo = candidate.referencePhotos?.[0];
  if (!photo) return null;
  const image = <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />;
  if (!onPress) return <View style={styles.thumb}>{image}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.thumb, pressed && { opacity: 0.8 }]}
      accessibilityRole="imagebutton"
      accessibilityLabel={t('identify.comparePhotos')}
      hitSlop={6}
    >
      {image}
      <View style={styles.thumbBadge}>
        <Icon name="gallery" size={13} color={colors.cream} strokeWidth={1.8} />
      </View>
    </Pressable>
  );
}

export default function CandidateList({ candidates, selectedIndex, onSelect, userPhotoUri }) {
  const [comparing, setComparing] = useState(null); // index of the candidate being compared

  const select = (i) => {
    Haptics.selectionAsync().catch(() => {});
    onSelect(i);
  };

  return (
    <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={t('identify.candidatesLabel')}>
      {candidates.map((c, i) => {
        const selected = i === selectedIndex;
        return (
          <Paper
            key={c.latinName}
            padded={false}
            onPress={() => select(i)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={c.source === 'user' ? displayName(c) : t('identify.candidateLabel', { name: displayName(c), confidence: c.confidence })}
            style={[styles.card, selected && styles.selected]}
          >
            <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
            <View style={styles.body}>
              <View style={styles.head}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{displayName(c)}</Text>
                  {!!commonNameOf(c) && <Text style={styles.latin}>{c.latinName}</Text>}
                </View>
                <ReferenceThumb candidate={c} onPress={userPhotoUri ? () => setComparing(i) : undefined} />
              </View>
              {c.tellApart ? (
                <Text style={styles.hint}>
                  <Text style={styles.hintLabel}>{t('identify.tellApart')}: </Text>
                  {c.tellApart}
                </Text>
              ) : (
                !!c.habitat && <Text style={styles.hint}>{c.habitat}</Text>
              )}
              {c.source === 'user' ? (
                <View style={styles.meta}>
                  <Chip small variant="points" icon="check" label={t('identify.yourChoice')} />
                </View>
              ) : (
                <View style={styles.meta}>
                  <ProgressBar value={c.confidence / 100} height={6} color={colors.moss} style={{ flex: 1 }} />
                  <Text style={styles.pct}>{t('identify.percent', { value: c.confidence })}</Text>
                  <Chip small label={rarityLabel(c.rarity)} />
                </View>
              )}
            </View>
          </Paper>
        );
      })}

      {comparing !== null && (
        <CompareSheet
          candidate={candidates[comparing]}
          userPhotoUri={userPhotoUri}
          onChoose={() => select(comparing)}
          onClose={() => setComparing(null)}
        />
      )}
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
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  name: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 25, color: colors.forest },
  latin: { fontFamily: fonts.serifItalic, fontSize: 16, color: colors.inkSoft },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.paperEdge,
    borderWidth: 3,
    borderColor: colors.paperWhite,
    ...shadows.paper,
  },
  thumbBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(30, 51, 34, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19, color: colors.inkSoft, marginTop: 6 },
  hintLabel: { fontFamily: fonts.sansBold, color: colors.earth },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  pct: { fontFamily: fonts.sansHeavy, fontSize: 13.5, color: colors.forest, minWidth: 36 },
});
