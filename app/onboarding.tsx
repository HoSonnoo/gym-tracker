import { Colors } from '@/constants/Colors';
import { requestNotificationPermissions } from '@/lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');

export const ONBOARDING_KEY = '@vyro:onboarding_completed';

const SLIDES = [
  {
    emoji: '💪',
    title: 'Traccia i tuoi\nallenamenti',
    description: 'Crea template personalizzati, registra serie e pesi in tempo reale. Il timer di recupero ti avvisa quando è il momento di ricominciare.',
    color: 'rgba(126,71,255,0.12)',
    border: 'rgba(126,71,255,0.3)',
  },
  {
    emoji: '📊',
    title: 'Monitora\ni tuoi progressi',
    description: 'Visualizza i tuoi personal record, il volume totale per esercizio e la frequenza settimanale. Tutto in grafici chiari e intuitivi.',
    color: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.25)',
  },
  {
    emoji: '🥗',
    title: 'Gestisci\nl\'nutrizione',
    description: 'Traccia i pasti giornalieri, l\'acqua e il peso corporeo. Importa piani alimentari in PDF e monitora le fasi di Bulk e Cut.',
    color: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
  },
  {
    emoji: '🔔',
    title: 'Notifiche\nintelligenti',
    description: 'Ricevi una notifica quando il timer di recupero scade, anche con l\'app in background. Non perdere mai il ritmo del tuo allenamento.',
    color: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    isNotificationSlide: true,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [notifGranted, setNotifGranted] = useState(false);

  const isLast = currentIndex === SLIDES.length - 1;

  const goToNext = () => {
    if (isLast) {
      completeOnboarding();
    } else {
      const next = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
      setCurrentIndex(next);
    }
  };

  const handleRequestNotifications = async () => {
    const granted = await requestNotificationPermissions();
    setNotifGranted(granted);
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(tabs)');
  };

  const slide = SLIDES[currentIndex];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={styles.slide}>
            {/* Card principale */}
            <View style={[styles.card, { backgroundColor: s.color, borderColor: s.border }]}>
              <Text style={styles.emoji}>{s.emoji}</Text>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.description}>{s.description}</Text>

              {s.isNotificationSlide && !notifGranted && (
                <TouchableOpacity
                  style={styles.notifBtn}
                  onPress={handleRequestNotifications}
                  activeOpacity={0.85}
                >
                  <Text style={styles.notifBtnText}>🔔 Attiva notifiche</Text>
                </TouchableOpacity>
              )}
              {s.isNotificationSlide && notifGranted && (
                <View style={styles.notifGranted}>
                  <Text style={styles.notifGrantedText}>✓ Notifiche attivate</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>

        {/* Bottone avanti / inizia */}
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={goToNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {isLast ? 'Inizia →' : 'Avanti →'}
          </Text>
        </TouchableOpacity>

        {/* Skip */}
        {!isLast && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={completeOnboarding}
            activeOpacity={0.7}
          >
            <Text style={styles.skipBtnText}>Salta</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  slide: {
    width: SCREEN_W,
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
    textAlign: 'center',
    lineHeight: 34,
  },
  description: {
    fontSize: 15,
    color: Colors.dark.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  notifBtn: {
    marginTop: 8,
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  notifBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  notifGranted: {
    marginTop: 8,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.dark.success,
  },
  notifGrantedText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.success,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.border,
  },
  dotActive: {
    backgroundColor: Colors.dark.primary,
    width: 24,
  },
  nextBtn: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 16,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  nextBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipBtnText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    fontWeight: '600',
  },
});