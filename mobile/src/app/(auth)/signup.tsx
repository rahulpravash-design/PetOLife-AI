import { useSignUp } from '@clerk/expo';
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

type ClerkErrorLike = { errors?: { code?: string; longMessage?: string; message?: string }[]; message?: string };

function hasErrorCode(err: unknown, code: string): boolean {
  return Boolean((err as ClerkErrorLike)?.errors?.some((e) => e.code === code));
}

// Clerk's own messages are written for end users ("That email address is
// taken."), so they're shown as-is; anything else falls back to `fallback`.
function clerkErrorMessage(err: unknown, fallback: string): string {
  const e = err as ClerkErrorLike | null;
  return e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || fallback;
}

// Clerk verifies the email with an emailed code before it creates the session;
// the backend only ever trusts a verified primary email.
export default function SignupScreen() {
  const { signUp } = useSignUp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>, failure: string) {
    setError(null);
    setLoading(true);
    try {
      await action();
    } catch (err) {
      setError(clerkErrorMessage(err, failure));
    } finally {
      setLoading(false);
    }
  }

  const sendCode = async () => {
    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) throw sendError;
  };

  const onSubmit = () =>
    run(async () => {
      const emailAddress = email.trim();
      const [firstName, ...rest] = name.trim().split(/\s+/);
      const lastName = rest.join(' ');

      // Send the name so the backend profile shows it instead of the email
      // prefix. If the Clerk instance has name collection switched off it
      // rejects the unknown parameter; the account is still valid without
      // it, so retry once without rather than blocking sign-up.
      let { error: createError } = await signUp.password({
        emailAddress,
        password,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      });
      if (createError && firstName && hasErrorCode(createError, 'form_param_unknown')) {
        ({ error: createError } = await signUp.password({ emailAddress, password }));
      }
      if (createError) throw createError;
      await sendCode();
      setVerifying(true);
    }, 'Could not create your account. Try a different email or a stronger password.');

  const onVerify = () =>
    run(async () => {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({
        code: code.trim(),
      });
      if (verifyError) throw verifyError;
      if (signUp.status !== 'complete') throw new Error('Sign-up not complete');
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) throw finalizeError;
    }, 'That code did not work. Try again or request a new one.');

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={styles.title}>{verifying ? 'Verify your email' : 'Create account'}</Text>

          {verifying ? (
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
                placeholder="Name"
                value={name}
                onChangeText={setName}
              />
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
            onPress={verifying ? onVerify : onSubmit}
            disabled={loading || (verifying ? !code : !email || !password || !name)}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{verifying ? 'Verify' : 'Sign Up'}</Text>
            )}
          </Pressable>

          {verifying ? (
            <Pressable style={styles.link} onPress={() => run(sendCode, 'Could not send a new code.')}>
              <Text>Send a new code</Text>
            </Pressable>
          ) : (
            <Link href="/(auth)/login" style={styles.link}>
              <Text>Already have an account? Sign in</Text>
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
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
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
