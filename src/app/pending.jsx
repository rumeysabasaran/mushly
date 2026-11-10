/*
  PENDING — photos taken without internet.
  Tapping a ready item opens its recognition result so it can be saved to the journal.
*/
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Backdrop from '../components/layout/Backdrop';
import Screen from '../components/ui/Screen';
import PageHeader from '../components/ui/PageHeader';
import Paper from '../components/ui/Paper';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import IdentifyFlow from '../components/scan/IdentifyFlow';
import { type } from '../components/ui/Typography';
import { confirmAsync } from '../components/ui/confirm';
import { usePendingList, usePhotoUri } from '../data/hooks';
import { formatDate } from '../data/fieldNotes';
import { processPending, retryPending, removePending } from '../services/pendingQueue';
import { errorMessage, t } from '../i18n';
import { colors, fonts } from '../theme';

/** The error text of a failed item (older items stored a ready-made Turkish message) */
function itemError(item) {
  if (item.errorCode) return errorMessage(item.errorCode);
  return item.errorMessage || '';
}

function PendingItem({ item, onOpen }) {
  const thumb = usePhotoUri(item.photoId, 'thumb');
  const error = item.status === 'error' ? itemError(item) : '';

  async function handleDelete() {
    if (await confirmAsync(t('pending.deleteTitle'), t('pending.deleteText'))) await removePending(item.id);
  }

  return (
    <Paper padded={false} style={styles.item}>
      <Image source={thumb ? { uri: thumb } : null} style={styles.thumb} contentFit="cover" />
      <View style={styles.itemBody}>
        <Text style={[styles.status, item.status === 'error' && { color: colors.earth }]}>{t(`pending.status.${item.status}`)}</Text>
        {!!error && <Text style={type.small}>{error}</Text>}
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </View>
      <View style={styles.itemActions}>
        {item.status === 'ready' && <Button small title={t('pending.open')} onPress={() => onOpen(item)} />}
        {item.status === 'error' && <Button small variant="ghost" title={t('pending.retry')} onPress={() => retryPending(item.id)} />}
        <Button small variant="text" title={t('common.delete')} onPress={handleDelete} />
      </View>
    </Paper>
  );
}

export default function PendingScreen() {
  const items = usePendingList();
  const [open, setOpen] = useState(null); // the pending item currently open

  const back = (
    <Pressable onPress={() => (open ? setOpen(null) : router.back())} style={styles.back} accessibilityRole="button" hitSlop={8}>
      <Icon name="chevronLeft" size={20} color={colors.forest} />
      <Text style={type.link}>{open ? t('pending.title') : t('common.back')}</Text>
    </Pressable>
  );

  if (open) {
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        <Screen withNav={false} keyboard>
          {back}
          <PageHeader eyebrow={t('pending.title')} title={t('pending.resultTitle')} />
          <IdentifyFlow
            photoId={open.photoId}
            result={open.result}
            // Once saved, remove it from pending but keep the photo (it's in the journal now)
            onSaved={() => removePending(open.id, { keepPhoto: true })}
            onCancel={() => setOpen(null)}
            onAgain={() => setOpen(null)}
            againLabel={t('pending.backToList')}
          />
        </Screen>
      </View>
    );
  }

  const waitingCount = items.filter((i) => i.status === 'waiting').length;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <Screen withNav={false}>
        {back}
        <PageHeader eyebrow={t('pending.eyebrow')} title={t('pending.title')} subtitle={t('pending.subtitle')} />

        {items.length === 0 ? (
          <Paper style={styles.empty}>
            <Icon name="clock" size={40} color={colors.moss} />
            <Text style={[type.muted, type.center]}>{t('pending.empty')}</Text>
          </Paper>
        ) : (
          <>
            <View style={{ gap: 10 }}>
              {items.map((item) => (
                <PendingItem key={item.id} item={item} onOpen={setOpen} />
              ))}
            </View>
            {waitingCount > 0 && <Button block variant="ghost" title={t('pending.tryNow')} onPress={() => processPending()} />}
          </>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: 4, marginBottom: -6 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 26 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingLeft: 10, paddingRight: 8 },
  thumb: { width: 64, height: 64, borderRadius: 6, backgroundColor: colors.paperEdge },
  itemBody: { flex: 1, gap: 2 },
  status: { fontFamily: fonts.sansHeavy, fontSize: 14.5, color: colors.forest },
  date: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkFaint },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
