/*
  BADGE SEAL — a round, wax-seal-like badge: a dashed outer ring and an inner seal with
  the badge's icon. Faded while not yet earned. Used on the profile and in celebrations.
*/
import { StyleSheet, View } from 'react-native';
import Icon from './Icon';
import { colors } from '../../theme';

export default function BadgeSeal({ icon, earned = true, size = 70, iconScale = 0.34 }) {
  const inner = size - 8;
  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2 },
        !earned && styles.ringLocked,
      ]}
    >
      <View style={[styles.seal, { width: inner, height: inner, borderRadius: inner / 2 }, !earned && styles.sealLocked]}>
        <Icon name={icon} size={Math.round(size * iconScale)} color={earned ? colors.forest : colors.inkFaint} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.mustard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLocked: { borderColor: colors.paperEdge },
  seal: {
    borderWidth: 1.5,
    borderColor: colors.mustard,
    backgroundColor: colors.mustardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealLocked: { backgroundColor: 'transparent', borderColor: colors.paperEdge },
});
