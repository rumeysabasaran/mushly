/*
  DATE FIELD (web preview) — the browser's own date input.
*/
import { createElement } from 'react';
import { timeToInputValue, todayInputValue, inputValueToTime } from '../../data/fieldNotes';
import { colors } from '../../theme';

export default function DateField({ value, onChange }) {
  return createElement('input', {
    type: 'date',
    value: timeToInputValue(value),
    max: todayInputValue(),
    onChange: (e) => e.target.value && onChange(inputValueToTime(e.target.value)),
    style: {
      minHeight: 48,
      padding: '0 12px',
      border: `1px solid ${colors.paperEdge}`,
      borderRadius: 8,
      background: colors.paperWhite,
      fontSize: 16,
      fontFamily: 'Nunito_400Regular',
      color: colors.ink,
    },
  });
}
