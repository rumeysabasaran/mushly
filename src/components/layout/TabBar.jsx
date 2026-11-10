/*
  TAB BAR — 4 tabs within thumb's reach and a camera button in the middle.
  The camera button is visible on every screen and opens the Scan screen.
  If photos are pending, their count shows on the corner of the camera button.
  The bar hides while the keyboard is open (so it doesn't cover the text field).
*/
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../ui/Icon';
import { PaperTexture } from '../ui/Paper';
import { useStats } from '../../data/hooks';
import { t } from '../../i18n';
import { colors, fonts, layout, shadows } from '../../theme';

const TABS_LEFT = [
  { href: '/', label: 'tabs.home', icon: 'home' },
  { href: '/book', label: 'tabs.book', icon: 'book' },
];
const TABS_RIGHT = [
  { href: '/trips', label: 'tabs.trips', icon: 'trail' },
  { href: '/profile', label: 'tabs.profile', icon: 'user' },
];

function isActive(pathname, href) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function Tab({ href, label: labelKey, icon, active }) {
  const label = t(labelKey);
  const color = active ? colors.forest : colors.inkFaint;
  return (
    <Pressable
      onPress={() => router.navigate(href)}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Icon name={icon} size={23} color={color} strokeWidth={active ? 2 : 1.6} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

export default function TabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { pendingCount } = useStats();
  const keyboardVisible = useKeyboardVisible();
  const scanActive = isActive(pathname, '/scan');

  if (keyboardVisible) return null;

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: layout.navHeight + insets.bottom }]} accessibilityRole="tablist">
      <PaperTexture />
      <View style={styles.inner}>
        {TABS_LEFT.map((t) => (
          <Tab key={t.href} {...t} active={isActive(pathname, t.href)} />
        ))}

        <View style={styles.fabSlot}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.navigate('/scan');
            }}
            style={({ pressed }) => [styles.fab, (pressed || scanActive) && styles.fabPressed, pressed && styles.fabScale]}
            accessibilityRole="button"
            accessibilityLabel={t('tabs.scan')}
          >
            <Icon name="camera" size={28} strokeWidth={1.7} color={colors.cream} />
            {pendingCount > 0 && (
              <View style={styles.badge} accessibilityLabel={t('tabs.pendingBadge', { count: pendingCount })}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {TABS_RIGHT.map((t) => (
          <Tab key={t.href} {...t} active={isActive(pathname, t.href)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.paperEdge,
    ...Platform.select({
      web: { boxShadow: '0 -4px 16px rgba(70,50,20,0.06)' },
      default: { shadowColor: '#46321a', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
    }),
  },
  inner: {
    height: layout.navHeight,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
  tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontFamily: fonts.sansBold, fontSize: 11 },
  fabSlot: { width: 84, alignItems: 'center' },
  fab: {
    width: 68,
    height: 68,
    marginTop: -30,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forest,
    borderWidth: 4,
    borderColor: colors.cream,
    ...shadows.lift,
  },
  fabPressed: { backgroundColor: colors.forestDeep },
  fabScale: { transform: [{ scale: 0.94 }] },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.mustard,
    borderWidth: 2,
    borderColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.sansHeavy, fontSize: 11.5, color: colors.forestDeep },
});
