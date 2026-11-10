/*
  TAB SCREENS
  Screens stay in memory while switching tabs (e.g. the book stays on the page you left).
*/
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import TabBar from '../../components/layout/TabBar';
import Backdrop from '../../components/layout/Backdrop';
import { t } from '../../i18n';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <Tabs
        tabBar={() => <TabBar />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' }, animation: 'fade' }}
      >
        <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="book" options={{ title: t('tabs.book') }} />
        <Tabs.Screen name="scan" options={{ title: t('tabs.scan') }} />
        <Tabs.Screen name="trips" options={{ title: t('tabs.trips') }} />
        <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
      </Tabs>
    </View>
  );
}
