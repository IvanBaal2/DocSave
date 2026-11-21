import { Alert, Linking } from 'react-native';
import { t } from '../i18n';
import { CONTACT } from './legal';

/** Opens the user's email app addressed to the privacy / support contact. No data is attached. */
export async function openPrivacyContact(): Promise<void> {
  const url = `mailto:${CONTACT}?subject=${encodeURIComponent(t('Docsave privacy request'))}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(t('Contact privacy support'), t('Please write to {email}. Never send copies of your documents by email.', { email: CONTACT }));
  }
}
