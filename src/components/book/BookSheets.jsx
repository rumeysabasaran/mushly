/*
  BOOK SHEETS
  - PhotoSheet:   enlarges a photo and can make it the page's cover photo
  - EditSheet:    edits a find's field notes, or deletes the find
  - DraftSheet:   picks a draft's species later (with points and a celebration)
*/
import { useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Sheet from '../ui/Sheet';
import Polaroid from '../ui/Polaroid';
import Button from '../ui/Button';
import FieldNotesForm from '../scan/FieldNotesForm';
import CandidateList from '../scan/CandidateList';
import Celebration from '../scan/Celebration';
import { confirmAsync } from '../ui/confirm';
import { type } from '../ui/Typography';
import { usePhotoUri } from '../../data/hooks';
import { deleteSighting, resolveDraft, setCoverPhoto, updateSighting } from '../../services/collection';
import { t } from '../../i18n';
import { colors } from '../../theme';

const { height: SCREEN_H } = Dimensions.get('window');

// ---------------------------------------------------------------- PHOTO

export function PhotoSheet({ photoId, species, onClose }) {
  const uri = usePhotoUri(photoId, 'full');
  const isCover = species?.coverPhotoId === photoId;
  const [ratio, setRatio] = useState(1); // width / height: the frame follows the photo's shape

  return (
    <Sheet title={t('sheets.photo')} onClose={onClose} variant="photo">
      {({ close }) => (
        <>
          <View style={[styles.photoFrame, { aspectRatio: ratio, maxHeight: SCREEN_H * 0.7 }]}>
            {!!uri && (
              <Image
                source={{ uri }}
                style={styles.photo}
                contentFit="contain"
                transition={200}
                onLoad={(e) => e.source?.width && setRatio(e.source.width / e.source.height)}
              />
            )}
          </View>
          {species && !isCover && (
            <Button
              variant="ghost"
              icon="book"
              title={t('sheets.makeCover')}
              style={styles.photoBtn}
              onPress={async () => {
                await setCoverPhoto(species.id, photoId);
                close();
              }}
            />
          )}
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- EDIT NOTES

export function EditSheet({ sighting, onClose }) {
  const [busy, setBusy] = useState(false);

  return (
    <Sheet title={t('sheets.editTitle')} onClose={onClose}>
      {({ close }) => (
        <>
          <FieldNotesForm
            bare
            initial={sighting}
            submitLabel={t('common.save')}
            busy={busy}
            onSubmit={async ({ foundAt, notes }) => {
              setBusy(true);
              await updateSighting(sighting.id, { foundAt, notes });
              close();
            }}
          />
          <Button
            variant="text"
            color={colors.earth}
            title={t('sheets.deleteSighting')}
            disabled={busy}
            onPress={async () => {
              const ok = await confirmAsync(t('sheets.deleteSightingTitle'), t('sheets.deleteSightingText'));
              if (!ok) return;
              setBusy(true);
              await deleteSighting(sighting.id);
              close();
            }}
          />
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------- DRAFT

export function DraftSheet({ sighting, onClose }) {
  const uri = usePhotoUri(sighting.photoId, 'full');
  const candidates = sighting.candidates ?? [];
  const [selected, setSelected] = useState(candidates.length ? 0 : null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);

  async function confirm() {
    setBusy(true);
    try {
      setOutcome(await resolveDraft(sighting.id, candidates[selected]));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={outcome ? '' : t('sheets.draftTitle')} onClose={onClose}>
      {({ close }) =>
        outcome ? (
          <Celebration outcome={outcome} onAgain={close} againLabel={t('sheets.backToBook')} againIcon="book" hideBookLink />
        ) : (
          <>
            <Polaroid uri={uri} width={180} tilt={-1.5} style={{ alignSelf: 'center', marginTop: 8 }} />
            {candidates.length > 0 ? (
              <>
                <Text style={type.muted}>{t('sheets.draftQuestion')}</Text>
                <CandidateList candidates={candidates} selectedIndex={selected} onSelect={setSelected} />
                <Button block title={t('sheets.draftConfirm')} onPress={confirm} disabled={busy || selected === null} />
              </>
            ) : (
              <Text style={type.muted}>{t('sheets.draftNoCandidates')}</Text>
            )}
            <Button
              variant="text"
              color={colors.earth}
              title={t('sheets.deleteDraft')}
              disabled={busy}
              onPress={async () => {
                if (!(await confirmAsync(t('sheets.deleteDraftTitle'), t('sheets.deleteDraftText')))) return;
                await deleteSighting(sighting.id);
                close();
              }}
            />
          </>
        )
      }
    </Sheet>
  );
}

const styles = StyleSheet.create({
  photoFrame: {
    width: '100%',
    borderWidth: 8,
    borderColor: colors.paperWhite,
    backgroundColor: colors.paperWhite,
  },
  photo: { flex: 1 },
  photoBtn: { backgroundColor: colors.cream, alignSelf: 'center', marginTop: 8 },
});
