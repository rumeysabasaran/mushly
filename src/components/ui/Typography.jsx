/*
  TYPOGRAPHY — headings in serif (Cormorant Garamond), body text in Nunito.
  Kept in one place so every screen uses the same sizes.
  Usage: <Text style={type.h2}>Heading</Text>
*/
import { StyleSheet, Text } from 'react-native';
import { upper } from '../../i18n';
import { colors, fonts } from '../../theme';

/**
 * A small uppercase label ("NEW DISCOVERY").
 * Uppercased with the current language's rules (Turkish: i → İ); textTransform can't be trusted for this.
 */
export function Eyebrow({ children, style }) {
  const text = upper(children);
  return <Text style={[type.eyebrow, style]}>{text}</Text>;
}

export const type = StyleSheet.create({
  h1: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 39, color: colors.forest },
  h2: { fontFamily: fonts.serif, fontSize: 25, lineHeight: 30, color: colors.forest },
  h3: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 24, color: colors.forest },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: colors.ink },
  muted: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: colors.inkSoft },
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  eyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 11.5,
    letterSpacing: 1.6,
    color: colors.earth,
  },
  serifItalic: { fontFamily: fonts.serifItalic, fontSize: 17, lineHeight: 22, color: colors.inkSoft },
  link: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.forest },
  center: { textAlign: 'center' },
});
