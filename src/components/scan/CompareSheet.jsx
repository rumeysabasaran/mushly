/*
  COMPARE SHEET — puts the user's photo next to reference photos of one candidate,
  so people who don't know mushrooms can choose by eye.

  Reference photos come from iNaturalist (openly licensed, see server/inaturalist.js);
  the photographer's credit is always shown, as the licenses require.
*/
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { commonNameOf, displayName } from '../../services/safety';
import { t, upper } from '../../i18n';
import { colors, fonts, radius } from '../../theme';

function Labeled({ label, children }) {
  return (
    <View style={styles.column}>
      <Text style={styles.label}>{upper(label)}</Text>
      <View style={styles.square}>{children}</View>
    </View>
  );
}

export default function CompareSheet({ candidate, userPhotoUri, onChoose, onClose }) {
  const photos = candidate.referencePhotos ?? [];
  const [index, setIndex] = useState(0);
  const current = photos[index];

  return (
    <Sheet title={displayName(candidate)} onClose={onClose}>
      {({ close }) => (
        <>
          {!!commonNameOf(candidate) && <Text style={styles.latin}>{candidate.latinName}</Text>}

          <View style={styles.row}>
            <Labeled label={t('compare.yourPhoto')}>
              {!!userPhotoUri && <Image source={{ uri: userPhotoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
            </Labeled>
            <Labeled label={photos.length ? t('compare.reference', { index: index + 1, total: photos.length }) : t('compare.referenceTitle')}>
              {current ? (
                <Image source={{ uri: current.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              ) : (
                <Text style={styles.empty}>{t('compare.noPhotos')}</Text>
              )}
            </Labeled>
          </View>

          {photos.length > 1 && (
            <View style={styles.strip}>
              {photos.map((p, i) => (
                <Pressable
                  key={p.url}
                  onPress={() => setIndex(i)}
                  style={[styles.thumb, i === index && styles.thumbOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: i === index }}
                  accessibilityLabel={t('compare.showPhoto', { index: i + 1 })}
                >
                  <Image source={{ uri: p.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          )}

          {!!current?.attribution && <Text style={styles.credit}>{t('compare.credit', { attribution: current.attribution })}</Text>}

          {!!candidate.tellApart && (
            <View style={styles.tip}>
              <View style={styles.tipTitleRow}>
                <Icon name="eye" size={16} color={colors.earth} />
                <Text style={styles.tipTitle}>{t('identify.tellApart')}</Text>
              </View>
              <Text style={styles.tipText}>{candidate.tellApart}</Text>
            </View>
          )}

          <Button
            block
            title={t('compare.choose')}
            onPress={() => {
              onChoose();
              close();
            }}
          />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  latin: { fontFamily: fonts.serifItalic, fontSize: 17, color: colors.inkSoft, marginTop: -6 },
  row: { flexDirection: 'row', gap: 10 },
  column: { flex: 1, gap: 6 },
  label: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.2, color: colors.earth },
  square: {
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.paperEdge,
    borderWidth: 4,
    borderColor: colors.paperWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkSoft, textAlign: 'center', padding: 10 },
  strip: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  thumb: { width: 52, height: 52, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.paperEdge, opacity: 0.6 },
  thumbOn: { opacity: 1, borderWidth: 2, borderColor: colors.forest },
  credit: { fontFamily: fonts.sansItalic, fontSize: 11.5, lineHeight: 16, color: colors.inkFaint, marginTop: -8 },
  tip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(240, 223, 180, 0.55)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.mustard,
  },
  tipTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  tipTitle: { fontFamily: fonts.serif, fontSize: 17, color: colors.earth },
  tipText: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21, color: colors.ink },
});
