/*
  CHIP — a small label for things like rarity, points or season.
  variant: default (mustard) | quiet (outlined) | points (green)
*/
import { StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { colors, fonts, radius } from '../../theme';

export default function Chip({ label, icon, variant = 'default', small = false, style }) {
  const v = VARIANTS[variant];
  return (
    <View style={[styles.chip, small && styles.small, { backgroundColor: v.bg, borderColor: v.border }, style]}>
      {icon && <Icon name={icon} size={small ? 12 : 14} color={v.text} />}
      <Text style={[styles.label, small && styles.labelSmall, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const VARIANTS = {
  default: { bg: colors.mustardSoft, text: colors.earth, border: 'transparent' },
  quiet: { bg: 'transparent', text: colors.inkSoft, border: colors.paperEdge },
  points: { bg: colors.forest, text: colors.cream, border: 'transparent' },
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  small: { paddingVertical: 2, paddingHorizontal: 9 },
  label: { fontFamily: fonts.sansBold, fontSize: 13 },
  labelSmall: { fontSize: 11.5 },
});
