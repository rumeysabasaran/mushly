/*
  SHEET — a paper panel that slides up from the bottom of the screen.
  Closes by tapping the backdrop, the ✕ button, the phone's back button, or dragging the header down.
  variant="photo": a large photo view on a dark backdrop.

  Usage: {open && <Sheet title="..." onClose={...}>...</Sheet>}
  When closing it slides down first, then calls onClose.
*/
import { useCallback, useEffect } from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, interpolate } from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { PaperTexture } from './Paper';
import { type } from './Typography';
import { t } from '../../i18n';
import { colors, layout, radius, space } from '../../theme';

const SCREEN_H = Dimensions.get('window').height;
const EASE = Easing.bezier(0.25, 0.8, 0.3, 1);

export default function Sheet({ title, onClose, children, variant = 'paper' }) {
  const insets = useSafeAreaInsets();
  const isPhoto = variant === 'photo';
  const offset = useSharedValue(SCREEN_H); // 0 = open, SCREEN_H = hidden below
  const drag = useSharedValue(0);

  useEffect(() => {
    offset.value = withTiming(0, { duration: 320, easing: EASE });
  }, [offset]);

  const close = useCallback(() => {
    offset.value = withTiming(SCREEN_H, { duration: 240, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) scheduleOnRN(onClose);
    });
  }, [offset, onClose]);

  // Dragging the header down closes it
  const pan = usePanGesture({
    activeOffsetY: 8,
    onUpdate: (e) => {
      'worklet';
      drag.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      if (drag.value > 120 || e.velocityY > 900) {
        offset.value = withTiming(SCREEN_H, { duration: 220 }, (finished) => {
          if (finished) scheduleOnRN(onClose);
        });
      } else {
        drag.value = withTiming(0, { duration: 200, easing: EASE });
      }
    },
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value + drag.value, [0, SCREEN_H * 0.6], [1, 0], 'clamp'),
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (isPhoto ? offset.value * 0.15 : offset.value) + drag.value }],
    opacity: isPhoto ? interpolate(offset.value, [0, SCREEN_H * 0.3], [1, 0], 'clamp') : 1,
  }));

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, isPhoto ? styles.backdropPhoto : styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t('common.close')} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.holder, isPhoto && styles.holderPhoto]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              isPhoto ? styles.photoSheet : styles.sheet,
              { maxHeight: SCREEN_H * 0.92, paddingBottom: insets.bottom },
              sheetStyle,
            ]}
            accessibilityViewIsModal
          >
            {!isPhoto && <PaperTexture borderRadius={radius.lg} />}

            <GestureDetector gesture={pan}>
              <View style={[styles.head, isPhoto && { paddingTop: insets.top + 6 }]}>
                {!isPhoto && <View style={styles.grip} />}
                {!!title && !isPhoto && (
                  <Text style={[type.h2, styles.title]} accessibilityRole="header">
                    {title}
                  </Text>
                )}
                <Pressable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
                  <Icon name="close" size={22} color={isPhoto ? colors.cream : colors.inkSoft} />
                </Pressable>
              </View>
            </GestureDetector>

            <ScrollView
              contentContainerStyle={[styles.body, isPhoto && styles.bodyPhoto]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {typeof children === 'function' ? children({ close }) : children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(30, 40, 28, 0.45)' },
  backdropPhoto: { backgroundColor: 'rgba(20, 26, 18, 0.9)' },
  holder: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  holderPhoto: { justifyContent: 'center' },
  sheet: {
    width: '100%',
    maxWidth: layout.maxWidth,
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  photoSheet: { width: '100%', maxWidth: layout.maxWidth },
  head: { minHeight: 54, paddingTop: 14, paddingBottom: 8, paddingLeft: space.gutter, paddingRight: 56 },
  grip: {
    position: 'absolute',
    top: 7,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.paperEdge,
  },
  title: { paddingTop: 6 },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: space.gutter, paddingTop: 4, paddingBottom: 22, gap: 16 },
  bodyPhoto: { alignItems: 'center' },
});
