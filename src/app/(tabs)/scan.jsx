/*
  SCAN — take / choose a photo → identify → pick → save.

  Steps (step):
    pick       Photo source buttons
    analyzing  The photo is being prepared and identified
    result     A recognition result arrived → IdentifyFlow takes over
    offline    No internet → the photo was added to pending
    error      Something went wrong → retry / add to pending / cancel
*/
import { useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeIn } from 'react-native-reanimated';
import Screen from '../../components/ui/Screen';
import PageHeader from '../../components/ui/PageHeader';
import Paper from '../../components/ui/Paper';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import Polaroid from '../../components/ui/Polaroid';
import Disclaimer from '../../components/ui/Disclaimer';
import IdentifyFlow from '../../components/scan/IdentifyFlow';
import Appear, { POLAROID_IN } from '../../components/ui/Appear';
import AnalyzingDots from '../../components/scan/AnalyzingDots';
import { type } from '../../components/ui/Typography';
import { useActiveTrip, usePhotoUri, useStats } from '../../data/hooks';
import { tripName } from '../../data/fieldNotes';
import { tables } from '../../data/db';
import { identify, OfflineError } from '../../services/recognizer';
import { savePhoto, deletePhoto } from '../../services/collection';
import { addPending } from '../../services/pendingQueue';
import { errorMessage, t } from '../../i18n';
import { colors, fonts } from '../../theme';

const PICKER_OPTIONS = { mediaTypes: ['images'], quality: 0.9, exif: false };

export default function ScanScreen() {
  const [state, setState] = useState({ step: 'pick' });
  const { pendingCount } = useStats();
  const activeTrip = useActiveTrip();
  const photoUri = usePhotoUri(state.photoId, 'full');
  const scrollRef = useRef(null);
  const toTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  async function runIdentify(photoId) {
    setState({ step: 'analyzing', photoId });
    try {
      const photo = await tables.photos.get(photoId);
      const result = await identify(photo);
      setState({ step: 'result', photoId, result });
    } catch (err) {
      if (err instanceof OfflineError) {
        await addPending(photoId, 'offline');
        setState({ step: 'offline', photoId });
      } else {
        setState({ step: 'error', photoId, code: err.code || 'generic' });
      }
    }
  }

  async function pick(source) {
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setState({ step: 'error', code: 'permission', message: source === 'camera' ? t('scan.cameraDenied') : t('scan.galleryDenied') });
        return;
      }

      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
          : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
      if (res.canceled || !res.assets?.length) return;

      setState({ step: 'analyzing' });
      const photoId = await savePhoto(res.assets[0]); // store on the device first, so it isn't lost if the connection drops
      await runIdentify(photoId);
    } catch (err) {
      console.warn('[scan]', err);
      setState({ step: 'error', code: err.code || 'photo-open' });
    }
  }

  /** Cancel without saving: delete the photo too */
  async function cancel() {
    await deletePhoto(state.photoId);
    setState({ step: 'pick' });
  }

  async function moveToPending() {
    await addPending(state.photoId, 'error');
    setState({ step: 'offline', photoId: state.photoId });
  }

  const restart = () => {
    setState({ step: 'pick' });
    toTop();
  };

  return (
    <Screen ref={scrollRef} keyboard>
      <PageHeader eyebrow={t('scan.eyebrow')} title={t('scan.title')} subtitle={state.step === 'pick' ? t('scan.subtitle') : undefined} />

      {state.step === 'pick' && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.stack}>
          <Paper dashed style={styles.frame}>
            <Icon name="mushroom" size={54} strokeWidth={1.2} color={colors.moss} />
            <Text style={[type.muted, type.center]}>{t('scan.frameHint')}</Text>
          </Paper>

          {!!activeTrip && (
            <Paper style={styles.tripBanner} onPress={() => router.navigate('/trips')}>
              <Icon name="trail" size={20} color={colors.moss} />
              <Text style={[type.small, { flex: 1, color: colors.forest }]}>{t('trips.scanBanner', { name: tripName(activeTrip) })}</Text>
            </Paper>
          )}

          <View style={styles.actions}>
            <Button block icon="camera" title={t('scan.takePhoto')} onPress={() => pick('camera')} />
            <Button block variant="ghost" icon="gallery" title={t('scan.fromGallery')} onPress={() => pick('library')} />
          </View>

          {pendingCount > 0 && (
            <Paper style={styles.pendingLink} onPress={() => router.push('/pending')}>
              <Icon name="clock" color={colors.earth} />
              <Text style={[type.body, { flex: 1 }]}>
                <Text style={{ fontFamily: fonts.sansHeavy }}>{t('scan.pendingCount', { count: pendingCount })}</Text>
                {t('scan.pendingSuffix')}
              </Text>
              <Text style={type.body}>→</Text>
            </Paper>
          )}

          <Disclaimer />
        </Animated.View>
      )}

      {state.step === 'analyzing' && (
        <View style={styles.analyzing}>
          <Appear from={POLAROID_IN}>
            <Polaroid uri={photoUri} width={240} />
          </Appear>
          <Text style={styles.analyzingText}>{t('scan.analyzing')}</Text>
          <AnalyzingDots />
        </View>
      )}

      {state.step === 'result' && (
        <IdentifyFlow photoId={state.photoId} result={state.result} onCancel={cancel} onAgain={restart} onStepChange={toTop} />
      )}

      {state.step === 'offline' && (
        <Paper style={styles.message}>
          <Polaroid uri={photoUri} width={150} tilt={2} />
          <Text style={[type.h3, type.center, { marginTop: 8 }]}>{t('scan.offlineTitle')}</Text>
          <Text style={[type.muted, type.center]}>{t('scan.offlineText')}</Text>
          <View style={[styles.actions, styles.wide]}>
            <Button block icon="camera" title={t('scan.newScan')} onPress={restart} />
            <Button block variant="ghost" icon="clock" title={t('scan.pendingButton')} onPress={() => router.push('/pending')} />
          </View>
        </Paper>
      )}

      {state.step === 'error' && (
        <Paper style={styles.message}>
          <Icon name="info" size={36} color={colors.earth} />
          <Text style={[type.h3, type.center]}>{state.code === 'permission' ? t('scan.permissionTitle') : t('scan.errorTitle')}</Text>
          <Text style={[type.muted, type.center]}>{state.message ?? errorMessage(state.code)}</Text>
          {state.code === 'no-key' && <Text style={[type.small, type.center]}>{t('scan.noKeyHint')}</Text>}
          <View style={[styles.actions, styles.wide]}>
            {state.code === 'permission' && (
              <Button block title={t('scan.openSettings')} onPress={() => Linking.openSettings().catch(() => {})} />
            )}
            {!!state.photoId && <Button block title={t('common.retry')} onPress={() => runIdentify(state.photoId)} />}
            {!!state.photoId && <Button block variant="ghost" title={t('scan.addToPending')} onPress={moveToPending} />}
            <Button variant="text" title={state.photoId ? t('common.cancel') : t('scan.goBack')} onPress={state.photoId ? cancel : restart} />
          </View>
        </Paper>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tripBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderColor: colors.moss, borderWidth: 1.5 },
  stack: { gap: 18 },
  frame: { aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  actions: { gap: 10 },
  wide: { alignSelf: 'stretch', marginTop: 6 },
  pendingLink: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  analyzing: { alignItems: 'center', gap: 16, marginTop: 8 },
  analyzingText: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.forest, textAlign: 'center' },
  message: { alignItems: 'center', gap: 10, paddingVertical: 26 },
});
