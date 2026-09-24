import { useSignIn } from '@clerk/expo';
import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Signing in from a new device is challenged with an emailed code (Clerk
// "client trust"); that is the only extra step the app supports. Other
// challenges (e.g. MFA) are not handled yet.
export default function LoginScreen() {
  const { signIn } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsCode = signIn.status === 'needs_client_trust';

  async function run(action: () => Promise<void>, failure: string) {
    setError(null);
    setLoading(true);
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      setLoading(false);
    }
  }

  async function continueSignIn() {
    if (signIn.status === 'complete') {
      const { error: finalizeError } = await signIn.finalize();
      if (finalizeError) throw finalizeError;
    } else if (signIn.status === 'needs_client_trust') {
      const { error: sendError } = await signIn.mfa.sendEmailCode();
      if (sendError) throw sendError;
    } else {
      setError('This account needs an extra verification step that the app does not support yet.');
    }
  }

  const onSubmit = () =>
    run(async () => {
      const { error: passwordError } = await signIn.password({
        emailAddress: email.trim(),
        password,
      });
      if (passwordError) throw passwordError;
      await continueSignIn();
    }, 'Could not sign in. Check your email and password.');

  const onVerify = () =>
    run(async () => {
      const { error: verifyError } = await signIn.mfa.verifyEmailCode({ code: code.trim() });
      if (verifyError) throw verifyError;
      await continueSignIn();
    }, 'That code did not work. Try again or request a new one.');

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={styles.title}>PetOLife</Text>
          <Text style={styles.subtitle}>
            {needsCode
              ? 'Enter the code we emailed you'
              : "Sign in to see your pets' health story"}
          </Text>

          {needsCode ? (
            <TextInput
              style={styles.input}
              placeholder="Verification code"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
            />
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={needsCode ? onVerify : onSubmit}
            disabled={loading || (needsCode ? !code : !email || !password)}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{needsCode ? 'Verify' : 'Sign In'}</Text>
            )}
          </Pressable>

          {needsCode ? (
            <Pressable style={styles.link} onPress={() => signIn.reset()}>
              <Text>Start over</Text>
            </Pressable>
          ) : (
            <Link href="/(auth)/signup" style={styles.link}>
              <Text>Don&apos;t have an account? Sign up</Text>
            </Link>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: '#d33', fontSize: 14 },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 16, alignSelf: 'center' },
});
