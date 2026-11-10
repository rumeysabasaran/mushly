/*
  ICONS — simple thin-line icons with a hand-drawn feel (the same drawings as the web version).
  Usage: <Icon name="camera" size={24} color={colors.forest} />
*/
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';

const PATHS = {
  home: ['M4 11.2 12 5l8 6.2V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z'],
  book: [
    'M12 6.5C10.3 5.2 7.6 4.6 4 4.8v13.6c3.6-.2 6.3.4 8 1.7',
    'M12 6.5c1.7-1.3 4.4-1.9 8-1.7v13.6c-3.6-.2-6.3.4-8 1.7z',
  ],
  camera: [
    'M4 8.5h3.2L8.8 6h6.4l1.6 2.5H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z',
    'M12 16.3a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z',
  ],
  gallery: [
    'M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    'M4.5 16.5 9 12l3.5 3.5 2-2 5 4.5',
    'M15.5 9.5a1.3 1.3 0 1 0 0-.01',
  ],
  // folded trail map
  trail: ['M9 5 4 7v12l5-2 6 2 5-2V5l-5 2z', 'M9 5v12M15 7v12'],
  user: ['M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6'],
  mushroom: [
    'M3.5 12.5C4.5 6.8 19.5 6.8 20.5 12.5c-3.6 1.3-13.4 1.3-17 0z',
    'M9.5 13.4c-.2 2.8-.6 4.8-1.3 6.6h7.6c-.7-1.8-1.1-3.8-1.3-6.6',
  ],
  leaf: ['M5 19C5 10 10 5 19 5c0 9-5 14-14 14z', 'M5 19 13 11'],
  autumn: ['M12 3.5 14 8l4.5-1-2 4.2 3 2.3-4.3 1L16 19l-4-2.6L8 19l.8-4.5-4.3-1 3-2.3-2-4.2L10 8z', 'M12 16.4V21'],
  sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4'],
  rain: ['M7 14.5a4 4 0 0 1 .6-8 5 5 0 0 1 9.3 1.2A3.4 3.4 0 0 1 17 14.5z', 'M8.5 17.5 7.5 20M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5'],
  sparkle: [
    'M12 3.5c.8 4.4 2.3 6 6.5 6.8-4.2.8-5.7 2.4-6.5 6.8-.8-4.4-2.3-6-6.5-6.8 4.2-.8 5.7-2.4 6.5-6.8z',
    'M18.5 16.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5z',
  ],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z'],
  lock: ['M6.5 11h11v8.5h-11z', 'M8.8 11V8.3a3.2 3.2 0 0 1 6.4 0V11'],
  clock: ['M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z', 'M12 7.5V12l3 2'],
  plus: ['M12 5v14M5 12h14'],
  info: ['M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z', 'M12 11v5.5M12 7.8v.01'],
  close: ['M6.5 6.5l11 11M17.5 6.5l-11 11'],
  check: ['M5 12.5l4.2 4.2L19 7'],
  chevronLeft: ['M14.5 5.5 8 12l6.5 6.5'],
  chevronRight: ['M9.5 5.5 16 12l-6.5 6.5'],
  pin: ['M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z', 'M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z'],
};

export default function Icon({ name, size = 22, color = colors.ink, strokeWidth = 1.6, style }) {
  const paths = PATHS[name];
  if (!paths) return null;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {paths.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}
