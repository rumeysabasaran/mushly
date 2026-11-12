/*
  TRIPS — start and end a walk; past walks become memories.
  - No trip running: a card to start one (StartTripSheet asks for an optional name/place)
  - Trip running:    a live card with its clock and finds, "Scan" and "End the trip"
  - Ending a trip opens its memory page (/trip/<id>?ended=1)
*/
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Screen from '../../components/ui/Screen';
import PageHeader from '../../components/ui/PageHeader';
import Paper from '../../components/ui/Paper';
import Button from '../../components/ui/Button';
import { FernSprig } from '../../components/ui/Ornaments';
import { type } from '../../components/ui/Typography';
import { confirmAsync } from '../../components/ui/confirm';
import { ActiveTripCard, TripCard } from '../../components/trips/TripCards';
import { StartTripSheet } from '../../components/trips/TripSheets';
import { useActiveTrip, useTrips } from '../../data/hooks';
import { endTrip } from '../../services/trips';
import { t } from '../../i18n';
import { colors } from '../../theme';

export default function TripsScreen() {
  const active = useActiveTrip();
  const trips = useTrips();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  async function finish() {
    if (!(await confirmAsync(t('trips.endTitle'), t('trips.endText'), t('trips.endOk')))) return;
    setError('');
    try {
      const { trip, newBadges } = await endTrip(active.id);
      router.push({ pathname: '/trip/[id]', params: { id: trip.id, ended: '1', badges: newBadges.join(',') } });
    } catch (err) {
      console.error(err);
      setError(t('trips.endFailed'));
    }
  }

  return (
    <Screen>
      <PageHeader eyebrow={t('trips.eyebrow')} title={t('trips.title')} subtitle={t('trips.subtitle')} />

      {active === undefined ? null : active ? (
        <ActiveTripCard trip={active} onEnd={finish} />
      ) : (
        <Paper style={styles.start}>
          <Text style={type.h3}>{t('trips.newTrip')}</Text>
          <Text style={type.muted}>{t('trips.newTripText')}</Text>
          <Button block icon="trail" title={t('trips.start')} onPress={() => setStarting(true)} />
        </Paper>
      )}
      {!!error && <Text style={[type.small, { color: colors.earth }]}>{error}</Text>}

      <View style={styles.list}>
        <Text style={type.h2}>{t('trips.past')}</Text>
        {trips.length === 0 ? (
          <Paper style={styles.empty}>
            <FernSprig size={70} color={colors.moss} />
            <Text style={[type.muted, type.center]}>{t('trips.empty')}</Text>
          </Paper>
        ) : (
          trips.map((trip) => <TripCard key={trip.id} trip={trip} />)
        )}
      </View>

      {starting && <StartTripSheet onClose={() => setStarting(false)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  start: { gap: 10 },
  list: { gap: 12 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 26 },
});
