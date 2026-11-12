/*
  ROOT LAYOUT
  On launch: loads the fonts, prepares the database and starts watching pending photos.
  The splash screen is hidden once everything is ready.
*/
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Nunito_400Regular,
  Nunito_400Regular_Italic,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { getDb } from '../data/db';
import { checkBadges } from '../services/badges';
import { startPendingWatcher } from '../services/pendingQueue';
import { t } from '../i18n';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_600SemiBold_Italic,
    Nunito_400Regular,
    Nunito_400Regular_Italic,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const [dbState, setDbState] = useState('loading'); // loading | ready | error

  useEffect(() => {
    let stopWatcher;
    getDb()
      .then(async () => {
        setDbState('ready');
        // Journals from before badges existed get the ones they already deserve
        checkBadges().catch((err) => console.warn('[badges]', err));
        stopWatcher = await startPendingWatcher();
      })
      .catch((err) => {
        console.error('[database]', err);
        setDbState('error');
      });
    return () => stopWatcher?.();
  }, []);

  const ready = (fontsLoaded || fontError) && dbState !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  if (dbState === 'error') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.cream }}>
        <Text style={{ textAlign: 'center', color: colors.ink, fontSize: 16 }}>{t('app.openFailed')}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.cream }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="pending" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
