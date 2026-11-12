/*
  TRIP SHEETS
  - StartTripSheet:  name the walk (optional), add where it starts (optional), start it
  - RenameTripSheet: change a trip's name
*/
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { type } from '../ui/Typography';
import { currentCoords } from '../../services/location';
import { renameTrip, startTrip } from '../../services/trips';
import { formatDate } from '../../data/fieldNotes';
import { t } from '../../i18n';
import { colors, fonts, radius } from '../../theme';

function NameField({ value, onChange, autoFocus }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t('trips.nameLabel')}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={t('trips.namePlaceholder')}
        placeholderTextColor={colors.inkFaint}
        maxLength={60}
        autoFocus={autoFocus}
        returnKeyType="done"
        accessibilityLabel={t('trips.nameLabel')}
      />
    </View>
  );
}

export function StartTripSheet({ onClose, onStarted }) {
  const [name, setName] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [coords, setCoords] = useState(null);
  const [geoState, setGeoState] = useState('idle'); // idle | loading | denied | error
  const [busy, setBusy] = useState(false);

  async function addLocation() {
    setGeoState('loading');
    try {
      setCoords(await currentCoords());
      setGeoState('idle');
    } catch (err) {
      setGeoState(err.code === 'denied' ? 'denied' : 'error');
    }
  }

  async function start() {
    setBusy(true);
    try {
      const place = placeName.trim();
      const location = place || coords ? { placeName: place, ...(coords ?? {}) } : null;
      const trip = await startTrip({ name, location });
      onStarted?.(trip);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={t('trips.newTrip')} onClose={onClose}>
      <View style={styles.body}>
        <Text style={type.muted}>{t('trips.newTripText')}</Text>
        <NameField value={name} onChange={setName} />
        <Text style={[type.small, { marginTop: -8 }]}>
          {t('trips.nameHint')} ({t('trips.untitled', { date: formatDate(Date.now(), false) })})
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>{t('notes.place')}</Text>
          <TextInput
            style={styles.input}
            value={placeName}
            onChangeText={setPlaceName}
            placeholder={t('notes.placePlaceholder')}
            placeholderTextColor={colors.inkFaint}
            maxLength={80}
            returnKeyType="done"
            accessibilityLabel={t('notes.place')}
          />
          <Pressable onPress={addLocation} disabled={geoState === 'loading'} style={styles.linkBtn} accessibilityRole="button">
            <Icon name="pin" size={16} color={colors.forest} />
            <Text style={styles.linkText}>
              {coords
                ? t('notes.locationAdded', { accuracy: coords.accuracy })
                : geoState === 'loading'
                  ? t('notes.locating')
                  : t('trips.addLocation')}
            </Text>
          </Pressable>
          {geoState === 'denied' && <Text style={styles.error}>{t('notes.locationDenied')}</Text>}
          {geoState === 'error' && <Text style={styles.error}>{t('notes.locationError')}</Text>}
        </View>

        <Button block icon="trail" title={busy ? t('common.saving') : t('trips.startButton')} onPress={start} disabled={busy} />
      </View>
    </Sheet>
  );
}

export function RenameTripSheet({ trip, onClose }) {
  const [name, setName] = useState(trip.name ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await renameTrip(trip.id, name);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={t('trips.renameTitle')} onClose={onClose}>
      <View style={styles.body}>
        <NameField value={name} onChange={setName} autoFocus />
        <Text style={[type.small, { marginTop: -8 }]}>{t('trips.nameHint')}</Text>
        <Button block title={busy ? t('common.saving') : t('common.save')} onPress={save} disabled={busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingBottom: 8 },
  field: { gap: 6 },
  label: { fontFamily: fonts.sansHeavy, fontSize: 13, letterSpacing: 0.5, color: colors.earth },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    borderRadius: radius.sm,
    backgroundColor: colors.paperWhite,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
  },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  linkText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.forest },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.earth },
});
