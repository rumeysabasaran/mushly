/*
  THEME — every color, font and size the app uses lives here.
  To change a color, editing this file is enough.
  (A one-to-one port of theme.css from the web version.)
*/
import { Platform } from 'react-native';

export const colors = {
  // Base colors
  cream: '#f4eddc', // background
  paper: '#faf5e8', // paper cards, book pages
  paperEdge: '#e6dabf', // paper edges, thin lines
  paperWhite: '#fffdf6', // polaroids, form fields
  forest: '#2e4a33', // dark moss green: headings, buttons, cover
  forestDeep: '#1e3322', // deeper green: pressed buttons
  moss: '#6b8459', // light moss: secondary accent

  // Accent colors (use sparingly)
  earth: '#7b5634', // earth brown
  mustard: '#d2a03a', // warm mustard yellow
  mustardSoft: '#f0dfb4',

  // Text colors
  ink: '#2a2822',
  inkSoft: '#625d50',
  inkFaint: '#9a927f',
  line: 'rgba(46, 74, 51, 0.16)',
};

/*
  Fonts: on the phone, every weight is a separate font file.
  That's why we use the right file's name instead of "fontWeight".
*/
export const fonts = {
  serif: 'CormorantGaramond_600SemiBold',
  serifMedium: 'CormorantGaramond_500Medium',
  serifItalic: 'CormorantGaramond_500Medium_Italic',
  serifBoldItalic: 'CormorantGaramond_600SemiBold_Italic',
  sans: 'Nunito_400Regular',
  sansItalic: 'Nunito_400Regular_Italic',
  sansBold: 'Nunito_700Bold',
  sansHeavy: 'Nunito_800ExtraBold',
};

export const space = {
  gutter: 18,
  gap: 18,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
};

export const layout = {
  navHeight: 66,
  maxWidth: 560,
};

/** Shadows: paper lifted slightly off the table */
export const shadows = {
  paper: Platform.select({
    web: { boxShadow: '0 1px 2px rgba(70,50,20,0.07), 0 6px 18px rgba(70,50,20,0.09)' },
    default: {
      shadowColor: '#46321a',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  }),
  lift: Platform.select({
    web: { boxShadow: '0 2px 4px rgba(30,51,34,0.18), 0 10px 24px rgba(30,51,34,0.22)' },
    default: {
      shadowColor: '#1e3322',
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
  }),
};

/** Animation durations (ms): soft and restrained */
export const motion = {
  fast: 140,
  base: 280,
  flip: 520,
};

/** Paper texture (assets/paper-noise.png), tiled over cards and the background */
export const paperNoise = require('../assets/paper-noise.png');
