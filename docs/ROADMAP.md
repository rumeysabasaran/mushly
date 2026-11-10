# Mushly — Roadmap and Design Notes

A nature journal for the phone that turns forest walks into a game of discovery.
This document is the project's roadmap; it is updated at the end of every stage.

---

## 1. The core rule: no edibility information

- Nothing about edible / poisonous / consumable may appear anywhere: not in the UI,
  the data or recognition results (no text, icon, color or hint).
- Every recognition response passes through a single safety filter before it reaches
  the screen (`src/services/safety.js`). It keeps only allow-listed fields and drops any
  sentence containing a banned word stem, in Turkish and English.
- The disclaimer is shown throughout the app: *"Mushly is a nature journal, not a
  consumption guide. Identifying a species from a photo is never certain."*

## 2. Technical choices

**November 2026:** the app moved from a web PWA to a real phone app built with
**React Native** (stage 3.5). The goal was not speed or app-store presence, but a polished,
fluid, native feel. The last web version lives on the `web-son` branch; development
continues on `main`.

| Topic | Choice | Why |
|---|---|---|
| Framework | React Native + **Expo** (SDK 58) | Camera, location and files out of the box; wireless testing with Expo Go |
| Language | JavaScript (JSX) | Easier to read than TypeScript for this project |
| Navigation | Expo Router (file-based) | Every file in `src/app/` is a screen |
| Local data | SQLite (`expo-sqlite`) | The phone's own database: fast and offline |
| Photos | Files in the app's own folder | Keeps the database light |
| Camera / gallery | `expo-image-picker` + `expo-image-manipulator` | Native camera; photos are resized to 1280 px |
| Location | `expo-location` | One-off, with permission |
| Animation / gestures | Reanimated + Gesture Handler | Book pages follow the finger at 60 fps |
| Drawings | `react-native-svg` | Icons and ornaments ported from the web version |
| Fonts | Cormorant Garamond (headings), Nunito (body) | Bundled, work offline |
| Languages | `expo-localization` + `src/i18n` | English and Turkish, following the phone's language |
| API keys | A small server (`server/`) | Keys never reach the phone |

## 3. Folder structure

```
src/
  app/                  → Screens (Expo Router: file name = route)
    _layout.jsx         → Fonts, database, root layout
    (tabs)/             → Tab screens: index (Home), book, scan, trips, profile
    pending.jsx         → Photos taken offline
    api/identify+api.js → Recognition endpoint on the dev server
  theme.js              → Colors, fonts, sizes, shadows (one place)
  i18n/                 → en.js, tr.js and the t() helper
  components/
    layout/             → Tab bar and camera button
    ui/                 → Paper card, button, chip, ornaments, icons, sheet
    book/               → Book, cover, pages, page flipping
    scan/               → Identify flow, candidates, field notes form, celebration
  data/
    db.js               → SQLite tables and change notifications
    hooks.js            → Live queries the screens read from
    catalog.js, fieldNotes.js, gamification.js
  services/
    safety.js           → Safety filter (shared with the server)
    recognizer.js       → Sends the photo to the server
    photos.js           → Resizes and stores photos
    collection.js, pendingQueue.js → Saving finds and the offline queue
server/
  prompt.js             → Prompt and response schema (per language)
  identify.js, providers/ → Evren → Gemini → Claude fallback chain
functions/api/identify.js → Production endpoint (Cloudflare, stage 6)
```

## 4. Data model (on the device, SQLite)

Every record has a unique `id` and an `updatedAt`, so a cloud sync can be added later
without changing the structure.

- **species** — every species page in the book (common/Latin name, description,
  "Did you know?", rarity, first found date, sighting count, description language)
- **sightings** — individual finds (photo, date, location, weather, companions, note,
  trip, status: `confirmed` or `draft`)
- **photos** — where photo files are (large + small preview); files live in the app folder
- **trips** — trips (start, end, place)
- **pending** — photos taken offline, waiting to be identified
- **points** — point entries (the total score is their sum)
- **badges** — earned badges

Schema migrations run on startup (`PRAGMA user_version`). v2 renamed `turkishName` to
the language-neutral `commonName`.

## 5. Recognition service

**Chosen: Evren LLM API, `gemma-4-31b`** (`server/providers/evren.js`). Free (until
1 December 2026, according to the platform). OpenAI-compatible format; the image is sent
as base64. Five vision models were tested on the same photo: gemma-4-31b wrote the best
text (~12 s), qwen3-vl-30b was fastest but shallow, and the others were too slow.

**Automatic fallback chain** (`server/identify.js`): Evren → Gemini → Claude. If a service
fails, the next one is tried. Gemini (`gemini-3.5-flash-lite`, free tier, Google's
Interactions API) is ready for after 1 December and was tested with real photos (~3 s,
correct species). Claude Opus 5.5 is the paid last resort (`server/providers/claude.js`).

Whichever service is used, the reply is requested in the same JSON schema
(`server/prompt.js`, no edibility field). The phone sends its language, and the
descriptions come back in Turkish or English. Replies are filtered twice: on the server
and on the phone.

Cloudflare Pages was chosen as the production host: it's free and doesn't cut requests
that take longer than 10 seconds (Netlify/Vercel free plans do).

Original comparison:

**A) Claude (Anthropic): a general vision AI** *(initial recommendation)*
- ✅ One request returns the 3 most likely species, confidence, descriptions,
  a "Did you know?" fact and rarity. No separate species database needed.
- ✅ We define the reply format, so edibility is never requested.
- ➖ Not trained specifically on mushrooms; may confuse look-alike species.

**B) Kindwise mushroom.id: a mushroom-specific recognition API**
- ✅ Trained on mushrooms; usually more accurate at naming species.
- ➖ The reply includes edibility information, which would have to be filtered out.
- ➖ No Turkish text; descriptions would need a second source.

The code has a recognizer adapter (`src/services/recognizer.js`), so switching services
means changing a single file on the server.

## 6. Working offline

- The app is installed on the phone, so the book always opens without internet.
- All data is on the device, so the collection is always visible.
- Photos taken without a connection go to the **Pending** list; once online they are
  identified and the user is notified.

## 7. Stages

1. ✅ Project structure, theme and main screens
2. ✅ Photo capture/upload and species recognition
3. ✅ Collection book and page flipping
3.5 ✅ Move to React Native (Expo): everything from stages 1–3 rewritten as a phone app with
   the same look and behavior. Added: the phone's own camera, date picker and dialogs,
   light haptics, page flipping that follows the finger, sheets that close by dragging down
3.6 ✅ Renamed to **Mushly**; codebase and docs in English; the app speaks English and
   Turkish (UI and AI-written descriptions follow the phone's language)
4. ⬜ Points, badges and levels
5. ⬜ Trip logs and profile screen
6. ⬜ Final polish: app icon and splash screen, hosting the recognition server,
   installable builds (Android/iOS)
