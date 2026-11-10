/*
  DATE FIELD (phone) — shows the date in a readable format and opens the phone's own
  date picker when tapped. Future dates can't be chosen.
  Android: a pop-up calendar dialog. iPhone: an inline calendar below the field.
*/
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Icon from '../ui/Icon';
import { formatDate } from '../../data/fieldNotes';
import { localeTag, t } from '../../i18n';
import { colors, fonts, radius } from '../../theme';

export default function DateField({ value, onChange }) {
  const [iosOpen, setIosOpen] = useState(false);
  const date = new Date(value);

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, picked) => {
          if (event.type === 'set' && picked) onChange(picked.getTime());
        },
      });
    } else {
      setIosOpen((v) => !v);
    }
  }

  return (
    <View>
      <Pressable onPress={open} style={styles.input} accessibilityRole="button" accessibilityLabel={t('notes.dateLabel', { date: formatDate(value) })}>
        <Text style={styles.value}>{formatDate(value)}</Text>
        <Icon name="clock" size={18} color={colors.moss} />
      </Pressable>
      {iosOpen && Platform.OS === 'ios' && (
        <DateTimePicker
          value={date}
          mode="date"
          display="inline"
          maximumDate={new Date()}
          locale={localeTag}
          accentColor={colors.forest}
          themeVariant="light"
          onChange={(event, picked) => {
            if (picked) onChange(picked.getTime());
            setIosOpen(false);
          }}
        />
      )}
    </View>
  );
}

export const dateFieldStyles = StyleSheet.create({
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    borderRadius: radius.sm,
    backgroundColor: colors.paperWhite,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: { fontFamily: fonts.sans, fontSize: 16, color: colors.ink },
});
const styles = dateFieldStyles;
