/*
  IDENTIFY FLOW — once we have a photo and a recognition result:
  1. Candidates  → the user picks a species, says "I'm not sure", or searches
                   for the species themselves ("none of these" → SpeciesSearch)
  2. Field notes → optional details
  3. Celebration → new page / repeat / draft

  A species the user found by search has no descriptions yet; its book page is
  written by the AI when saving (describeSpecies). If that fails, it is saved anyway.

  Used by both the Scan screen and the Pending screen.
*/
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Polaroid from '../ui/Polaroid';
import Appear, { POLAROID_IN } from '../ui/Appear';
import Paper from '../ui/Paper';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import CandidateList from './CandidateList';
import SpeciesSearch from './SpeciesSearch';
import FieldNotesForm from './FieldNotesForm';
import Celebration from './Celebration';
import { type } from '../ui/Typography';
import { usePhotoUri } from '../../data/hooks';
import { tables } from '../../data/db';
import { recordSighting } from '../../services/collection';
import { describeSpecies } from '../../services/recognizer';
import { displayName } from '../../services/safety';
import { t } from '../../i18n';
import { colors, fonts, radius } from '../../theme';

export default function IdentifyFlow({ photoId, result, onSaved, onCancel, onAgain, againLabel, onStepChange }) {
  const photoUri = usePhotoUri(photoId, 'full');
  const [userPick, setUserPick] = useState(null); // a species the user found by search
  const aiCandidates = result.isMushroom ? result.candidates : [];
  const candidates = userPick
    ? [userPick, ...aiCandidates.filter((c) => c.latinName !== userPick.latinName)]
    : aiCandidates;
  const hasCandidates = candidates.length > 0;

  const [step, setStepState] = useState('choose'); // choose | search | notes | done
  const [selected, setSelected] = useState(hasCandidates ? 0 : null);
  const [asDraft, setAsDraft] = useState(!hasCandidates);
  const [busy, setBusy] = useState(false); // false | 'saving' | 'writing'
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState(null);

  const setStep = (s) => {
    setStepState(s);
    onStepChange?.(s); // so the screen can scroll back to the top
  };

  async function save({ foundAt, notes }) {
    setError('');
    try {
      let candidate = asDraft ? null : candidates[selected];
      if (candidate?.source === 'user' && !candidate.capShape) {
        setBusy('writing');
        candidate = await describeSpecies(await tables.photos.get(photoId), candidate).catch((err) => {
          console.warn('[describe]', err.message);
          return candidate; // save without descriptions rather than not at all
        });
      }
      setBusy('saving');
      const res = await recordSighting({ photoId, candidate, candidates, notes, foundAt });
      await onSaved?.(res);
      setOutcome(res);
      setStep('done');
    } catch (err) {
      console.error(err);
      setError(t('identify.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (step === 'done') {
    return <Celebration outcome={outcome} onAgain={onAgain} againLabel={againLabel} />;
  }

  const chosen = !asDraft && selected !== null ? candidates[selected] : null;

  const pick = (item) => {
    setUserPick(item);
    setSelected(0);
    setAsDraft(false);
    setStep('choose');
  };

  return (
    <View style={styles.wrap}>
      <Appear from={POLAROID_IN} style={styles.photo}>
        <Polaroid
          uri={photoUri}
          caption={step === 'notes' ? (chosen ? displayName(chosen) : t('common.draft')) : undefined}
          width={step === 'notes' ? 170 : step === 'search' ? 130 : 240}
        />
      </Appear>

      {result.mock && (
        <View style={styles.mock}>
          <Icon name="info" size={16} color={colors.earth} style={{ marginTop: 2 }} />
          <Text style={styles.mockText}>{t('identify.mockNotice')}</Text>
        </View>
      )}

      {step === 'choose' && (
        <Animated.View entering={FadeIn.duration(250)} style={styles.wrap}>
          {hasCandidates ? (
            <>
              <View style={{ gap: 4 }}>
                <Text style={type.h2}>{t('identify.question')}</Text>
                <Text style={type.muted}>{t('identify.uncertain')}</Text>
              </View>
              <CandidateList
                candidates={candidates}
                selectedIndex={asDraft ? null : selected}
                userPhotoUri={photoUri}
                onSelect={(i) => {
                  setSelected(i);
                  setAsDraft(false);
                }}
              />
            </>
          ) : (
            <Paper style={styles.empty}>
              <Icon name="mushroom" size={40} color={colors.moss} />
              <Text style={[type.muted, type.center]}>{t('identify.noMushroom')}</Text>
              {!!result.photoTip && <Text style={[type.small, type.center]}>{result.photoTip}</Text>}
            </Paper>
          )}

          {hasCandidates && !!result.photoTip && <Text style={type.small}>💡 {result.photoTip}</Text>}

          <View style={styles.actions}>
            {hasCandidates && (
              <Button block title={t('identify.confirm')} disabled={asDraft || selected === null} onPress={() => setStep('notes')} />
            )}
            <Button block variant="ghost" icon="eye" title={t('identify.searchOwn')} onPress={() => setStep('search')} />
            <Button
              block
              variant="ghost"
              title={t('identify.saveAsDraft')}
              onPress={() => {
                setAsDraft(true);
                setStep('notes');
              }}
            />
            <Button variant="text" title={t('common.cancel')} onPress={onCancel} />
          </View>
        </Animated.View>
      )}

      {step === 'search' && (
        <Animated.View entering={FadeIn.duration(250)}>
          <SpeciesSearch onPick={pick} onBack={() => setStep('choose')} />
        </Animated.View>
      )}

      {step === 'notes' && (
        <Animated.View entering={FadeIn.duration(250)} style={{ gap: 10 }}>
          <FieldNotesForm
            onSubmit={save}
            onBack={() => setStep('choose')}
            busy={!!busy}
            busyLabel={busy === 'writing' ? t('identify.writingPage') : undefined}
            submitLabel={asDraft ? t('identify.submitDraft') : t('identify.submitSave')}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  photo: { alignSelf: 'center', marginTop: 8 },
  mock: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.mustardSoft,
  },
  mockText: { flex: 1, fontFamily: fonts.sansBold, fontSize: 13.5, lineHeight: 19, color: colors.earth },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 26 },
  actions: { gap: 10 },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.earth, textAlign: 'center' },
});
