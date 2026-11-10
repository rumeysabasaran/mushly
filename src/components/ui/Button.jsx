/*
  BUTTONS
  - primary: dark green, the main action ("Save to journal")
  - ghost:   outlined, a secondary action ("Choose from gallery")
  - text:    looks like text, no border ("Cancel")
  The touch target is at least 48 px; it shrinks slightly when pressed and the phone gives a short haptic tap.
*/
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Icon from './Icon';
import { colors, fonts, radius } from '../../theme';

export default function Button({
  title,
  icon,
  onPress,
  variant = 'primary',
  block = false,
  small = false,
  disabled = false,
  color, // to change the label color of a text button
  style,
  haptic = true,
  accessibilityLabel,
}) {
  const v = VARIANTS[variant];
  const textColor = color ?? v.text;

  return (
    <Pressable
      onPress={(e) => {
        if (haptic && variant === 'primary') Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        variant === 'text' && styles.textBase,
        { backgroundColor: pressed && v.pressedBg ? v.pressedBg : v.bg, borderColor: v.border },
        block && styles.block,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.row}>
        {icon && <Icon name={icon} size={small ? 18 : 21} color={textColor} />}
        {!!title && <Text style={[styles.label, small && styles.labelSmall, { color: textColor }]}>{title}</Text>}
      </View>
    </Pressable>
  );
}

const VARIANTS = {
  primary: { bg: colors.forest, pressedBg: colors.forestDeep, text: colors.cream, border: 'transparent' },
  ghost: { bg: 'transparent', pressedBg: 'rgba(46,74,51,0.06)', text: colors.forest, border: colors.forest },
  text: { bg: 'transparent', pressedBg: null, text: colors.inkSoft, border: 'transparent' },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  textBase: { minHeight: 44, alignSelf: 'center' },
  small: { minHeight: 38, paddingHorizontal: 14 },
  block: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.97 }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: fonts.sansBold, fontSize: 16 },
  labelSmall: { fontSize: 14 },
});
