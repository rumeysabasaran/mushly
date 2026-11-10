/*
  BOOK COVER — a dark green notebook cover with a gold frame.
  The page edges on the right get thicker as species are added: you can see the book grow.

  small: the little cover on the home screen (emblem and title only)
  fill:  the cover inside the book (fills its whole area)
*/
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { CornerFlourish, MushroomSketch } from '../ui/Ornaments';
import { PaperTexture } from '../ui/Paper';
import { t, upper } from '../../i18n';
import { colors, fonts } from '../../theme';

const GOLD = 'rgba(210, 160, 58, 0.75)';

/** Page edges peeking out behind the cover: cream with thin lines */
export function PageEdges({ style }) {
  return (
    <View style={[styles.edges, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="edge" width={3} height={4} patternUnits="userSpaceOnUse">
            <Rect width={2} height={4} fill={colors.paper} />
            <Rect x={2} width={1} height={4} fill={colors.paperEdge} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#edge)" />
      </Svg>
    </View>
  );
}

export default function BookCover({ speciesCount = 0, small = false, fill = false, width, style }) {
  // thin with 0 species, a little thicker with each one (at most 22px)
  const thickness = fill ? 0 : Math.min(22, 4 + speciesCount * 0.6);
  const cornerSize = small ? 28 : 40;

  return (
    <View
      style={[
        fill ? styles.fill : [styles.cover, { width: width ?? (small ? 108 : 300) }],
        { paddingRight: thickness },
        !fill && styles.drop,
        style,
      ]}
    >
      {!fill && <PageEdges style={{ width: thickness + 12 }} />}

      <View style={[styles.front, fill && styles.frontFill]}>
        <PaperTexture opacity={0.6} />
        {/* spine shadow on the left */}
        <LinearGradient
          colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0)']}
          locations={[0, 0.09, 0.11]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* soft light from above */}
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
          start={{ x: 0.7, y: 0 }}
          end={{ x: 0.3, y: 0.7 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={[styles.frameOuter, small && styles.frameOuterSmall]} pointerEvents="none" />
        <View style={styles.frame}>
          {!small && (
            <>
              <CornerFlourish size={cornerSize} color={GOLD} style={[styles.corner, { top: 4, left: 4 }]} />
              <CornerFlourish size={cornerSize} color={GOLD} rotate={90} style={[styles.corner, { top: 4, right: 4 }]} />
              <CornerFlourish size={cornerSize} color={GOLD} rotate={180} style={[styles.corner, { bottom: 4, right: 4 }]} />
              <CornerFlourish size={cornerSize} color={GOLD} rotate={270} style={[styles.corner, { bottom: 4, left: 4 }]} />
            </>
          )}

          <MushroomSketch size={small ? 40 : 76} color={colors.mustard} />
          <Text style={[styles.title, small && styles.titleSmall]}>{t('app.name')}</Text>
          {!small && (
            <>
              <Text style={styles.subtitle}>{t('app.tagline')}</Text>
              <Text style={styles.count}>
                {upper(speciesCount === 0 ? t('book.emptyCover') : t('common.speciesCount', { count: speciesCount }))}
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { aspectRatio: 3 / 4, alignSelf: 'center' },
  fill: { flex: 1, width: '100%', height: '100%' },
  drop: {
    shadowColor: colors.forestDeep,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  edges: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    right: 0,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    overflow: 'hidden',
  },
  front: {
    flex: 1,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: colors.forest,
    overflow: 'hidden',
    paddingTop: '9%',
    paddingBottom: '9%',
    paddingLeft: '12%',
    paddingRight: '8%',
  },
  frontFill: { borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  frame: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: 'rgba(210, 160, 58, 0.7)',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 6,
  },
  // a second, thinner frame (the outer line)
  frameOuter: {
    position: 'absolute',
    top: '9%',
    bottom: '9%',
    left: '12%',
    right: '8%',
    margin: -5,
    borderWidth: 1,
    borderColor: 'rgba(210, 160, 58, 0.35)',
    borderRadius: 5,
  },
  frameOuterSmall: { margin: -3 },
  corner: { position: 'absolute' },
  title: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 36, color: colors.mustard, letterSpacing: 0.6, textAlign: 'center' },
  titleSmall: { fontSize: 16, lineHeight: 18 },
  subtitle: { fontFamily: fonts.serifItalic, fontSize: 16, color: colors.mustardSoft, opacity: 0.85 },
  count: {
    marginTop: 6,
    fontFamily: fonts.sansBold,
    fontSize: 11.5,
    letterSpacing: 1.8,
    color: colors.mustardSoft,
    opacity: 0.7,
  },
});
