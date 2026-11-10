/*
  TRIPS — start/end a trip and a summary of past trips.
  The recording logic arrives in stage 5; for now the layout is ready.
*/
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/ui/Screen';
import PageHeader from '../../components/ui/PageHeader';
import Paper from '../../components/ui/Paper';
import Button from '../../components/ui/Button';
import { FernSprig } from '../../components/ui/Ornaments';
import { type } from '../../components/ui/Typography';
import { t } from '../../i18n';
import { colors } from '../../theme';

export default function TripsScreen() {
  return (
    <Screen>
      <PageHeader eyebrow={t('trips.eyebrow')} title={t('trips.title')} subtitle={t('trips.subtitle')} />

      <Paper style={styles.start}>
        <Text style={type.h3}>{t('trips.newTrip')}</Text>
        <Text style={type.muted}>{t('trips.newTripText')}</Text>
        <Button block icon="trail" title={t('trips.start')} disabled />
        <Text style={[type.small, type.center, { color: colors.inkFaint }]}>{t('trips.comingSoon')}</Text>
      </Paper>

      <View style={styles.list}>
        <Text style={type.h2}>{t('trips.past')}</Text>
        <Paper style={styles.empty}>
          <FernSprig size={70} color={colors.moss} />
          <Text style={[type.muted, type.center]}>{t('trips.empty')}</Text>
        </Paper>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  start: { gap: 10 },
  list: { gap: 12 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 26 },
});
