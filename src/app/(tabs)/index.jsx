/*
  HOME — greeting, level summary, shortcut to the book, trip prompt and recent finds.
*/
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Screen from '../../components/ui/Screen';
import PageHeader from '../../components/ui/PageHeader';
import Paper from '../../components/ui/Paper';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import Icon from '../../components/ui/Icon';
import Disclaimer from '../../components/ui/Disclaimer';
import BookCover from '../../components/book/BookCover';
import { Divider, MushroomSketch } from '../../components/ui/Ornaments';
import { Eyebrow, type } from '../../components/ui/Typography';
import { useStats, useRecentSightings, usePhotoUri } from '../../data/hooks';
import { levelFor, levelTitle } from '../../data/gamification';
import { formatDate, weatherLabel } from '../../data/fieldNotes';
import { displayName } from '../../services/safety';
import { t } from '../../i18n';
import { colors, fonts } from '../../theme';

/** One row in the recent finds list: thumbnail, species name, date */
function RecentItem({ sighting }) {
  const thumb = usePhotoUri(sighting.photoId, 'thumb');
  const isDraft = sighting.status === 'draft';
  const meta = [formatDate(sighting.foundAt, false), weatherLabel(sighting.notes?.weather), sighting.notes?.location?.placeName]
    .filter(Boolean)
    .join(' · ');
  const name = isDraft ? t('home.draftFind') : displayName(sighting.species);

  return (
    <Paper
      padded={false}
      style={styles.recentItem}
      onPress={() => router.navigate({ pathname: '/book', params: { page: isDraft ? 'drafts' : sighting.speciesId, t: Date.now() } })}
      accessibilityLabel={`${name}, ${meta}`}
    >
      <Image source={thumb ? { uri: thumb } : null} style={styles.recentThumb} contentFit="cover" transition={200} />
      <View style={{ flex: 1 }}>
        <Text style={styles.recentName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.recentMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Paper>
  );
}

/** Greeting based on the time of day */
function greeting() {
  const h = new Date().getHours();
  if (h < 11) return t('greeting.morning');
  if (h < 18) return t('greeting.day');
  return t('greeting.evening');
}

export default function HomeScreen() {
  const stats = useStats();
  const recent = useRecentSightings(5);
  const { current } = levelFor(stats.points);

  return (
    <Screen>
      <PageHeader eyebrow={greeting()} title={t('home.title')}>
        <Chip icon="leaf" label={`${levelTitle(current)} · ${t('common.points', { count: stats.points })}`} style={{ marginTop: 8 }} />
      </PageHeader>

      {/* Shortcut to the book */}
      <Paper style={styles.book} onPress={() => router.navigate('/book')} accessibilityLabel={t('home.openBook')}>
        <BookCover speciesCount={stats.speciesCount} small />
        <View style={styles.bookText}>
          <Text style={type.h3}>{t('home.bookTitle')}</Text>
          <Text style={type.muted}>
            {stats.speciesCount === 0 ? t('home.bookEmpty') : t('home.bookCount', { count: stats.speciesCount })}
          </Text>
          <Text style={type.link}>{t('home.bookLink')}</Text>
        </View>
      </Paper>

      {/* Start a trip */}
      <Paper style={styles.trip}>
        <View>
          <Eyebrow>{t('home.tripEyebrow')}</Eyebrow>
          <Text style={[type.h3, { marginTop: 2, marginBottom: 4 }]}>{t('home.tripTitle')}</Text>
          <Text style={type.muted}>{t('home.tripText')}</Text>
        </View>
        <Button variant="ghost" icon="trail" title={t('home.tripButton')} onPress={() => router.navigate('/trips')} />
      </Paper>

      <Divider />

      {/* Recent finds */}
      <View style={styles.recent}>
        <Text style={type.h2}>{t('home.recentTitle')}</Text>
        {recent.length === 0 ? (
          <Paper style={styles.empty}>
            <MushroomSketch size={64} color={colors.moss} />
            <Text style={[type.muted, type.center]}>{t('home.recentEmpty')}</Text>
          </Paper>
        ) : (
          recent.map((s) => <RecentItem key={s.id} sighting={s} />)
        )}
      </View>

      {stats.pendingCount > 0 && (
        <Paper style={styles.pending} onPress={() => router.push('/pending')}>
          <Icon name="clock" color={colors.earth} />
          <Text style={styles.pendingText}>{t('home.pending', { count: stats.pendingCount })}</Text>
        </Paper>
      )}

      <Disclaimer compact />
    </Screen>
  );
}

const styles = StyleSheet.create({
  book: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  bookText: { flex: 1, gap: 6 },
  trip: { gap: 14 },
  recent: { gap: 12 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 26 },
  recentItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingLeft: 10, paddingRight: 14 },
  recentThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: colors.paperEdge },
  recentName: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 23, color: colors.forest },
  recentMeta: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkFaint },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  pendingText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.earth, flex: 1 },
});
