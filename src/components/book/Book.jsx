/*
  BOOK — the page-flipping engine

  How it works
  - Every page is a sheet of paper hinged on its left edge.
  - The book's `position` is a single number: 3 → page 3 is open; 3.4 → page 3 is 40% turned.
    Each leaf's angle is derived from that number: leaves before the position are turned to
    the left (-180°), leaves after it lie flat (0°), and the one in between sits halfway.
  - Animation and finger tracking run on the phone's UI thread, which keeps them smooth.

  Controls
  - Horizontal swipe (the page follows your finger; releasing past halfway completes the turn)
  - From outside via ref: next(), prev(), jumpTo(i), flipTo(i)

  Only the current page and its two neighbours are rendered, so it stays fast even with
  hundreds of species.
*/
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { PaperTexture } from '../ui/Paper';
import { PageEdges } from './BookCover';
import { colors } from '../../theme';

const FLIP_MS = 520;
const FLIP_EASE = Easing.bezier(0.3, 0.7, 0.25, 1);

const Book = forwardRef(function Book({ pages, index, onIndexChange }, ref) {
  const position = useSharedValue(index);
  const width = useSharedValue(Dimensions.get('window').width - 40); // rough value until measured
  const last = useSharedValue(pages.length - 1);
  const busy = useSharedValue(false); // is an animation running
  const indexRef = useRef(index);

  useEffect(() => {
    last.value = pages.length - 1;
  }, [pages.length, last]);

  // If the index changed from outside (e.g. a jump from Contents), move the position there
  useEffect(() => {
    if (indexRef.current !== index) {
      indexRef.current = index;
      if (!busy.value) position.value = index;
    }
  }, [index, position, busy]);

  const commit = useCallback(
    (i) => {
      indexRef.current = i;
      onIndexChange(i);
    },
    [onIndexChange]
  );

  const haptic = useCallback(() => Haptics.selectionAsync().catch(() => {}), []);

  /** Smoothly moves the position to the target, then reports the new page */
  const animateTo = useCallback(
    (target) => {
      'worklet';
      busy.value = true;
      position.value = withTiming(target, { duration: FLIP_MS, easing: FLIP_EASE }, (finished) => {
        busy.value = false;
        if (finished) scheduleOnRN(commit, Math.round(target));
      });
    },
    [busy, position, commit]
  );

  const flipBy = useCallback(
    (step) => {
      const from = indexRef.current;
      const target = from + step;
      if (busy.value || target < 0 || target > pages.length - 1) return;
      haptic();
      animateTo(target);
    },
    [animateTo, busy, haptic, pages.length]
  );

  useImperativeHandle(
    ref,
    () => ({
      next: () => flipBy(1),
      prev: () => flipBy(-1),
      /** Jump without animation */
      jumpTo: (i) => {
        position.value = i;
        commit(i);
      },
      /** Jump to the page before the target, then flip to it (e.g. after a new save) */
      flipTo: (i) => {
        if (i <= 0) return;
        position.value = i - 1;
        commit(i - 1);
        setTimeout(() => flipBy(1), 450);
      },
    }),
    [flipBy, position, commit]
  );

  // ---------- Finger gesture ----------
  const start = useSharedValue(0);
  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-14, 14], // vertical movement scrolls the page content instead of flipping
    onActivate: () => {
      'worklet';
      start.value = Math.round(position.value);
    },
    onUpdate: (e) => {
      'worklet';
      if (busy.value) return;
      const delta = -e.translationX / Math.max(1, width.value); // pulling left = forward
      const clamped = Math.max(-1, Math.min(1, delta));
      const target = Math.max(0, Math.min(last.value, start.value + clamped));
      position.value = target;
    },
    onDeactivate: (e) => {
      'worklet';
      if (busy.value) return;
      const moved = position.value - start.value; // -1 … 1
      const dir = moved > 0 ? 1 : moved < 0 ? -1 : 0;
      if (dir === 0) return;
      const fast = Math.abs(e.velocityX) > 600 && Math.sign(-e.velocityX) === dir;
      const complete = Math.abs(moved) > 0.35 || fast;
      if (complete) scheduleOnRN(haptic);
      animateTo(complete ? start.value + dir : start.value);
    },
  });

  // The stack of remaining pages: thins out as you move through the book
  const remaining = pages.length - 1 - index;
  const edge = Math.min(12, 2 + remaining * 0.8);

  return (
    // Width is measured on the outer view; the gesture layer wraps the inner one.
    // (On iPhone, a view inside the gesture layer may not report its size.)
    <View
      style={[styles.book, { marginRight: edge }]}
      onLayout={(e) => {
        width.value = e.nativeEvent.layout.width;
      }}
    >
      <PageEdges style={[styles.stack, { right: -edge, width: edge + 10 }]} />
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill}>
          {/*
            Only the current page and its neighbours are rendered, in REVERSE order: whatever is
            drawn later sits on top, so the previous page is always above the next (as in a real book).
            This ordering avoids zIndex, which doesn't change reliably during animation on iPhone.
          */}
          {pages
            .map((page, i) => ({ page, i }))
            .filter(({ i }) => i >= index - 1 && i <= index + 1)
            .reverse()
            .map(({ page, i }) => (
              <Leaf key={page.key} i={i} position={position} current={i === index} backVariant={page.backVariant}>
                {page.node}
              </Leaf>
            ))}
        </View>
      </GestureDetector>
    </View>
  );
});

