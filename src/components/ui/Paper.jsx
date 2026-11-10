/*
  PAPER — the app's base surface: cream paper, light grain, a thin edge and a soft shadow.
  - <Paper>             a card
  - <Paper onPress>     a tappable card (sinks in slightly when pressed)
  - <PaperTexture />    adds the grain texture on top of any surface
*/
import { useId } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, Image as SvgImage, Pattern, Rect } from 'react-native-svg';
import { colors, paperNoise, radius, shadows } from '../../theme';

const TILE = 128; // on-screen size of one texture tile (points)

/*
  The grain is drawn by tiling a small image as an SVG pattern.
  (The image's own "repeat" mode didn't cover the whole surface on iPhone.)
*/
export function PaperTexture({ borderRadius = 0, opacity = 1 }) {
  const id = `grain-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
            <SvgImage href={paperNoise} x={0} y={0} width={TILE} height={TILE} preserveAspectRatio="none" />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" rx={borderRadius} ry={borderRadius} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export default function Paper({ children, style, onPress, padded = true, dashed = false, accessibilityLabel, ...rest }) {
  const content = (
    <>
      <PaperTexture borderRadius={radius.md} />
      {children}
    </>
  );
  const base = [styles.paper, padded && styles.padded, dashed && styles.dashed];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [...base, style, pressed && styles.pressed]}
        {...rest}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View style={[...base, style]} {...rest}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    borderRadius: radius.md,
    ...shadows.paper,
  },
  padded: { padding: 18 },
  dashed: { borderStyle: 'dashed', borderWidth: 1.5 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.96 },
});
