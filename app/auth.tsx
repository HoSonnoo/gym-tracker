import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

const PRIMARY = '#7e47ff';
const GOOGLE_IOS_CLIENT_ID = '118589769055-0jff34po7f7ma8qjt98h0pgvfpfpg0lu.apps.googleusercontent.com';
const GOOGLE_WEB_CLIENT_ID = '118589769055-eppr8skbb9me6pskhg075j4fpjr58mmn.apps.googleusercontent.com';

type AuthMode = 'login' | 'register';

export default function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, continueAsGuest } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [shouldNavigate, setShouldNavigate] = useState(false);

  // Redirect separato dalla logica asincrona — funziona sempre su iOS
  React.useEffect(() => {
    if (shouldNavigate) {
      router.replace('/(tabs)');
    }
  }, [shouldNavigate]);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Campi mancanti', 'Inserisci email e password.');
      return;
    }

    if (mode === 'register') {
      if (trimmedPassword.length < 6) {
        Alert.alert('Password troppo corta', 'La password deve essere di almeno 6 caratteri.');
        return;
      }
      if (trimmedPassword !== confirmPassword.trim()) {
        Alert.alert('Password non corrispondenti', 'Le due password non coincidono.');
        return;
      }
    }

    try {
      setLoading(true);
      if (mode === 'login') {
        await signInWithEmail(trimmedEmail, trimmedPassword);
      } else {
        await signUpWithEmail(trimmedEmail, trimmedPassword);
        Alert.alert(
          'Registrazione completata',
          'Account creato con successo!',
          [{ text: 'OK', onPress: () => setMode('login') }]
        );
        return;
      }
      router.replace('/(tabs)');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      if (msg.includes('Invalid login credentials')) {
        Alert.alert('Accesso negato', 'Email o password errati.');
      } else if (msg.includes('User already registered')) {
        Alert.alert('Account esistente', 'Esiste già un account con questa email.');
      } else if (msg.includes('Email not confirmed')) {
        Alert.alert('Email non confermata', 'Controlla la tua casella di posta.');
      } else {
        Alert.alert('Errore', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);

      // In Expo Go usa exp://, in produzione usa lo scheme custom
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'com.hosonno.gymtracker',
        preferLocalhost: false,
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          scopes: 'email profile',
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('URL OAuth non disponibile');

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      // Breve poll (3 tentativi × 800ms) per dare tempo a Supabase di salvare la sessione
      let navigated = false;
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 800));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setShouldNavigate(true);
          navigated = true;
          break;
        }
      }

      // Il login è avvenuto — se non navigato, il testo sotto il bottone informa l'utente
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      Alert.alert('Errore Google', msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Nessun identity token da Apple');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw error;
      router.replace('/(tabs)');
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') return; // utente ha annullato
      const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
      Alert.alert('Errore Apple', msg);
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.header}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.appName}>VYRO</Text>
            <Text style={styles.appTagline}>Il tuo tracker di allenamento</Text>
          </View>

          {/* Segmented control */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeOption, mode === 'login' && styles.modeOptionActive]}
              onPress={() => setMode('login')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeOptionText, mode === 'login' && styles.modeOptionTextActive]}>
                Accedi
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeOption, mode === 'register' && styles.modeOptionActive]}
              onPress={() => setMode('register')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeOptionText, mode === 'register' && styles.modeOptionTextActive]}>
                Registrati
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form email/password */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="nome@email.com"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === 'register' ? 'Minimo 6 caratteri' : '••••••••'}
                placeholderTextColor={Colors.dark.textMuted}
                secureTextEntry
              />
            </View>

            {mode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Conferma password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Ripeti la password"
                  placeholderTextColor={Colors.dark.textMuted}
                  secureTextEntry
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading || googleLoading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === 'login' ? 'Accedi' : 'Crea account'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Divisore */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>oppure</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social login */}
          <View style={styles.socialButtons}>
            <TouchableOpacity
              style={[styles.socialBtn, googleLoading && styles.btnDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loading || googleLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <ActivityIndicator color={Colors.dark.text} size="small" />
              ) : (
                <>
                  <Text style={styles.socialBtnIcon}>G</Text>
                  <Text style={styles.socialBtnText}>Continua con Google</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={styles.googleNoteBox}>
              <Text style={styles.googleNoteIcon}>ℹ️</Text>
              <Text style={styles.googleNote}>
                Dopo aver scelto l'account Google, chiudi e riapri Vyro per completare l'accesso.
              </Text>
            </View>
          </View>

          {/* Divisore */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>oppure</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Apple Sign In — visibile solo su iOS */}
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={14}
            style={styles.appleBtn}
            onPress={handleAppleSignIn}
          />

          {/* Divisore */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>oppure</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Ospite */}
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={handleGuest}
            activeOpacity={0.8}
          >
            <Text style={styles.guestBtnText}>👤 Continua come ospite</Text>
            <Text style={styles.guestBtnSubtitle}>
              Funzionalità limitate · Nessun backup cloud
            </Text>
          </TouchableOpacity>

          {/* Info tier */}
          <View style={styles.tierInfo}>
            <Text style={styles.tierInfoTitle}>Account gratuito include:</Text>
            <Text style={styles.tierInfoItem}>✓ Storico illimitato</Text>
            <Text style={styles.tierInfoItem}>✓ Sync multi-dispositivo</Text>
            <Text style={styles.tierInfoItem}>✓ Backup automatico</Text>
            <Text style={styles.tierInfoItem}>✓ Template ed esercizi illimitati</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.dark.background },
  container: { padding: 24, paddingBottom: 48, gap: 24 },
  header: { alignItems: 'center', paddingTop: 24, gap: 8 },
  logoImage: { width: 90, height: 90, borderRadius: 22, marginBottom: 4 },
  appName: { fontSize: 32, fontWeight: '900', color: Colors.dark.text, letterSpacing: 4 },
  appTagline: { fontSize: 14, color: Colors.dark.textMuted, fontWeight: '500' },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 4,
    gap: 4,
  },
  modeOption: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  modeOptionActive: { backgroundColor: PRIMARY },
  modeOptionText: { fontSize: 15, fontWeight: '700', color: Colors.dark.textMuted },
  modeOptionTextActive: { color: '#fff' },
  form: { gap: 16 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.dark.textMuted, marginLeft: 2 },
  input: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
  },
  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.dark.border },
  dividerText: { fontSize: 13, color: Colors.dark.textMuted, fontWeight: '500' },
  socialButtons: { gap: 12 },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: 14,
  },
  socialBtnIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
    width: 24,
    textAlign: 'center',
  },
  socialBtnText: { fontSize: 15, fontWeight: '700', color: Colors.dark.text },
  appleBtn: {
    height: 50,
    width: '100%',
  },
  googleNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(126,71,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.25)',
    padding: 12,
    marginTop: 10,
  },
  googleNoteIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  googleNote: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.text,
    lineHeight: 18,
  },
  guestBtn: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
  },
  guestBtnText: { fontSize: 15, fontWeight: '700', color: Colors.dark.text },
  guestBtnSubtitle: { fontSize: 12, color: Colors.dark.textMuted },
  tierInfo: {
    backgroundColor: 'rgba(126,71,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.25)',
    padding: 16,
    gap: 6,
  },
  tierInfoTitle: { fontSize: 13, fontWeight: '700', color: PRIMARY, marginBottom: 4 },
  tierInfoItem: { fontSize: 13, color: Colors.dark.text, fontWeight: '500' },
});