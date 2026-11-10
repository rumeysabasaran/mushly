/*
  SCREEN — the scrollable body of every screen.
  Leaves room for the notch / status bar on top and the tab bar at the bottom.
  The screen fades in with a slight upward slide when first shown.
  keyboard: on screens with forms, content is pushed up when the keyboard opens.
*/
import { forwardRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, space } from '../../theme';

const Screen = forwardRef(function Screen({ children, keyboard = false, withNav = true, contentStyle }, ref) {
  const insets = useSafeAreaInsets();
  const paddingTop = insets.top + 20;
  const paddingBottom = (withNav ? layout.navHeight : 0) + insets.bottom + 36;

  const body = (
    <ScrollView
      ref={ref}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop, paddingBottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(280).withInitialValues({ transform: [{ translateY: 6 }] })} style={styles.inner}>
        {children}
      </Animated.View>
    </ScrollView>
  );

  if (!keyboard) return body;
  return (
    <KeyboardAvoidingView style={styles.scroll} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {body}
    </KeyboardAvoidingView>
  );
});

export default Screen;

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: space.gutter, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  inner: { gap: space.gap },
});
