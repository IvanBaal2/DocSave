import { Alert, Linking } from 'react-native';
import { CONTACT } from './legal';

/** Opens the user's email app addressed to the privacy / support contact. No data is attached. */
export async function openPrivacyContact(): Promise<void> {
  const url = `mailto:${CONTACT}?subject=${encodeURIComponent('Docsave privacy request')}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Contact privacy support', `Please write to ${CONTACT}. Never send copies of your documents by email.`);
  }
}
