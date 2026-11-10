/*
  POLAROID — shows a photo as if it were taped onto the page.
  A translucent piece of tape on top, a handwritten-style date underneath.
  tilt: a slight angle (degrees), so each photo sits a little differently.
*/
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, shadows } from '../../theme';

export default function Polaroid({ uri, caption, tilt = -1.5, width = 240, tape = true, style }) {
  const small = width < 130;
  const pad = small ? 6 : 12;
  return (
    <View
      style={[
        styles.frame,
        { width, padding: pad, paddingBottom: caption ? pad + 2 : pad, transform: [{ rotate: `${tilt}deg` }] },
        style,
      ]}
    >
      <View style={styles.photoBox}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} /> : null}
      </View>
      {!!caption && <Text style={styles.caption}>{caption}</Text>}
      {tape && (
        <View
          style={[
            styles.tape,
            small ? { width: 40, height: 14, top: -7, marginLeft: -20 } : { width: 86, height: 24, top: -11, marginLeft: -43 },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.paperWhite, ...shadows.paper },
  photoBox: { width: '100%', aspectRatio: 1, backgroundColor: colors.paperEdge, overflow: 'hidden' },
  caption: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: fonts.serifItalic,
    fontSize: 17,
    color: colors.inkSoft,
  },
  // sticky tape
  tape: {
    position: 'absolute',
    left: '50%',
    backgroundColor: 'rgba(240, 223, 180, 0.78)',
    transform: [{ rotate: '-3deg' }],
  },
});
