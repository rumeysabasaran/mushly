/*
  TRIP MEMORY — one walk, kept like a page in a field diary.
  Numbers (duration, finds, species, points), where and when it started, the weather,
  species found for the first time, and every find as a small polaroid (tap → its book page).

  Route: /trip/<id>             a past trip
         /trip/<id>?ended=1     right after ending it: a "trip complete" note, and any
                                badges it unlocked (&badges=a,b) open full screen
*/
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Backdrop from '../../components/layout/Backdrop';
import Screen from '../../components/ui/Screen';
import PageHeader from '../../components/ui/PageHeader';
import Paper from '../../components/ui/Paper';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import Icon from '../../components/ui/Icon';
import Polaroid from '../../components/ui/Polaroid';
import { Divider } from '../../components/ui/Ornaments';
import { type } from '../../components/ui/Typography';
import { confirmAsync } from '../../components/ui/confirm';
import RewardOverlay from '../../components/scan/RewardOverlay';
import { RenameTripSheet } from '../../components/trips/TripSheets';
import { usePhotoUri, useTrip } from '../../data/hooks';
import { formatDate, formatDuration, formatTime, tripName, weatherLabel } from '../../data/fieldNotes';
import { badgeByKey } from '../../data/gamification';
import { commonNameOf, displayName } from '../../services/safety';
import { deleteTrip } from '../../services/trips';
import { t } from '../../i18n';
import { colors, fonts } from '../../theme';

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FindPolaroid({ find, index }) {
  const uri = usePhotoUri(find.photoId, 'thumb');
  const name = find.species ? displayName(find.species) : t('common.draft');
  const open = () =>
    router.navigate({ pathname: '/book', params: { page: find.species ? find.species.id : 'drafts', t: Date.now() } });
  return (
    <Pressable onPress={open} style={styles.find} accessibilityRole="button" accessibilityLabel={name}>
      <Polaroid uri={uri} width={140} tilt={index % 2 ? 2 : -2} tape={false} caption={formatTime(find.foundAt)} />
      <Text style={styles.findName} numberOfLines={2}>
        {name}
      </Text>
      {!!find.species && !!commonNameOf(find.species) && (
        <Text style={styles.findLatin} numberOfLines={1}>
          {find.species.latinName}
        </Text>
      )}
    </Pressable>
  );
}

export default function TripScreen() {
  const { id, ended, badges } = useLocalSearchParams();
  const trip = useTrip(id);
  const [renaming, setRenaming] = useState(false);
  const [rewards, setRewards] = useState(() =>
    String(badges ?? '')
      .split(',')
      .filter((key) => badgeByKey(key))
      .map((key) => ({ kind: 'badge', key }))
  );

  const back = (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate('/trips'))} style={styles.back} accessibilityRole="button" hitSlop={8}>
      <Icon name="chevronLeft" size={20} color={colors.forest} />
      <Text style={type.link}>{t('trips.back')}</Text>
    </Pressable>
  );

  if (trip === undefined) return <Backdrop />;

  if (trip === null) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <Screen withNav={false}>
          {back}
          <Paper style={styles.empty}>
            <Text style={[type.muted, type.center]}>{t('trips.notFound')}</Text>
          </Paper>
        </Screen>
      </View>
    );
  }

  const { summary, finds } = trip;
  const newSpecies = finds
    .filter((f) => f.species && summary.newSpeciesIds.includes(f.species.id))
    .filter((f, i, all) => all.findIndex((x) => x.species.id === f.species.id) === i);
  const weathers = [...new Set(finds.map((f) => f.notes?.weather).filter(Boolean))].map(weatherLabel).filter(Boolean);
  const timeRange = trip.endedAt ? `${formatTime(trip.startedAt)} – ${formatTime(trip.endedAt)}` : formatTime(trip.startedAt);

  async function remove() {
    if (!(await confirmAsync(t('trips.deleteTitle'), t('trips.deleteText')))) return;
    await deleteTrip(trip.id);
    router.canGoBack() ? router.back() : router.navigate('/trips');
  }

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <Screen withNav={false}>
        {back}
        <PageHeader eyebrow={`${t('trips.memoryEyebrow')} · ${formatDate(trip.startedAt)}`} title={tripName(trip)} />

        {ended === '1' && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <Paper style={styles.endedNote}>
              <Icon name="sparkle" size={20} color={colors.mustard} />
              <Text style={[type.body, { flex: 1 }]}>{t('trips.endedNote')}</Text>
            </Paper>
          </Animated.View>
        )}

        <Paper style={styles.stats}>
          <Stat value={formatDuration(summary.duration)} label={t('trips.duration')} />
          <Stat value={summary.findCount} label={t('trips.findsLabel')} />
          <Stat value={summary.speciesCount} label={t('trips.speciesLabel')} />
          <Stat value={summary.points} label={t('trips.pointsLabel')} />
        </Paper>

        <View style={styles.facts}>
          <View style={styles.fact}>
            <Icon name="clock" size={17} color={colors.moss} />
            <Text style={type.small}>{timeRange}</Text>
          </View>
          {!!(trip.location?.placeName || trip.location?.lat != null) && (
            <View style={styles.fact}>
              <Icon name="pin" size={17} color={colors.moss} />
              <Text style={type.small}>
                {t('trips.startPlace')}: {trip.location.placeName || t('book.locationSaved')}
              </Text>
            </View>
          )}
          {weathers.length > 0 && (
            <View style={styles.fact}>
              <Icon name="sun" size={17} color={colors.moss} />
              <Text style={type.small}>
                {t('trips.weather')}: {weathers.join(', ')}
              </Text>
            </View>
          )}
        </View>

        {newSpecies.length > 0 && (
          <View style={styles.section}>
            <Text style={type.h3}>{t('trips.newSpecies')}</Text>
            <View style={styles.chips}>
              {newSpecies.map((f) => (
                <Chip key={f.species.id} icon="sparkle" label={displayName(f.species)} />
              ))}
            </View>
          </View>
        )}

        <Divider />

        <View style={styles.section}>
          <Text style={type.h2}>{t('trips.findsTitle')}</Text>
          {finds.length === 0 ? (
            <Text style={type.muted}>{t('trips.noFinds')}</Text>
          ) : (
            <View style={styles.grid}>
              {finds.map((f, i) => (
                <FindPolaroid key={f.id} find={f} index={i} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button block variant="ghost" title={t('trips.rename')} onPress={() => setRenaming(true)} />
          <Button variant="text" color={colors.earth} title={t('trips.delete')} onPress={remove} />
        </View>
      </Screen>

      {renaming && <RenameTripSheet trip={trip} onClose={() => setRenaming(false)} />}
      {rewards.length > 0 && <RewardOverlay rewards={rewards} onClose={() => setRewards([])} />}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: 4, marginBottom: -6 },
  empty: { alignItems: 'center', paddingVertical: 26 },
  endedNote: { flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: colors.mustard, borderWidth: 1.5 },
  stats: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statValue: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 27, color: colors.forest, textAlign: 'center' },
  statLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  facts: { gap: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 },
  find: { width: '48%', alignItems: 'center', gap: 4 },
  findName: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 21, color: colors.forest, textAlign: 'center', marginTop: 4 },
  findLatin: { fontFamily: fonts.serifItalic, fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  actions: { gap: 6, marginTop: 8 },
});
