/*
  BOOK — the collection book.

  Page order:
    Cover → Contents → Species pages (in order found) → Drafts
    → "?" pages (optional) → Final page

  Routes: /book                    → the page you left (the cover on first open)
          /book?page=<species-id>  → opens by flipping to that page (e.g. after a new save)
          /book?page=drafts        → the drafts page
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Storage from 'expo-sqlite/kv-store';
import Book from '../../components/book/Book';
import { CoverPage, TocPage, SpeciesPage, MysteryPage, DraftsPage, EndPage } from '../../components/book/BookPages';
import { PhotoSheet, EditSheet, DraftSheet } from '../../components/book/BookSheets';
import Icon from '../../components/ui/Icon';
import { Eyebrow } from '../../components/ui/Typography';
import { useBookData, useRewriteForeignPages } from '../../data/hooks';
import { MYSTERY_SPECIES } from '../../data/catalog';
import { speciesKeyOf } from '../../services/collection';
import { commonNameOf, displayName } from '../../services/safety';
import { t } from '../../i18n';
import { colors, fonts, layout, space } from '../../theme';

const MYSTERY_KEY = 'mushly.showMystery';

/** A small on/off preference remembered on the device */
function useRememberedToggle(key, fallback) {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    Storage.getItem(key)
      .then((saved) => saved != null && setValue(saved === '1'))
      .catch(() => {});
  }, [key]);
  const update = useCallback(
    (next) => {
      setValue(next);
      Storage.setItem(key, next ? '1' : '0').catch(() => {});
    },
    [key]
  );
  return [value, update];
}

function ArrowButton({ icon, onPress, disabled, label }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.arrow, disabled && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.95 }] }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={22} color={colors.forest} strokeWidth={1.8} />
    </Pressable>
  );
}

export default function BookScreen() {
  const { page: pageKey, t: requestId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const data = useBookData();
  useRewriteForeignPages(data?.species);
  const [showMystery, setShowMystery] = useRememberedToggle(MYSTERY_KEY, true);
  const [index, setIndex] = useState(0);
  const [sheet, setSheet] = useState(null); // { type: 'photo'|'edit'|'draft', ... }
  const bookRef = useRef(null);
  const handledRequest = useRef(null);

  // The list of pages: each one is { key, node }
  const pages = useMemo(() => {
    if (!data) return [];
    const { species, bySpecies, drafts } = data;

    const found = new Set(species.map((s) => s.speciesKey));
    const mysteries = showMystery ? MYSTERY_SPECIES.filter((m) => !found.has(speciesKeyOf(m.latinName))) : [];

    // Page number = position in the book (cover 0, contents 1)
    const firstSpeciesPage = 2;
    const draftsPage = drafts.length ? firstSpeciesPage + species.length : null;
    const firstMysteryPage = firstSpeciesPage + species.length + (drafts.length ? 1 : 0);

    const jump = (i) => bookRef.current?.jumpTo(i);

    const list = [
      {
        key: 'cover',
        backVariant: 'endpaper',
        node: <CoverPage speciesCount={species.length} onOpen={() => bookRef.current?.next()} />,
      },
      {
        key: 'toc',
        node: (
          <TocPage
            number={1}
            entries={species.map((s, i) => ({
              key: s.id,
              no: i + 1,
              name: displayName(s),
              latin: commonNameOf(s) ? s.latinName : '',
              page: firstSpeciesPage + i,
            }))}
            draftCount={drafts.length}
            draftsPage={draftsPage}
            mysteryCount={mysteries.length}
            mysteryPage={firstMysteryPage}
            showMystery={showMystery}
            onToggleMystery={setShowMystery}
            onJump={jump}
          />
        ),
      },
    ];

    species.forEach((s, i) =>
      list.push({
        key: s.id,
        node: (
          <SpeciesPage
            number={firstSpeciesPage + i}
            no={i + 1}
            species={s}
            sightings={bySpecies[s.id] ?? []}
            onOpenPhoto={(photoId) => setSheet({ type: 'photo', photoId, species: s })}
            onEditSighting={(sighting) => setSheet({ type: 'edit', sighting })}
          />
        ),
      })
    );

    if (drafts.length) {
      list.push({
        key: 'drafts',
        node: <DraftsPage number={draftsPage} drafts={drafts} onOpenDraft={(sighting) => setSheet({ type: 'draft', sighting })} />,
      });
    }

    mysteries.forEach((m, i) =>
      list.push({ key: `mystery-${m.latinName}`, node: <MysteryPage number={firstMysteryPage + i} entry={m} first={i === 0} /> })
    );

    list.push({ key: 'end', node: <EndPage number={list.length} speciesCount={species.length} /> });
    return list;
  }, [data, showMystery, setShowMystery]);

  const last = pages.length - 1;

  // If the number of pages shrank (e.g. a find was deleted), clamp the index
  useEffect(() => {
    if (pages.length && index > last) bookRef.current?.jumpTo(last);
  }, [pages.length, index, last]);

  // Opened with ?page=<key>: open one page before it, then flip to it
  useEffect(() => {
    const request = `${pageKey}:${requestId}`;
    if (!pages.length || !pageKey || handledRequest.current === request) return;
    handledRequest.current = request;
    setSheet(null);
    const target = pages.findIndex((p) => p.key === pageKey);
    if (target > 0) bookRef.current?.flipTo(target);
  }, [pages, pageKey, requestId]);

  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: layout.navHeight + insets.bottom + 16 }]}>
      <View style={styles.bar}>
        <View>
          <Eyebrow>{t('book.eyebrow')}</Eyebrow>
          <Text style={styles.title}>{t('book.title')}</Text>
        </View>
        {data && <Text style={styles.count}>{t('common.speciesCount', { count: data.species.length })}</Text>}
      </View>

      {pages.length > 0 ? (
        <Book ref={bookRef} pages={pages} index={Math.min(index, last)} onIndexChange={setIndex} />
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <View style={styles.controls}>
        <ArrowButton icon="chevronLeft" label={t('book.prevPage')} onPress={() => bookRef.current?.prev()} disabled={index <= 0} />
        <Pressable onPress={() => bookRef.current?.jumpTo(1)} disabled={pages.length < 2} style={styles.tocBtn} accessibilityRole="button">
          <Text style={styles.tocText}>{t('book.toc')}</Text>
        </Pressable>
        <Text style={styles.pos}>{index === 0 ? t('book.cover') : `${index} / ${last}`}</Text>
        <ArrowButton icon="chevronRight" label={t('book.nextPage')} onPress={() => bookRef.current?.next()} disabled={index >= last} />
      </View>

      {sheet?.type === 'photo' && <PhotoSheet photoId={sheet.photoId} species={sheet.species} onClose={closeSheet} />}
      {sheet?.type === 'edit' && <EditSheet sighting={sheet.sighting} onClose={closeSheet} />}
      {sheet?.type === 'draft' && <DraftSheet sighting={sheet.sighting} onClose={closeSheet} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.gutter, gap: 12, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  bar: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  title: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 32, color: colors.forest },
  count: { fontFamily: fonts.serifItalic, fontSize: 17, color: colors.inkSoft },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: {
    width: 48,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.paperEdge,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tocBtn: { height: 44, paddingHorizontal: 14, justifyContent: 'center' },
  tocText: { fontFamily: fonts.sansHeavy, fontSize: 14, color: colors.forest },
  pos: { flex: 1, textAlign: 'center', fontFamily: fonts.serifItalic, fontSize: 16, color: colors.inkSoft },
});
