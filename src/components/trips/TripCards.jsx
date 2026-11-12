/*
  TRIP CARDS
  - ActiveTripCard: the walk in progress, with a live clock and its finds so far.
      compact (home screen): one line and a button to the trips screen
      full (trips screen):   thumbnails, "Scan a mushroom" and "End the trip"
  - TripCard: a finished trip in the list; opens its memory page
*/
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Paper from '../ui/Paper';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { Eyebrow, type } from '../ui/Typography';
import { usePhotoUri, useTicker } from '../../data/hooks';
import { formatDate, formatDuration, formatTime, tripName } from '../../data/fieldNotes';
import { t } from '../../i18n';
import { colors, fonts } from '../../theme';

export function FindThumb({ photoId, size = 52 }) {
  const uri = usePhotoUri(photoId, 'thumb');
  return (
    <View style={[styles.thumb, { width: size, height: size }]}>
      {!!uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
    </View>
  );
}

/** "3 finds · 2 species" */
function countsLine(summary) {
  return [t('trips.finds', { count: summary.findCount }), t('common.speciesCount', { count: summary.speciesCount })].join(' · ');
}

/** A pulsing-looking green dot that marks "live" */
function LiveDot() {
  return (
    <View style={styles.liveRing}>
      <View style={styles.liveDot} />
    </View>
  );
}

export function ActiveTripCard({ trip, compact = false, onEnd }) {
  const now = useTicker(30_000);
  const elapsed = formatDuration(now - trip.startedAt);
  const recent = [...trip.finds].reverse().slice(0, 6);

  if (compact) {
    return (
      <Paper style={styles.activeCompact} onPress={() => router.navigate('/trips')} accessibilityLabel={`${t('trips.activeEyebrow')}: ${tripName(trip)}`}>
        <View style={styles.row}>
          <LiveDot />
          <Eyebrow>{t('trips.activeEyebrow')}</Eyebrow>
        </View>
        <Text style={type.h3}>{tripName(trip)}</Text>
        <Text style={type.muted}>
          {elapsed} · {countsLine(trip.summary)}
        </Text>
        <Text style={type.link}>{t('trips.homeGo')} →</Text>
      </Paper>
    );
  }

  return (
    <Paper style={styles.active}>
      <View style={styles.row}>
        <LiveDot />
        <Eyebrow>{t('trips.activeEyebrow')}</Eyebrow>
      </View>
      <Text style={type.h2}>{tripName(trip)}</Text>
      <Text style={type.small}>
        {t('trips.startedAt', { time: formatTime(trip.startedAt) })}
        {trip.location?.placeName ? ` · ${trip.location.placeName}` : ''}
      </Text>

      <View style={styles.clockRow}>
        <View style={styles.clockBox}>
          <Text style={styles.clockValue}>{elapsed}</Text>
          <Text style={styles.clockLabel}>{t('trips.duration')}</Text>
        </View>
        <View style={styles.clockBox}>
          <Text style={styles.clockValue}>{trip.summary.findCount}</Text>
          <Text style={styles.clockLabel}>{t('trips.findsLabel')}</Text>
        </View>
        <View style={styles.clockBox}>
          <Text style={styles.clockValue}>{trip.summary.speciesCount}</Text>
          <Text style={styles.clockLabel}>{t('trips.speciesLabel')}</Text>
        </View>
      </View>

      {recent.length > 0 && (
        <View style={styles.thumbs}>
          {recent.map((s) => (
            <FindThumb key={s.id} photoId={s.photoId} />
          ))}
        </View>
      )}

      <View style={{ gap: 10 }}>
        <Button block icon="camera" title={t('trips.scanHere')} onPress={() => router.navigate('/scan')} />
        <Button block variant="ghost" icon="check" title={t('trips.end')} onPress={onEnd} />
      </View>
    </Paper>
  );
}

export function TripCard({ trip }) {
  const photos = trip.finds.slice(0, 4);
  return (
    <Paper
      style={styles.card}
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
      accessibilityLabel={`${tripName(trip)}, ${formatDate(trip.startedAt)}`}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.cardDate}>{formatDate(trip.startedAt)}</Text>
        <Text style={styles.cardName} numberOfLines={2}>
          {tripName(trip)}
        </Text>
        <Text style={type.small}>
          {formatDuration(trip.summary.duration)} · {countsLine(trip.summary)}
        </Text>
        {trip.summary.points > 0 && <Text style={styles.cardPoints}>{t('common.pointsEarned', { count: trip.summary.points })}</Text>}
      </View>
      {photos.length > 0 ? (
        <View style={styles.stack}>
          {photos.slice(0, 3).map((s, i) => (
            <View key={s.id} style={[styles.stackItem, { transform: [{ rotate: `${(i - 1) * 6}deg` }], zIndex: 3 - i, right: i * 10 }]}>
              <FindThumb photoId={s.photoId} size={54} />
            </View>
          ))}
        </View>
      ) : (
        <Icon name="trail" size={30} color={colors.moss} />
      )}
    </Paper>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(107, 132, 89, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.moss },
  activeCompact: { gap: 6, borderColor: colors.moss, borderWidth: 1.5 },
  active: { gap: 12, borderColor: colors.moss, borderWidth: 1.5 },
  clockRow: { flexDirection: 'row', gap: 8 },
  clockBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.paperWhite,
    borderWidth: 1,
    borderColor: colors.paperEdge,
  },
  clockValue: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 26, color: colors.forest, textAlign: 'center' },
  clockLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkSoft },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumb: { borderRadius: 6, overflow: 'hidden', backgroundColor: colors.paperEdge, borderWidth: 2, borderColor: colors.paperWhite },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardDate: { fontFamily: fonts.sansHeavy, fontSize: 11.5, letterSpacing: 1, color: colors.earth },
  cardName: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 25, color: colors.forest },
  cardPoints: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.moss },
  stack: { width: 80, height: 62 },
  stackItem: { position: 'absolute', top: 2 },
});
