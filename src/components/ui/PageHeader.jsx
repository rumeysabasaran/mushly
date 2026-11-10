/*
  PAGE HEADER — a small label on top, a large serif title and a fern ornament in the corner.
*/
import { StyleSheet, Text, View } from 'react-native';
import { FernSprig } from './Ornaments';
import { Eyebrow, type } from './Typography';
import { colors } from '../../theme';

export default function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <View style={styles.header} accessibilityRole="header">
      <FernSprig size={84} flip color={colors.moss} style={styles.fern} />
      {!!eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Text style={type.h1}>{title}</Text>
      {!!subtitle && <Text style={type.muted}>{subtitle}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, paddingRight: 70, minHeight: 72 },
  fern: { position: 'absolute', top: -8, right: -6, opacity: 0.55 },
});
