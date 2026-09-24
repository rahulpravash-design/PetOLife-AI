import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { documentsService } from '@/services/documents';
import { getErrorMessage } from '@/services/errors';

// The backend accepts only these image types. Some Android pickers report
// 'image/jpg' or omit the type, so normalise instead of failing the upload.
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
function normalizeMime(mime?: string | null): string {
  const m = mime?.toLowerCase();
  if (m === 'image/jpg') return 'image/jpeg';
  return m && ACCEPTED_MIME.has(m) ? m : 'image/jpeg';
}

export default function ScanDocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(source: 'camera' | 'library') {
    setError(null);
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Permission denied. Enable camera/photo access in Settings to scan documents.');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6 });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageUri(asset.uri);

    if (!asset.base64) {
      setError('Could not read image data.');
      return;
    }

    setExtracting(true);
    try {
      const draft = await documentsService.extract(id, asset.base64, normalizeMime(asset.mimeType));
      router.replace({
        pathname: '/pet/[id]/add-record',
        params: {
          id,
          draftType: draft.type,
          draftTitle: draft.title,
          draftDate: draft.date ?? '',
          draftValue: draft.value != null ? String(draft.value) : '',
          draftUnit: draft.unit ?? '',
          draftNotes: draft.notes ?? '',
          draftConfidence: draft.confidence,
        },
      });
    } catch (err) {
      setError(
        `${getErrorMessage(err, 'Could not extract details from this document.')} You can still add the record manually.`,
      );
    } finally {
      setExtracting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.title}>Scan a Document</Text>
        <Text style={styles.subtitle}>
          Take a photo of a vet invoice, vaccination card, or lab report. You&apos;ll review the
          extracted details before anything is saved.
        </Text>

        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}

        {extracting ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <View style={styles.buttons}>
            <Pressable style={styles.button} onPress={() => pick('camera')}>
              <Text style={styles.buttonText}>Take Photo</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => pick('library')}>
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Choose from Library</Text>
            </Pressable>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20, gap: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 20 },
  preview: { width: '100%', height: 240, borderRadius: 12, backgroundColor: '#eee' },
  loading: { marginTop: 20 },
  buttons: { gap: 12, marginTop: 12 },
  button: { backgroundColor: '#208AEF', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonSecondary: { backgroundColor: '#f0f0f0' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonTextSecondary: { color: '#333' },
  error: { color: '#d33', fontSize: 14 },
});
