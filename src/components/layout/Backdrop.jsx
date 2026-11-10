/*
  BACKDROP — the cream paper and grain texture behind every screen.
*/
import { StyleSheet, View } from 'react-native';
import { PaperTexture } from '../ui/Paper';
import { colors } from '../../theme';

export default function Backdrop() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.cream }]} pointerEvents="none">
      <PaperTexture />
    </View>
  );
}
