/*
  CONFIRM DIALOG — questions like "Delete this?".
  Uses the phone's native dialog, or the browser's in the web preview.
  Usage: if (await confirmAsync('Title', 'Message')) { ... }
*/
import { Alert, Platform } from 'react-native';
import { t } from '../../i18n';

export function confirmAsync(title, message, okLabel = t('common.delete')) {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    )
  );
}