export default Book;

/** A single leaf: the page on its front, the back of the paper showing while it turns */
function Leaf({ i, position, current, backVariant, children }) {
  const leafStyle = useAnimatedStyle(() => {
    const p = position.value;
    const f = Math.max(0, Math.min(1, p - i)); // how far this leaf is turned (0…1)
    const visible = f < 1 && i <= Math.floor(p) + 1;
    return {
      transform: [{ perspective: 2000 }, { rotateY: `${-180 * f}deg` }],
      opacity: visible ? 1 : 0,
    };
  });

  // The turning page darkens while the page beneath it slowly brightens
  const shadeStyle = useAnimatedStyle(() => {
    const p = position.value;
    const f = Math.max(0, Math.min(1, p - i));
    const frac = p - Math.floor(p);
    let shade = 0;
    if (f > 0 && f < 1) shade = f;
    else if (i === Math.floor(p) + 1 && frac > 0) shade = 1 - frac;
    return { opacity: shade * 0.9 };
  });

  // Past halfway, the back of the paper shows
  const backStyle = useAnimatedStyle(() => {
    const f = Math.max(0, Math.min(1, position.value - i));
    return { opacity: f > 0.5 ? 1 : 0 };
  });

  return (
    <Animated.View
      style={[styles.leaf, leafStyle]}
      pointerEvents={current ? 'auto' : 'none'}
      {...(Platform.OS === 'web'
        ? { 'aria-hidden': !current }
        : { accessibilityElementsHidden: !current, importantForAccessibility: current ? 'auto' : 'no-hide-descendants' })}
    >
      <View style={styles.face}>
        <PaperTexture />
        {children}
        {/* spine shadow */}
        <LinearGradient
          colors={['rgba(70,50,20,0.14)', 'rgba(70,50,20,0)']}
          locations={[0, 0.04]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Animated.View style={[StyleSheet.absoluteFill, shadeStyle]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(40,30,10,0.28)', 'rgba(40,30,10,0.08)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      <Animated.View style={[styles.face, styles.back, backVariant === 'endpaper' && styles.endpaper, backStyle]} pointerEvents="none">
        <PaperTexture />
        {backVariant === 'endpaper' && <Endpaper />}
        <LinearGradient
          colors={['rgba(70,50,20,0)', 'rgba(70,50,20,0.16)']}
          locations={[0.7, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

/** The back of the cover: the dotted endpaper you see when the book opens */
function Endpaper() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <Pattern id="endpaper" width={22} height={48} patternUnits="userSpaceOnUse">
          <Circle cx={6} cy={8} r={2} fill="rgba(46,74,51,0.1)" />
          <Circle cx={17} cy={32} r={2} fill="rgba(46,74,51,0.1)" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#endpaper)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  book: { flex: 1, minHeight: 0 },
  // The stack of remaining pages visible on the right edge
  stack: {
    top: 6,
    bottom: 6,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    shadowColor: '#46321a',
    shadowOpacity: 0.15,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 8 },
  },
  // Note: React Native 0.88 removed StyleSheet.absoluteFillObject; use absoluteFill instead.
  leaf: { ...StyleSheet.absoluteFill, transformOrigin: 'left center' },
  face: {
    ...StyleSheet.absoluteFill,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.paper,
  },
  back: { backgroundColor: colors.paper },
  endpaper: { backgroundColor: '#e9dfc6' },
});
