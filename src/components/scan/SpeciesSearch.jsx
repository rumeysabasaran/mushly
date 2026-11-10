/*
  SPECIES SEARCH — "None of these, I'll search for it".
  When none of the AI's suggestions is right, the user types a name (Turkish, English
  or Latin, e.g. "kanlıca" or "Boletus") and picks the species from iNaturalist results,
  each with a photo so it can be compared by eye.

  onPick(candidate) receives a candidate shaped like a recognition result (source: 'user').
*/
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import Paper from '../ui/Paper';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { type } from '../ui/Typography';
import { searchSpecies } from '../../services/recognizer';
import { commonNameOf, displayName } from '../../services/safety';
import { t } from '../../i18n';
import { colors, fonts, radius } from '../../theme';

const DEBOUNCE_MS = 400;

function ResultRow({ item, onPress }) {
  const photo = item.referencePhotos?.[0];
  return (
    <Paper padded={false} onPress={onPress} style={styles.row} accessibilityLabel={displayName(item)}>
      <View style={styles.thumb}>
        {photo ? (
          <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Icon name="mushroom" size={26} color={colors.inkFaint} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={2}>
          {displayName(item)}
        </Text>
        {!!commonNameOf(item) && <Text style={styles.latin}>{item.latinName}</Text>}
      </View>
      <Icon name="chevronRight" size={18} color={colors.inkFaint} />
    </Paper>
  );
}

export default function SpeciesSearch({ onPick, onBack }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ status: 'idle', results: [] }); // idle | loading | done | error
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setState({ status: 'idle', results: [] });
      return undefined;
    }
    const id = ++requestId.current;
    setState((s) => ({ ...s, status: 'loading' }));
    const timer = setTimeout(() => {
      searchSpecies(q)
        .then((results) => id === requestId.current && setState({ status: 'done', results }))
        .catch(() => id === requestId.current && setState({ status: 'error', results: [] }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const q = query.trim();

  return (
    <View style={styles.wrap}>
      <View style={{ gap: 4 }}>
        <Text style={type.h2}>{t('search.title')}</Text>
        <Text style={type.muted}>{t('search.subtitle')}</Text>
      </View>

      <View style={styles.inputBox}>
        <Icon name="eye" size={18} color={colors.moss} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.inkFaint}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel={t('search.title')}
        />
        {state.status === 'loading' && <ActivityIndicator size="small" color={colors.moss} />}
        {!!query && state.status !== 'loading' && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('search.clear')}>
            <Icon name="close" size={18} color={colors.inkFaint} />
          </Pressable>
        )}
      </View>

      {state.status === 'idle' && <Text style={type.small}>{t('search.hint')}</Text>}
      {state.status === 'error' && <Text style={styles.error}>{t('search.error')}</Text>}
      {state.status === 'done' && state.results.length === 0 && <Text style={type.small}>{t('search.empty', { query: q })}</Text>}

      <View style={{ gap: 8 }}>
        {state.results.map((item) => (
          <ResultRow key={`${item.taxonId}-${item.latinName}`} item={item} onPress={() => onPick(item)} />
        ))}
      </View>

      {state.results.length > 0 && <Text style={styles.credit}>{t('search.credit')}</Text>}

      <Button variant="text" title={t('search.back')} onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.forest,
    borderRadius: radius.pill,
    backgroundColor: colors.paperWhite,
  },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 16, color: colors.ink, paddingVertical: 10 },
  error: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.earth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingLeft: 8, paddingRight: 14 },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.paperEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 23, color: colors.forest },
  latin: { fontFamily: fonts.serifItalic, fontSize: 15, color: colors.inkSoft },
  credit: { fontFamily: fonts.sansItalic, fontSize: 11.5, color: colors.inkFaint, textAlign: 'center' },
});
