/*
  ORNAMENTS — fine hand-drawn motifs from old nature notebooks (the same drawings as the web version).
  Colors are set with `color`.
*/
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';

/**
 * A fern sprig. The leaflets are placed along a curve in code,
 * so each has a slightly different size and looks hand-drawn.
 */
const FERN_LEAVES = (() => {
  const p0 = [10, 86];
  const p1 = [30, 40];
  const p2 = [82, 10];
  const point = (t) => [
    (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0],
    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1],
  ];
  const tangent = (t) => {
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const len = Math.hypot(dx, dy);
    return [dx / len, dy / len];
  };
  const leaves = [];
  for (let i = 1; i <= 9; i++) {
    const t = i / 10.5;
    const [x, y] = point(t);
    const [tx, ty] = tangent(t);
    const len = 15 * (1 - t * 0.7); // gets smaller towards the tip
    [-1, 1].forEach((side) => {
      const nx = -ty * side + tx * 0.55;
      const ny = tx * side + ty * 0.55;
      const ex = x + nx * len;
      const ey = y + ny * len;
      const cx = x + nx * len * 0.5 + tx * 4;
      const cy = y + ny * len * 0.5 + ty * 4;
      leaves.push(`M${x.toFixed(1)} ${y.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
    });
  }
  return { stem: `M${p0}Q${p1} ${p2}`, leaves };
})();

export function FernSprig({ size = 90, color = colors.moss, flip = false, style }) {
  return (
    <View style={[{ width: size, height: size }, flip && { transform: [{ scaleX: -1 }] }, style]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 96 96" fill="none" stroke={color} strokeLinecap="round">
        <Path d={FERN_LEAVES.stem} strokeWidth={1.4} />
        {FERN_LEAVES.leaves.map((d, i) => (
          <Path key={i} d={d} strokeWidth={1.1} />
        ))}
      </Svg>
    </View>
  );
}

/** A small mushroom sketch, used on empty screens and the cover */
export function MushroomSketch({ size = 72, color = colors.moss, style }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {/* cap */}
      <Path d="M9.5 33.5C11 17.5 53 17 54.5 33.5c-8.8 3.4-36 3.6-45 0z" />
      {/* gills under the cap */}
      <Path d="M17 35.5l1.5 2M24 36.4l1 2M40 36.4l-1 2M47 35.5l-1.5 2" strokeWidth={1} />
      {/* stem */}
      <Path d="M26.5 36.6c-.4 7.5-1.6 13-3.6 17.6h18.2c-2-4.6-3.2-10.1-3.6-17.6" />
      {/* ring */}
      <Path d="M26 42.5c3.6 1.6 8.4 1.6 12 0" strokeWidth={1.1} />
      {/* spots */}
      <Path d="M22 27.5c1.4-.6 2.6.2 2.2 1.4M33 23.8c1.6-.4 2.6.6 2 1.8M43 28.2c1.2-.4 2 .4 1.6 1.3" strokeWidth={1.1} />
      {/* grass */}
      <Path d="M12 56c2.5-.6 5-.4 7 .2M44 56c3-.7 6-.5 8.5.3M18 56l-1.5-4M48 56l1.2-3.6" strokeWidth={1.1} />
    </Svg>
  );
}

/** Corner ornament: a curling vine */
export function CornerFlourish({ size = 46, color = colors.moss, rotate = 0, style }) {
  return (
    <View style={[{ width: size, height: size, transform: [{ rotate: `${rotate}deg` }] }, style]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round">
        <Path d="M3 45C3 22 20 4 45 3" />
        <Path d="M8 30c-5-1.5-5-8 .5-7.5 3.4.4 3 4.6-.2 4.2" />
        <Path d="M20 12.5c-.8-4.8 5-6.6 6.4-2.6.9 2.8-2.4 4-3.7 1.6" />
        <Path d="M12 21c3.5-.4 6.2 1.6 6.6 4.6-3.4.4-6-1.4-6.6-4.6z" />
        <Path d="M28 6.5c1 3 3.6 4.4 6.4 3.8-.6-3-3.4-4.6-6.4-3.8z" />
      </Svg>
    </View>
  );
}

/** Section divider: a thin line with a small leaf in the middle */
export function Divider({ color = colors.moss, opacity = 0.65, style }) {
  return (
    <View style={[{ height: 14, opacity }, style]} pointerEvents="none">
      <Svg width="100%" height={14} viewBox="0 0 240 14" preserveAspectRatio="none" fill="none" stroke={color} strokeLinecap="round">
        <Path d="M8 7.2C40 6.4 80 7.8 106 7" strokeWidth={1} />
        <Path d="M134 7c26 .8 66-.6 98 .2" strokeWidth={1} />
        <Path d="M112 7c3-4.4 9-5 16-.2-6 4.6-12.6 4.6-16 .2z" strokeWidth={1.1} />
        <Path d="M112 7h16" strokeWidth={0.8} />
      </Svg>
    </View>
  );
}
